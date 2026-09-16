"""
StockIA — Motor de Previsão Epidemiológica
==========================================
Usa Prophet (Meta) para prever tendência de consumo de insumos
com base no histórico de movimentações de USO do banco.

Fluxo:
  1. Busca histórico de USO do material nos últimos 90 dias
  2. Monta DataFrame pandas com colunas ds (data) / y (quantidade)
  3. Verifica mínimo de 14 dias distintos com dados (honestidade)
  4. Treina Prophet com seasonality_mode='multiplicative'
  5. Calcula baseline simples (média móvel dos últimos 30 dias)
  6. Retorna previsão + tendência + aviso de confiança

Uso:
    from app.core.previsao_epidemiologica import prever_demanda_material
    resultado = prever_demanda_material(material_id=11, db=session)

IMPORTANTE: Importação do Prophet é LAZY (dentro da função) para não
            travar o uvicorn na inicialização (Prophet demora 10-15s).
"""

from datetime import datetime, timedelta, date
from sqlalchemy.orm import Session
from sqlalchemy import func, Date, cast

from app.models.models import Material, Lote, MovimentacaoEstoque


import time

# =====================================================================
# CONSTANTES
# =====================================================================
JANELA_HISTORICO_DIAS = 90      # Dias de histórico para treinar o Prophet
HORIZONTE_PREVISAO_DIAS = 56    # 8 semanas de previsão
MINIMO_DIAS_COM_DADOS = 14      # Mínimo de dias distintos para aceitar treino
BASELINE_DIAS = 30              # Janela da média móvel do baseline

# Cache em memória para evitar re-treinar 18 modelos a cada requisição
_CACHE_PREVISOES_TODOS = None
_CACHE_TIMESTAMP = 0.0
_CACHE_TTL_SEGUNDOS = 600  # 10 minutos de cache



# =====================================================================
# FUNÇÃO PRINCIPAL
# =====================================================================
def prever_demanda_material(
    material_id: int,
    db: Session,
    horizonte_dias: int = HORIZONTE_PREVISAO_DIAS,
) -> dict:
    """
    Treina o Prophet com o histórico de USO e retorna previsão.

    Returns:
        dict com:
          - material_id, nome, unidade_medida
          - consumo_previsto_total    : soma do período (horizonte_dias)
          - consumo_previsto_diario   : média diária prevista pelo Prophet
          - consumo_baseline_diario   : média simples dos últimos BASELINE_DIAS dias
          - tendencia                 : 'crescente' | 'estável' | 'decrescente'
          - risco_surto               : 'ALTO' | 'MODERADO' | 'BAIXO'
          - horizonte_dias
          - aviso                     : 'OK' | 'DADOS_INSUFICIENTES' | 'BAIXA_CONFIANCA'
          - dados_minimos_atendidos   : bool
          - calculado_em              : ISO timestamp
    """
    # --- 1. Busca o material ---
    material = db.query(Material).filter(
        Material.id == material_id, Material.ativo.is_(True)
    ).first()

    if not material:
        return _resultado_sem_dados(
            material_id, None, "un",
            f"Material ID {material_id} não encontrado ou inativo."
        )

    # --- 2. IDs dos lotes deste material ---
    ids_lotes = [
        l.id for l in db.query(Lote).filter(Lote.material_id == material_id).all()
    ]
    if not ids_lotes:
        return _resultado_sem_dados(
            material_id, material.nome, material.unidade_medida,
            "Nenhum lote encontrado para este material."
        )

    # --- 3. Histórico de USO agrupado por dia ---
    data_inicio = datetime.now() - timedelta(days=JANELA_HISTORICO_DIAS)

    dia_col = func.date(MovimentacaoEstoque.criado_em)
    registros = (
        db.query(
            dia_col.label("dia"),
            func.sum(MovimentacaoEstoque.quantidade).label("total"),
        )
        .filter(
            MovimentacaoEstoque.lote_id.in_(ids_lotes),
            MovimentacaoEstoque.tipo == "USO",
            MovimentacaoEstoque.criado_em >= data_inicio,
        )
        .group_by(dia_col)
        .order_by(dia_col)
        .all()
    )

    # --- 4. Verifica mínimo de dados ---
    if len(registros) < MINIMO_DIAS_COM_DADOS:
        return _resultado_sem_dados(
            material_id, material.nome, material.unidade_medida,
            f"Dados insuficientes: {len(registros)} dia(s) com movimentação. "
            f"Mínimo exigido: {MINIMO_DIAS_COM_DADOS} dias."
        )

    # --- 5. Monta o DataFrame ---
    try:
        import pandas as pd  # importação lazy
        from prophet import Prophet  # importação lazy — evita lentidão no boot

        df = pd.DataFrame([
            {"ds": pd.to_datetime(str(r.dia)), "y": float(r.total)}
            for r in registros
        ])

        # --- 6. Baseline simples (média móvel dos últimos BASELINE_DIAS dias) ---
        data_baseline = datetime.now() - timedelta(days=BASELINE_DIAS)
        baseline_registros = [r for r in registros if pd.to_datetime(str(r.dia)) >= pd.to_datetime(data_baseline)]
        if baseline_registros:
            consumo_baseline_diario = sum(float(r.total) for r in baseline_registros) / max(len(baseline_registros), 1)
        else:
            consumo_baseline_diario = sum(float(r.total) for r in registros) / max(len(registros), 1)

        # --- 7. Treina o Prophet ---
        model = Prophet(
            seasonality_mode="multiplicative",
            weekly_seasonality=True,
            yearly_seasonality=False,  # Desativado: histórico de 90 dias não sustenta ciclo anual de 365 dias
            daily_seasonality=False,
            interval_width=0.80,  # Intervalo de confiança 80%
        )
        # Suprime os logs verbosos do Prophet
        import logging
        logging.getLogger("prophet").setLevel(logging.WARNING)
        logging.getLogger("cmdstanpy").setLevel(logging.WARNING)

        model.fit(df)

        # --- 8. Gera previsão ---
        future = model.make_future_dataframe(periods=horizonte_dias, freq="D")
        forecast = model.predict(future)

        # Pega apenas o período futuro (a partir de amanhã)
        hoje = pd.Timestamp.today().normalize()
        futuro = forecast[forecast["ds"] > hoje].head(horizonte_dias)

        consumo_previsto_total = max(0.0, round(float(futuro["yhat"].sum()), 2))
        consumo_previsto_diario = max(0.0, round(float(futuro["yhat"].mean()), 4))

        # --- 9. Classifica tendência ---
        tendencia = _classificar_tendencia(consumo_previsto_diario, consumo_baseline_diario)

        # --- 10. Classifica risco de surto ---
        risco_surto = _classificar_risco_surto(consumo_previsto_diario, consumo_baseline_diario)

        return {
            "material_id": material_id,
            "nome": material.nome,
            "unidade_medida": material.unidade_medida,
            "consumo_previsto_total": consumo_previsto_total,
            "consumo_previsto_diario": consumo_previsto_diario,
            "consumo_baseline_diario": round(consumo_baseline_diario, 4),
            "tendencia": tendencia,
            "risco_surto": risco_surto,
            "horizonte_dias": horizonte_dias,
            "dias_com_historico": len(registros),
            "aviso": "OK",
            "dados_minimos_atendidos": True,
            "calculado_em": datetime.now().isoformat(),
        }

    except ImportError as e:
        return _resultado_sem_dados(
            material_id, material.nome, material.unidade_medida,
            f"Biblioteca não instalada: {e}. Execute: pip install prophet pandas"
        )
    except Exception as exc:
        import logging
        logging.getLogger("stockia.ia").error(
            "Erro ao prever demanda material %d: %s", material_id, exc
        )
        return _resultado_sem_dados(
            material_id, material.nome, material.unidade_medida,
            f"Erro no modelo preditivo: {str(exc)[:200]}"
        )


# =====================================================================
# PREVISÃO PARA TODOS OS MATERIAIS VINCULADOS A DOENÇAS
# =====================================================================
def prever_demanda_todos(db: Session, force_refresh: bool = False) -> list[dict]:
    """
    Executa previsão para todos os materiais ativos que tenham
    ao menos MINIMO_DIAS_COM_DADOS de histórico de USO.
    Retorna lista ordenada por risco_surto (ALTO primeiro).
    Possui cache em memória de 10 minutos para respostas instantâneas.
    """
    global _CACHE_PREVISOES_TODOS, _CACHE_TIMESTAMP

    agora = time.time()
    if not force_refresh and _CACHE_PREVISOES_TODOS is not None and (agora - _CACHE_TIMESTAMP) < _CACHE_TTL_SEGUNDOS:
        return _CACHE_PREVISOES_TODOS

    materiais = db.query(Material).filter(Material.ativo.is_(True)).all()
    resultados = []

    for mat in materiais:
        r = prever_demanda_material(mat.id, db)
        if r["dados_minimos_atendidos"]:
            resultados.append(r)

    ordem = {"ALTO": 0, "MODERADO": 1, "BAIXO": 2}
    resultados.sort(key=lambda x: ordem.get(x.get("risco_surto", "BAIXO"), 99))

    _CACHE_PREVISOES_TODOS = resultados
    _CACHE_TIMESTAMP = agora
    return resultados


def limpar_cache_previsao() -> None:
    """Invalida o cache para forçar novo treino imediato."""
    global _CACHE_PREVISOES_TODOS, _CACHE_TIMESTAMP
    _CACHE_PREVISOES_TODOS = None
    _CACHE_TIMESTAMP = 0.0


# =====================================================================
# HELPERS INTERNOS
# =====================================================================
def _resultado_sem_dados(
    material_id: int, nome, unidade: str, motivo: str
) -> dict:
    return {
        "material_id": material_id,
        "nome": nome,
        "unidade_medida": unidade,
        "consumo_previsto_total": 0.0,
        "consumo_previsto_diario": 0.0,
        "consumo_baseline_diario": 0.0,
        "tendencia": "indisponível",
        "risco_surto": "BAIXO",
        "horizonte_dias": HORIZONTE_PREVISAO_DIAS,
        "dias_com_historico": 0,
        "aviso": "DADOS_INSUFICIENTES",
        "dados_minimos_atendidos": False,
        "mensagem": motivo,
        "calculado_em": datetime.now().isoformat(),
    }


def _classificar_tendencia(previsto_diario: float, baseline_diario: float) -> str:
    """
    Compara Prophet com baseline para classificar tendência.
    Diferença > 15% para cima = crescente, > 15% para baixo = decrescente.
    """
    if baseline_diario < 0.0001:
        return "indisponível"
    variacao = (previsto_diario - baseline_diario) / baseline_diario
    if variacao > 0.15:
        return "crescente"
    elif variacao < -0.15:
        return "decrescente"
    return "estável"


def _classificar_risco_surto(previsto_diario: float, baseline_diario: float) -> str:
    """
    ALTO   : demanda prevista > 30% acima do baseline (sinal de surto)
    MODERADO: 15% a 30% acima
    BAIXO  : dentro da normalidade
    """
    if baseline_diario < 0.0001:
        return "BAIXO"
    variacao = (previsto_diario - baseline_diario) / baseline_diario
    if variacao > 0.30:
        return "ALTO"
    elif variacao > 0.15:
        return "MODERADO"
    return "BAIXO"
