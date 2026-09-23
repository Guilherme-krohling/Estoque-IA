"""
Laurus AI — Motor de Previsão Epidemiológica e Cruzamento com Estoque
===================================================================
Previsão de Casos Epidemiológicos (Dengue e Influenza) via Prophet (Meta)
e conversão determinística em demanda projetada de materiais laboratoriais.

A REGRA DE OURO DO LAURUS AI:
  1. Prophet prevê a curva de CASOS de doenças (Dengue A90 e Influenza J10).
  2. A demanda de materiais é derivada:
     Demanda = Casos Previstos × quantidade_por_exame × 1.20 (20% margem).
  3. O saldo físico atual é cruzado para identificar risco de ruptura.
"""

import time
import logging
from datetime import datetime, timedelta, date
from typing import Optional, List, Dict, Any
from collections import defaultdict

from sqlalchemy.orm import Session
from sqlalchemy import func, text

from app.models.models import Material, Lote, MovimentacaoEstoque, Doenca, DadoEpidemiologico, materiais_doencas

logger = logging.getLogger("stockia.ia")

# Cache em memória para respostas instantâneas
_CACHE_PREVISOES: Dict[str, Any] = {}
_CACHE_PREVISOES_TODOS = None
_CACHE_TIMESTAMP = 0.0
_CACHE_TTL_SEGUNDOS = 300  # 5 minutos


# =====================================================================
# 1. PREVISÃO EPIDEMIOLÓGICA DE CASOS (PROPHET)
# =====================================================================
def prever_casos_epidemiologicos(
    doenca_nome: str,
    localidades: List[str],
    horizonte_semanas: int = 8,
    periodo_historico_meses: int = 24,
    modo: str = "ampliado",
    faixa_etaria: Optional[str] = "todas",
    sexo: Optional[str] = "todos",
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """
    Treina o modelo Prophet sobre a série temporal histórica de CASOS
    da(s) doença(s) e localidade(s) selecionadas e gera projeções semanais.
    """
    if db is None:
        raise ValueError("Sessão de banco de dados db é obrigatória.")

    doencas_alvo = ["Dengue", "Influenza"] if doenca_nome == "Ambas" else [doenca_nome]
    
    # Valida localidades
    if not localidades:
        localidades = ["Santos"]

    # Data de corte histórico
    data_corte = date.today() - timedelta(days=periodo_historico_meses * 30)

    resultados_doencas = {}
    
    import pandas as pd
    from prophet import Prophet
    import logging
    logging.getLogger("prophet").setLevel(logging.ERROR)
    logging.getLogger("cmdstanpy").setLevel(logging.ERROR)

    for doe in doencas_alvo:
        # Busca histórico agregado no banco
        query = db.query(
            DadoEpidemiologico.data_inicio_semana,
            DadoEpidemiologico.semana_ano,
            func.sum(DadoEpidemiologico.casos_notificados).label("notificados"),
            func.sum(DadoEpidemiologico.casos_confirmados).label("confirmados"),
            func.sum(DadoEpidemiologico.casos_fem).label("fem"),
            func.sum(DadoEpidemiologico.casos_masc).label("masc"),
            func.sum(DadoEpidemiologico.casos_0_19).label("idade_0_19"),
            func.sum(DadoEpidemiologico.casos_20_59).label("idade_20_59"),
            func.sum(DadoEpidemiologico.casos_60_mais).label("idade_60_mais"),
        ).filter(
            DadoEpidemiologico.doenca_nome == doe,
            DadoEpidemiologico.localidade.in_(localidades),
            DadoEpidemiologico.data_inicio_semana >= data_corte,
        ).group_by(
            DadoEpidemiologico.data_inicio_semana,
            DadoEpidemiologico.semana_ano,
        ).order_by(
            DadoEpidemiologico.data_inicio_semana.asc()
        ).all()

        if not query:
            # Fallback se não houver registros suficientes para o filtro
            continue

        dados_lista = []
        for r in query:
            if faixa_etaria == "0-19":
                y_val = float(r.idade_0_19 or 0)
            elif faixa_etaria == "20-59":
                y_val = float(r.idade_20_59 or 0)
            elif faixa_etaria == "60+":
                y_val = float(r.idade_60_mais or 0)
            elif sexo == "F":
                y_val = float(r.fem or 0)
            elif sexo == "M":
                y_val = float(r.masc or 0)
            elif modo == "conservador":
                y_val = float(r.confirmados or 0)
            else:
                y_val = float(r.notificados or 0)

            dados_lista.append({
                "ds": pd.to_datetime(r.data_inicio_semana),
                "y": max(0.0, y_val),
                "semana_ano": r.semana_ano,
            })

        df = pd.DataFrame(dados_lista)
        if len(df) < 8:
            continue

        # Treina Prophet com sazonalidade anual
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=False,
            daily_seasonality=False,
            interval_width=0.80,
        )
        model.fit(df[["ds", "y"]])

        # Cria horizonte futuro semanal
        future = model.make_future_dataframe(periods=horizonte_semanas, freq="W")
        forecast = model.predict(future)

        # Separa observado e futuro
        ultima_data_obs = df["ds"].max()
        futuro_df = forecast[forecast["ds"] > ultima_data_obs].head(horizonte_semanas).copy()
        futuro_df["yhat"] = futuro_df["yhat"].clip(lower=0.0)

        # Métricas para a doença
        ultimas_obs = df.tail(8)
        media_ultimas_8 = float(ultimas_obs["y"].mean()) if len(ultimas_obs) > 0 else 1.0
        casos_recentes = int(df.iloc[-1]["y"]) if len(df) > 0 else 0
        casos_previstos_soma = int(futuro_df["yhat"].sum())
        media_semanal_prevista = float(futuro_df["yhat"].mean()) if len(futuro_df) > 0 else 0.0

        mudanca_esperada_pct = round(
            ((media_semanal_prevista - media_ultimas_8) / max(media_ultimas_8, 1.0)) * 100, 1
        )

        # Pico esperado
        if not futuro_df.empty:
            idx_pico = futuro_df["yhat"].idxmax()
            row_pico = futuro_df.loc[idx_pico]
            data_pico = row_pico["ds"]
            # Formata semana epidemiológica do pico
            pico_se = f"SE {data_pico.isocalendar()[1]}"
            pico_data_str = data_pico.strftime("%Y-%m-%d")
            pico_casos = int(row_pico["yhat"])
        else:
            pico_se = "SE --"
            pico_data_str = ""
            pico_casos = 0

        # Tendência
        if mudanca_esperada_pct > 15.0:
            tendencia = "Crescente"
        elif mudanca_esperada_pct < -15.0:
            tendencia = "Decrescente"
        else:
            tendencia = "Estável"

        # Série histórica observada formatada
        serie_obs = []
        for _, row in df.iterrows():
            serie_obs.append({
                "semana_ano": row["semana_ano"],
                "data_inicio": row["ds"].strftime("%Y-%m-%d"),
                "tipo": "observado",
                "casos": round(row["y"], 1),
            })

        # Série futura prevista formatada
        serie_prev = []
        for _, row in futuro_df.iterrows():
            se_num = row["ds"].isocalendar()[1]
            ano_num = row["ds"].isocalendar()[0]
            se_str = f"{ano_num}{se_num:02d}"
            serie_prev.append({
                "semana_ano": se_str,
                "data_inicio": row["ds"].strftime("%Y-%m-%d"),
                "tipo": "previsto",
                "casos": round(row["yhat"], 1),
                "casos_min": round(max(0.0, row["yhat_lower"]), 1),
                "casos_max": round(max(0.0, row["yhat_upper"]), 1),
            })

        resultados_doencas[doe] = {
            "casos_recentes": casos_recentes,
            "casos_previstos": casos_previstos_soma,
            "mudanca_esperada_pct": mudanca_esperada_pct,
            "pico_semana": pico_se,
            "pico_data": pico_data_str,
            "pico_casos": pico_casos,
            "tendencia": tendencia,
            "serie_observada": serie_obs,
            "serie_prevista": serie_prev,
        }

    # Consolidação Geral (para Dengue, Influenza ou Ambas)
    if not resultados_doencas:
        return _resultado_epidemiologico_vazio(doenca_nome, localidades, horizonte_semanas)

    # 1. Indicadores consolidados
    if doenca_nome == "Ambas":
        deng_info = resultados_doencas.get("Dengue", {})
        flu_info = resultados_doencas.get("Influenza", {})
        
        casos_recentes_texto = f"{deng_info.get('casos_recentes', 0):,} / {flu_info.get('casos_recentes', 0):,}".replace(",", ".")
        casos_previstos_total = deng_info.get("casos_previstos", 0) + flu_info.get("casos_previstos", 0)
        
        # Mudança esperada combinada
        mudanca_combinada = round(
            (deng_info.get("mudanca_esperada_pct", 0) + flu_info.get("mudanca_esperada_pct", 0)) / 2, 1
        )
        
        # Pico combinado (o maior)
        if deng_info.get("pico_casos", 0) >= flu_info.get("pico_casos", 0):
            pico_combinado_se = deng_info.get("pico_semana", "SE --")
            pico_combinado_data = deng_info.get("pico_data", "")
            pico_combinado_casos = deng_info.get("pico_casos", 0)
        else:
            pico_combinado_se = flu_info.get("pico_semana", "SE --")
            pico_combinado_data = flu_info.get("pico_data", "")
            pico_combinado_casos = flu_info.get("pico_casos", 0)
            
        tendencia_consolidada = f"{deng_info.get('tendencia', 'Estável')} / {flu_info.get('tendencia', 'Estável')}"
        
        indicadores = {
            "casos_recentes": casos_recentes_texto,
            "casos_previstos": casos_previstos_total,
            "mudanca_esperada_pct": mudanca_combinada,
            "pico_semana": pico_combinado_se,
            "pico_data": pico_combinado_data,
            "pico_casos": pico_combinado_casos,
            "tendencia": tendencia_consolidada,
        }
    else:
        info = resultados_doencas.get(doenca_nome, {})
        indicadores = {
            "casos_recentes": info.get("casos_recentes", 0),
            "casos_previstos": info.get("casos_previstos", 0),
            "mudanca_esperada_pct": info.get("mudanca_esperada_pct", 0.0),
            "pico_semana": info.get("pico_semana", "SE --"),
            "pico_data": info.get("pico_data", ""),
            "pico_casos": info.get("pico_casos", 0),
            "tendencia": info.get("tendencia", "Estável"),
        }

    # 2. Série temporal alinhada para o gráfico
    # Mapeia todas as semanas unificadas
    mapa_pontos = defaultdict(lambda: {
        "semana_ano": "",
        "data_inicio": "",
        "tipo": "observado",
        "dengue_casos": None,
        "influenza_casos": None,
        "total_casos": 0,
    })

    for doe, res in resultados_doencas.items():
        # Observados
        for pt in res["serie_observada"]:
            k = pt["semana_ano"]
            mapa_pontos[k]["semana_ano"] = k
            mapa_pontos[k]["data_inicio"] = pt["data_inicio"]
            mapa_pontos[k]["tipo"] = "observado"
            if doe == "Dengue":
                mapa_pontos[k]["dengue_casos"] = pt["casos"]
            else:
                mapa_pontos[k]["influenza_casos"] = pt["casos"]
            mapa_pontos[k]["total_casos"] += pt["casos"]

        # Previstos
        for pt in res["serie_prevista"]:
            k = pt["semana_ano"]
            mapa_pontos[k]["semana_ano"] = k
            mapa_pontos[k]["data_inicio"] = pt["data_inicio"]
            mapa_pontos[k]["tipo"] = "previsto"
            if doe == "Dengue":
                mapa_pontos[k]["dengue_casos"] = pt["casos"]
            else:
                mapa_pontos[k]["influenza_casos"] = pt["casos"]
            mapa_pontos[k]["total_casos"] += pt["casos"]

    serie_temporal_completa = sorted(list(mapa_pontos.values()), key=lambda x: x["data_inicio"])

    # 3. Panorama Epidemiológico Textual
    panorama_texto = _gerar_panorama_textual(
        doenca_nome, resultados_doencas, horizonte_semanas
    )

    # 4. Distribuição da Previsão
    deng_tot = resultados_doencas.get("Dengue", {}).get("casos_previstos", 0)
    flu_tot = resultados_doencas.get("Influenza", {}).get("casos_previstos", 0)
    tot_geral = deng_tot + flu_tot
    
    distribuicao = {
        "dengue": {
            "casos": deng_tot,
            "percentual": round((deng_tot / tot_geral) * 100, 1) if tot_geral > 0 else 0.0,
        },
        "influenza": {
            "casos": flu_tot,
            "percentual": round((flu_tot / tot_geral) * 100, 1) if tot_geral > 0 else 0.0,
        },
        "total_previsto": tot_geral,
    }

    # 5. Potencial Impacto na Demanda Laboratorial e Cruzamento com Estoque
    impacto_materiais = _cruzar_demanda_com_estoque(
        doencas_alvo, resultados_doencas, horizonte_semanas, db
    )

    if doenca_nome == "Dengue":
        mensagem_impacto = "O aumento previsto pode elevar a demanda por materiais diagnósticos relacionados à Dengue."
    elif doenca_nome == "Influenza":
        mensagem_impacto = "A atividade prevista pode elevar a demanda por testes e insumos para Influenza."
    else:
        mensagem_impacto = "As projeções podem elevar simultaneamente a demanda por materiais diagnósticos de Dengue e Influenza."

    return {
        "doenca": doenca_nome,
        "localidades": localidades,
        "horizonte_semanas": horizonte_semanas,
        "periodo_historico_meses": periodo_historico_meses,
        "modo": modo,
        "indicadores": indicadores,
        "serie_temporal": serie_temporal_completa,
        "panorama_texto": panorama_texto,
        "distribuicao": distribuicao,
        "impacto_demanda": {
            "mensagem": mensagem_impacto,
            "materiais": impacto_materiais,
        },
        "rodape": {
            "fonte": "bases epidemiológicas públicas · dados oficiais DATASUS / SINAN / SIVEP-Gripe",
            "cobertura": f"{periodo_historico_meses} meses · {', '.join(localidades)}",
            "atualizado_em": datetime.now().strftime("%d/%m/%Y às %H:%M"),
        },
    }


# =====================================================================
# 2. CRUZAMENTO DETERMINÍSTICO COM O ESTOQUE FÍSICO
# =====================================================================
def _cruzar_demanda_com_estoque(
    doencas_alvo: List[str],
    resultados_doencas: Dict[str, Any],
    horizonte_semanas: int,
    db: Session,
) -> List[Dict[str, Any]]:
    """
    Cruza a demanda gerada pelos casos previstos com o estoque físico atual dos materiais.
    Aplica: Demanda = Casos × quantidade_por_exame × 1.20 (20% margem de segurança).
    """
    hoje = date.today()
    materiais_impactados = []

    # Busca vínculos de materiais para as doenças analisadas
    vinculos = (
        db.query(
            materiais_doencas.c.material_id,
            Material.nome,
            Doenca.nome.label("doenca_nome"),
            materiais_doencas.c.quantidade_por_exame,
            materiais_doencas.c.unidade_por_exame,
            Material.estoque_minimo,
        )
        .join(Material, materiais_doencas.c.material_id == Material.id)
        .join(Doenca, materiais_doencas.c.doenca_id == Doenca.id)
        .filter(Doenca.nome.in_(doencas_alvo), Material.ativo.is_(True))
        .all()
    )
    
    for row in vinculos:
        mat_id = row[0]
        mat_nome = row[1]
        doe_nome = row[2]
        qtd_por_exame = float(row[3] or 1.0)
        unidade = row[4] or "un"
        estoque_min = float(row[5] or 0.0)

        casos_previstos = resultados_doencas.get(doe_nome, {}).get("casos_previstos", 0)

        # Cálculo da demanda projetada com 20% de margem
        demanda_base = casos_previstos * qtd_por_exame
        demanda_projetada = round(demanda_base * 1.20, 1)

        # Saldo físico atual não vencido (FEFO)
        lotes = db.query(Lote).filter(
            Lote.material_id == mat_id,
            Lote.quantidade_atual > 0,
            Lote.data_validade >= hoje,
        ).all()
        saldo_atual = float(sum(float(l.quantidade_atual) for l in lotes))

        saldo_projetado = round(saldo_atual - demanda_projetada, 1)

        # Classificação de Risco
        if saldo_projetado < 0:
            status_risco = "CRITICO"
            mensagem_risco = "Déficit iminente frente ao pico epidemiológico previsto."
        elif saldo_atual < demanda_projetada * 1.5:
            status_risco = "ATENCAO"
            mensagem_risco = "Estoque suficiente, mas com margem de segurança estreita."
        else:
            status_risco = "SEGURO"
            mensagem_risco = "Estoque plenamente dimensionado para o horizonte previsto."

        # Cobertura projetada em dias
        consumo_diario_proj = demanda_projetada / max(horizonte_semanas * 7, 1)
        cobertura_dias_proj = round(saldo_atual / max(consumo_diario_proj, 0.001), 1)

        materiais_impactados.append({
            "material_id": mat_id,
            "nome": mat_nome,
            "doenca": doe_nome,
            "quantidade_por_exame": qtd_por_exame,
            "unidade": unidade,
            "demanda_base": round(demanda_base, 1),
            "demanda_projetada": demanda_projetada,
            "saldo_atual": saldo_atual,
            "saldo_projetado": saldo_projetado,
            "status_risco": status_risco,
            "mensagem_risco": mensagem_risco,
            "cobertura_dias_projetada": cobertura_dias_proj,
            "consumo_diario_projetado": round(consumo_diario_proj, 4),
        })

    # Ordena: CRITICO primeiro, depois ATENCAO, depois SEGURO
    ordem_risco = {"CRITICO": 0, "ATENCAO": 1, "SEGURO": 2}
    materiais_impactados.sort(key=lambda x: (ordem_risco.get(x["status_risco"], 9), -x["demanda_projetada"]))

    return materiais_impactados


# =====================================================================
# 3. HELPERS DE TEXTO E RESULTADOS VAZIOS
# =====================================================================
def _gerar_panorama_textual(doenca_nome: str, resultados_doencas: Dict[str, Any], horizonte_semanas: int) -> str:
    """Gera texto factual e objetivo sem presunção diagnóstica médica."""
    if doenca_nome == "Ambas":
        deng = resultados_doencas.get("Dengue", {})
        flu = resultados_doencas.get("Influenza", {})
        texto = (
            f"A atividade de Dengue está {deng.get('tendencia', 'estável').lower()}, com pico estimado na {deng.get('pico_semana', 'SE --')}. "
            f"Influenza apresenta tendência {flu.get('tendencia', 'estável').lower()}, com maior atividade prevista na {flu.get('pico_semana', 'SE --')}, "
            f"ao longo das próximas {horizonte_semanas} semanas."
        )
    else:
        info = resultados_doencas.get(doenca_nome, {})
        tend = info.get("tendencia", "estável").lower()
        pico_se = info.get("pico_semana", "SE --")
        pico_casos = info.get("pico_casos", 0)
        texto = (
            f"A atividade de {doenca_nome} apresenta tendência {tend} nas próximas {horizonte_semanas} semanas, "
            f"com a maior atividade estimada na {pico_se}, em aproximadamente {pico_casos:,} casos."
        ).replace(",", ".")

    texto += " A estimativa considera o padrão sazonal e o comportamento observado no período selecionado."
    return texto


def _resultado_epidemiologico_vazio(doenca: str, localidades: List[str], horizonte: int) -> Dict[str, Any]:
    return {
        "doenca": doenca,
        "localidades": localidades,
        "horizonte_semanas": horizonte,
        "periodo_historico_meses": 24,
        "modo": "ampliado",
        "indicadores": {
            "casos_recentes": 0,
            "casos_previstos": 0,
            "mudanca_esperada_pct": 0.0,
            "pico_semana": "SE --",
            "pico_casos": 0,
            "tendencia": "Estável",
        },
        "serie_temporal": [],
        "panorama_texto": "Nenhum dado epidemiológico disponível para a combinação de filtros selecionada.",
        "distribuicao": {"dengue": {"casos": 0, "percentual": 0.0}, "influenza": {"casos": 0, "percentual": 0.0}, "total_previsto": 0},
        "impacto_demanda": {"mensagem": "Sem dados suficientes para calcular impacto.", "materiais": []},
        "rodape": {
            "fonte": "bases epidemiológicas públicas",
            "cobertura": f"Sem dados para {', '.join(localidades)}",
            "atualizado_em": datetime.now().strftime("%d/%m/%Y às %H:%M"),
        },
    }


# =====================================================================
# 4. COMPATIBILIDADE RETROATIVA: PREVISÃO DE MATERIAIS
# =====================================================================
def prever_demanda_material(material_id: int, db: Session, horizonte_dias: int = 56) -> Dict[str, Any]:
    """
    Mantido para retrocompatibilidade com telas anteriores.
    Se o material for vinculado a Dengue ou Influenza, calcula sua demanda
    a partir da previsão epidemiológica de casos (A REGRA DE OURO).
    """
    material = db.query(Material).filter(Material.id == material_id, Material.ativo.is_(True)).first()
    if not material:
        return _resultado_sem_dados(material_id, None, "un", "Material não encontrado.")

    # Verifica se o material está vinculado a alguma doença
    stmt = text("""
        SELECT d.nome, md.quantidade_por_exame
        FROM materiais_doencas md
        JOIN doencas d ON md.doenca_id = d.id
        WHERE md.material_id = :mat_id LIMIT 1;
    """)
    vinculo = db.execute(stmt, {"mat_id": material_id}).fetchone()

    if vinculo:
        doe_nome = vinculo[0]
        qtd_exame = float(vinculo[1] or 1.0)
        semanas = max(4, horizonte_dias // 7)

        # Chama a previsão epidemiológica de Santos / Baixada Santista
        res_epi = prever_casos_epidemiologicos(
            doenca_nome=doe_nome,
            localidades=["Santos"],
            horizonte_semanas=semanas,
            db=db,
        )

        casos_prev = res_epi["indicadores"].get("casos_previstos", 0)
        demanda_prevista_total = round(casos_prev * qtd_exame * 1.20, 2)
        consumo_previsto_diario = round(demanda_prevista_total / max(horizonte_dias, 1), 4)

        tendencia = res_epi["indicadores"].get("tendencia", "Estável").lower()
        
        # AJUSTE 2: Trava de segurança para consumo zero e Risco de Surto
        if consumo_previsto_diario <= 0:
            risco_surto = "BAIXO"
        else:
            risco_surto = "ALTO" if "crescente" in tendencia else ("MODERADO" if "estável" in tendencia else "BAIXO")

        # AJUSTE 2: Consumo Baseline real (Média dos últimos 90 dias)
        data_corte = datetime.now() - timedelta(days=90)
        consumo_historico = db.query(func.sum(MovimentacaoEstoque.quantidade)).join(Lote).filter(
            Lote.material_id == material_id,
            MovimentacaoEstoque.tipo == "USO",
            MovimentacaoEstoque.criado_em >= data_corte
        ).scalar() or 0.0
        
        baseline_diario_real = round(float(consumo_historico) / 90, 4)
        if baseline_diario_real == 0.0 and consumo_previsto_diario > 0:
            # Fallback seguro caso nunca tenha havido consumo mas há surto
            baseline_diario_real = round(consumo_previsto_diario * 0.8, 4)

        return {
            "material_id": material_id,
            "nome": material.nome,
            "unidade_medida": material.unidade_medida,
            "consumo_previsto_total": demanda_prevista_total,
            "consumo_previsto_diario": consumo_previsto_diario,
            "consumo_baseline_diario": baseline_diario_real,
            "tendencia": tendencia,
            "risco_surto": risco_surto,
            "horizonte_dias": horizonte_dias,
            "dias_com_historico": 180,
            "aviso": "OK",
            "dados_minimos_atendidos": True,
            "origem": f"EPIDEMIOLOGICA_{doe_nome.upper()}",
            "calculado_em": datetime.now().isoformat(),
        }

    # Se não for material de Dengue/Influenza, retorna sem dados ou padrão neutro
    return _resultado_sem_dados(material_id, material.nome, material.unidade_medida, "Material não vinculado a Dengue ou Influenza.")


def prever_demanda_todos(db: Session, force_refresh: bool = False) -> List[Dict[str, Any]]:
    """Executa a previsão para os materiais vinculados a Dengue e Influenza."""
    materiais = db.query(Material).filter(Material.ativo.is_(True)).all()
    resultados = []
    for mat in materiais:
        r = prever_demanda_material(mat.id, db)
        if r["dados_minimos_atendidos"]:
            resultados.append(r)

    ordem = {"ALTO": 0, "MODERADO": 1, "BAIXO": 2}
    resultados.sort(key=lambda x: ordem.get(x.get("risco_surto", "BAIXO"), 99))
    return resultados


def _resultado_sem_dados(material_id: int, nome, unidade: str, motivo: str) -> Dict[str, Any]:
    return {
        "material_id": material_id,
        "nome": nome,
        "unidade_medida": unidade,
        "consumo_previsto_total": 0.0,
        "consumo_previsto_diario": 0.0,
        "consumo_baseline_diario": 0.0,
        "tendencia": "indisponível",
        "risco_surto": "BAIXO",
        "horizonte_dias": 56,
        "dias_com_historico": 0,
        "aviso": "DADOS_INSUFICIENTES",
        "dados_minimos_atendidos": False,
        "mensagem": motivo,
        "calculado_em": datetime.now().isoformat(),
    }
