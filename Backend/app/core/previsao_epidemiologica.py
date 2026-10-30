"""
Laurus AI — Motor de Previsão Epidemiológica e Cruzamento com Estoque
===================================================================
Previsão de Casos Epidemiológicos (Dengue e Influenza) via Prophet (Meta)
e conversão determinística em demanda projetada de materiais laboratoriais.

A REGRA DE OURO DO LAURUS AI:
  1. Prophet prevê a curva de CASOS de doenças (Dengue A90 e Influenza J10) com base no SINAN.
  2. A demanda de materiais é derivada:
     Demanda = Casos Previstos × quantidade_por_exame × 1.20 (20% margem).
  3. O saldo físico atual é cruzado para identificar risco de ruptura.
"""

import calendar
import logging
from datetime import datetime, timedelta, date
from typing import Optional, List, Dict, Any
from collections import defaultdict

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import func, text

from app.models.models import (
    Material,
    Lote,
    MovimentacaoEstoque,
    Doenca,
    DadoEpidemiologico,
    materiais_doencas,
)

logger = logging.getLogger("stockia.ia")

# Cache em memória para respostas instantâneas
_CACHE_PREVISOES: Dict[str, Any] = {}
_CACHE_PREVISOES_TODOS = None
_CACHE_TIMESTAMP = 0.0
_CACHE_TTL_SEGUNDOS = 300  # 5 minutos


def _parse_data_inicio(valor: Optional[str]) -> Optional[date]:
    """Converte 'YYYY-MM' ou 'YYYY-MM-DD' para date no primeiro dia do mês."""
    if not valor:
        return None
    valor = valor.strip()
    try:
        if len(valor) == 7:  # YYYY-MM
            ano, mes = map(int, valor.split("-"))
            return date(ano, mes, 1)
        return date.fromisoformat(valor[:10])
    except Exception:
        return None


def _parse_data_fim(valor: Optional[str]) -> Optional[date]:
    """Converte 'YYYY-MM' ou 'YYYY-MM-DD' para date no último dia do mês."""
    if not valor:
        return None
    valor = valor.strip()
    try:
        if len(valor) == 7:  # YYYY-MM
            ano, mes = map(int, valor.split("-"))
            ultimo_dia = calendar.monthrange(ano, mes)[1]
            return date(ano, mes, ultimo_dia)
        return date.fromisoformat(valor[:10])
    except Exception:
        return None


# =====================================================================
# 1. PREVISÃO EPIDEMIOLÓGICA DE CASOS (PROPHET — FONTE UNIFICADA SINAN)
# =====================================================================
def prever_casos_epidemiologicos(
    doenca_nome: str,
    localidades: List[str],
    horizonte_semanas: int = 8,
    periodo_historico_meses: int = 24,
    modo: str = "ampliado",
    faixa_etaria: Optional[str] = "todas",
    sexo: Optional[str] = "todos",
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """
    Treina o modelo Prophet sobre a série temporal histórica de CASOS (SINAN)
    da(s) doença(s) e localidade(s) selecionadas e gera projeções semanais.
    Suporta combinação proporcional de filtros (modo, faixa_etaria, sexo) e
    recorte temporal exato (data_inicio a data_fim) sem degradar o treino sazonal.
    """
    if db is None:
        raise ValueError("Sessão de banco de dados db é obrigatória.")

    doencas_alvo = ["Dengue", "Influenza"] if doenca_nome == "Ambas" else [doenca_nome]

    # Valida localidades
    if not localidades:
        localidades = ["Santos"]

    # Descobre a maior data disponível no banco para as doenças e localidades selecionadas
    max_data_banco = (
        db.query(func.max(DadoEpidemiologico.data_inicio_semana))
        .filter(
            DadoEpidemiologico.doenca_nome.in_(doencas_alvo),
            DadoEpidemiologico.localidade.in_(localidades),
        )
        .scalar()
    )
    if not max_data_banco:
        return _resultado_epidemiologico_vazio(doenca_nome, localidades, horizonte_semanas)

    # Determina intervalo visual solicitado pelo usuário
    dt_fim = _parse_data_fim(data_fim) or max_data_banco
    if dt_fim > max_data_banco:
        dt_fim = max_data_banco

    dt_inicio = _parse_data_inicio(data_inicio)
    if not dt_inicio:
        dt_inicio = dt_fim - timedelta(days=periodo_historico_meses * 30)

    if dt_inicio > dt_fim:
        dt_inicio = dt_fim - timedelta(days=180)

    # Para o treino do Prophet com sazonalidade anual (yearly_seasonality=True),
    # garantimos pelo menos 36 meses (~1095 dias) de histórico antes de dt_fim
    # para que o modelo aprenda múltiplos ciclos sazonais completos e nunca fique sub-identificado.
    dt_treino_inicio = min(dt_inicio, dt_fim - timedelta(days=1095))

    from prophet import Prophet
    logging.getLogger("prophet").setLevel(logging.ERROR)
    logging.getLogger("cmdstanpy").setLevel(logging.ERROR)

    # Quando "Ambas" está selecionado, alinhamos a última data observada comum
    # para que Dengue e Influenza iniciem o período previsto exatamente na mesma semana.
    limite_comum_obs: Optional[date] = None
    if len(doencas_alvo) > 1:
        max_por_doenca = []
        for doe in doencas_alvo:
            m_doe = (
                db.query(func.max(DadoEpidemiologico.data_inicio_semana))
                .filter(
                    DadoEpidemiologico.doenca_nome == doe,
                    DadoEpidemiologico.localidade.in_(localidades),
                    DadoEpidemiologico.data_inicio_semana <= dt_fim,
                )
                .scalar()
            )
            if m_doe:
                max_por_doenca.append(m_doe)
        if max_por_doenca:
            limite_comum_obs = min(max_por_doenca)

    resultados_doencas = {}

    for doe in doencas_alvo:
        dt_teto_doe = limite_comum_obs if limite_comum_obs else dt_fim

        # Busca histórico agregado no banco para treino + visualização
        query = (
            db.query(
                DadoEpidemiologico.data_inicio_semana,
                DadoEpidemiologico.semana_ano,
                func.sum(DadoEpidemiologico.casos_notificados).label("notificados"),
                func.sum(DadoEpidemiologico.casos_confirmados).label("confirmados"),
                func.sum(DadoEpidemiologico.casos_fem).label("fem"),
                func.sum(DadoEpidemiologico.casos_masc).label("masc"),
                func.sum(DadoEpidemiologico.casos_0_19).label("idade_0_19"),
                func.sum(DadoEpidemiologico.casos_20_59).label("idade_20_59"),
                func.sum(DadoEpidemiologico.casos_60_mais).label("idade_60_mais"),
            )
            .filter(
                DadoEpidemiologico.doenca_nome == doe,
                DadoEpidemiologico.localidade.in_(localidades),
                DadoEpidemiologico.data_inicio_semana >= dt_treino_inicio,
                DadoEpidemiologico.data_inicio_semana <= dt_teto_doe,
            )
            .group_by(
                DadoEpidemiologico.data_inicio_semana,
                DadoEpidemiologico.semana_ano,
            )
            .order_by(DadoEpidemiologico.data_inicio_semana.asc())
            .all()
        )

        if not query:
            continue

        # Calcula proporções globais da série como fallback seguro contra semanas esparsas
        soma_not = sum(float(r.notificados or 0) for r in query)
        soma_conf = sum(float(r.confirmados or 0) for r in query)
        taxa_conf_fallback = max(0.15, soma_conf / max(soma_not, 1.0))

        soma_0_19 = sum(float(r.idade_0_19 or 0) for r in query)
        soma_20_59 = sum(float(r.idade_20_59 or 0) for r in query)
        soma_60 = sum(float(r.idade_60_mais or 0) for r in query)

        soma_fem = sum(float(r.fem or 0) for r in query)
        soma_masc = sum(float(r.masc or 0) for r in query)

        dados_lista = []
        for r in query:
            notificados = float(r.notificados or 0)
            if notificados <= 0:
                y_val = 0.0
            else:
                # 1. Fator Modo (ampliado vs conservador)
                if modo == "conservador":
                    conf_row = float(r.confirmados or 0)
                    fator_modo = (conf_row / notificados) if conf_row > 0 else taxa_conf_fallback
                else:
                    fator_modo = 1.0

                # 2. Fator Faixa Etária (combinável com modo e sexo)
                if faixa_etaria == "0-19":
                    val_id = float(r.idade_0_19 or 0)
                    fator_idade = (val_id / notificados) if val_id > 0 else (soma_0_19 / max(soma_not, 1.0))
                elif faixa_etaria == "20-59":
                    val_id = float(r.idade_20_59 or 0)
                    fator_idade = (val_id / notificados) if val_id > 0 else (soma_20_59 / max(soma_not, 1.0))
                elif faixa_etaria == "60+":
                    val_id = float(r.idade_60_mais or 0)
                    fator_idade = (val_id / notificados) if val_id > 0 else (soma_60 / max(soma_not, 1.0))
                else:
                    fator_idade = 1.0

                # 3. Fator Sexo (combinável com modo e faixa etária)
                if sexo == "F":
                    val_sx = float(r.fem or 0)
                    fator_sexo = (val_sx / notificados) if val_sx > 0 else (soma_fem / max(soma_not, 1.0))
                elif sexo == "M":
                    val_sx = float(r.masc or 0)
                    fator_sexo = (val_sx / notificados) if val_sx > 0 else (soma_masc / max(soma_not, 1.0))
                else:
                    fator_sexo = 1.0

                y_val = notificados * fator_modo * fator_idade * fator_sexo

            dados_lista.append({
                "ds": pd.to_datetime(r.data_inicio_semana),
                "y": max(0.0, y_val),
                "semana_ano": r.semana_ano,
            })

        df_treino = pd.DataFrame(dados_lista)
        if len(df_treino) < 8:
            continue

        # Transformação log1p + growth='flat' evita que anos de megassurto (ex: Dengue 2024)
        # gerem inclinação linear negativa que zere as previsões futuras, preservando a curva sazonal.
        df_prophet = df_treino[["ds", "y"]].copy()
        df_prophet["y"] = np.log1p(df_prophet["y"].astype(float))

        model = Prophet(
            growth="flat",
            yearly_seasonality=True,
            weekly_seasonality=False,
            daily_seasonality=False,
            interval_width=0.80,
        )
        model.fit(df_prophet)

        # Cria horizonte futuro semanal a partir da última semana observada
        future = model.make_future_dataframe(periods=horizonte_semanas, freq="W")
        forecast = model.predict(future)

        ultima_data_obs = df_treino["ds"].max()
        futuro_df = forecast[forecast["ds"] > ultima_data_obs].head(horizonte_semanas).copy()

        # Calibração suave de nível com as últimas 8 semanas observadas na escala log
        ultimas_8_log = df_prophet.tail(8)["y"].mean()
        hist_pred_8_log = forecast[forecast["ds"] <= ultima_data_obs].tail(8)["yhat"].mean()
        ajuste_nivel_log = (ultimas_8_log - hist_pred_8_log) * 0.35

        futuro_df["yhat"] = np.expm1((futuro_df["yhat"] + ajuste_nivel_log).clip(lower=0.0)).clip(lower=0.0)
        futuro_df["yhat_lower"] = np.expm1((futuro_df["yhat_lower"] + ajuste_nivel_log).clip(lower=0.0)).clip(lower=0.0)
        futuro_df["yhat_upper"] = np.expm1((futuro_df["yhat_upper"] + ajuste_nivel_log).clip(lower=0.0)).clip(lower=0.0)

        # Recorta a série observada para o intervalo visual selecionado pelo usuário (dt_inicio..dt_teto_doe)
        df_visivel = df_treino[df_treino["ds"] >= pd.to_datetime(dt_inicio)].copy()
        if len(df_visivel) < 4:
            # Fallback caso o usuário selecione um mês final onde quase não há semanas
            df_visivel = df_treino.tail(8).copy()

        # Métricas para a doença baseadas no período observado recente
        ultimas_obs = df_visivel.tail(8)
        media_ultimas_8 = float(ultimas_obs["y"].mean()) if len(ultimas_obs) > 0 else 1.0
        ultimo_y = float(df_visivel.iloc[-1]["y"]) if len(df_visivel) > 0 else 0.0
        casos_recentes = max(1, int(round(ultimo_y))) if ultimo_y > 0 else 0
        soma_yhat = float(futuro_df["yhat"].sum()) if len(futuro_df) > 0 else 0.0
        casos_previstos_soma = max(1, int(round(soma_yhat))) if soma_yhat > 0 else 0
        media_semanal_prevista = float(futuro_df["yhat"].mean()) if len(futuro_df) > 0 else 0.0

        mudanca_esperada_pct = round(
            ((media_semanal_prevista - media_ultimas_8) / max(media_ultimas_8, 1.0)) * 100, 1
        )

        # Pico esperado
        if not futuro_df.empty:
            idx_pico = futuro_df["yhat"].idxmax()
            row_pico = futuro_df.loc[idx_pico]
            data_pico = row_pico["ds"]
            pico_se = f"SE {data_pico.isocalendar()[1]:02d}"
            pico_data_str = data_pico.strftime("%Y-%m-%d")
            val_pico = float(row_pico["yhat"])
            pico_casos = max(1, int(round(val_pico))) if val_pico > 0 else 0
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

        # Série histórica observada formatada (respeitando o filtro de período)
        serie_obs = []
        for _, row in df_visivel.iterrows():
            val_obs = float(row["y"])
            serie_obs.append({
                "semana_ano": row["semana_ano"],
                "data_inicio": row["ds"].strftime("%Y-%m-%d"),
                "tipo": "observado",
                "casos": max(1.0, round(val_obs, 1)) if val_obs > 0 else 0.0,
            })

        # Série futura prevista formatada
        serie_prev = []
        for _, row in futuro_df.iterrows():
            se_num = row["ds"].isocalendar()[1]
            ano_num = row["ds"].isocalendar()[0]
            se_str = f"{ano_num}{se_num:02d}"
            val_prev = float(row["yhat"])
            serie_prev.append({
                "semana_ano": se_str,
                "data_inicio": row["ds"].strftime("%Y-%m-%d"),
                "tipo": "previsto",
                "casos": max(1.0, round(val_prev, 1)) if val_prev > 0 else 0.0,
                "casos_min": round(float(row["yhat_lower"]), 1),
                "casos_max": max(1.0, round(float(row["yhat_upper"]), 1)) if float(row["yhat_upper"]) > 0 else 0.0,
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

        casos_recentes_texto = (
            f"{deng_info.get('casos_recentes', 0):,} / {flu_info.get('casos_recentes', 0):,}"
        ).replace(",", ".")
        casos_previstos_total = deng_info.get("casos_previstos", 0) + flu_info.get("casos_previstos", 0)

        mudanca_combinada = round(
            (deng_info.get("mudanca_esperada_pct", 0.0) + flu_info.get("mudanca_esperada_pct", 0.0)) / 2, 1
        )

        if deng_info.get("pico_casos", 0) >= flu_info.get("pico_casos", 0):
            pico_combinado_se = deng_info.get("pico_semana", "SE --")
            pico_combinado_data = deng_info.get("pico_data", "")
            pico_combinado_casos = deng_info.get("pico_casos", 0)
        else:
            pico_combinado_se = flu_info.get("pico_semana", "SE --")
            pico_combinado_data = flu_info.get("pico_data", "")
            pico_combinado_casos = flu_info.get("pico_casos", 0)

        tendencia_consolidada = (
            f"{deng_info.get('tendencia', 'Estável')} / {flu_info.get('tendencia', 'Estável')}"
        )

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
    mapa_pontos = defaultdict(lambda: {
        "semana_ano": "",
        "data_inicio": "",
        "tipo": "observado",
        "dengue_casos": None,
        "dengue_min": None,
        "dengue_max": None,
        "influenza_casos": None,
        "influenza_min": None,
        "influenza_max": None,
        "total_casos": 0.0,
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
            mapa_pontos[k]["total_casos"] = round(mapa_pontos[k]["total_casos"] + pt["casos"], 1)

        # Previstos
        for pt in res["serie_prevista"]:
            k = pt["semana_ano"]
            mapa_pontos[k]["semana_ano"] = k
            mapa_pontos[k]["data_inicio"] = pt["data_inicio"]
            mapa_pontos[k]["tipo"] = "previsto"
            if doe == "Dengue":
                mapa_pontos[k]["dengue_casos"] = pt["casos"]
                mapa_pontos[k]["dengue_min"] = pt.get("casos_min")
                mapa_pontos[k]["dengue_max"] = pt.get("casos_max")
            else:
                mapa_pontos[k]["influenza_casos"] = pt["casos"]
                mapa_pontos[k]["influenza_min"] = pt.get("casos_min")
                mapa_pontos[k]["influenza_max"] = pt.get("casos_max")
            mapa_pontos[k]["total_casos"] = round(mapa_pontos[k]["total_casos"] + pt["casos"], 1)

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
        "data_inicio": dt_inicio.strftime("%Y-%m"),
        "data_fim": dt_fim.strftime("%Y-%m"),
        "modo": modo,
        "faixa_etaria": faixa_etaria,
        "sexo": sexo,
        "indicadores": indicadores,
        "serie_temporal": serie_temporal_completa,
        "panorama_texto": panorama_texto,
        "distribuicao": distribuicao,
        "impacto_demanda": {
            "mensagem": mensagem_impacto,
            "materiais": impacto_materiais,
        },
        "rodape": {
            "fonte": "bases epidemiológicas públicas · dados oficiais SINAN / DATASUS",
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

        casos_previstos = resultados_doencas.get(doe_nome, {}).get("casos_previstos", 0)

        demanda_base = casos_previstos * qtd_por_exame
        demanda_projetada = round(demanda_base * 1.20, 1)

        lotes = db.query(Lote).filter(
            Lote.material_id == mat_id,
            Lote.quantidade_atual > 0,
            Lote.data_validade >= hoje,
        ).all()
        saldo_atual = float(sum(float(l.quantidade_atual) for l in lotes))

        saldo_projetado = round(saldo_atual - demanda_projetada, 1)

        if saldo_projetado < 0:
            status_risco = "CRITICO"
            mensagem_risco = "Déficit iminente frente ao pico epidemiológico previsto."
        elif saldo_atual < demanda_projetada * 1.5:
            status_risco = "ATENCAO"
            mensagem_risco = "Estoque suficiente, mas com margem de segurança estreita."
        else:
            status_risco = "SEGURO"
            mensagem_risco = "Estoque plenamente dimensionado para o horizonte previsto."

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
            "fonte": "bases epidemiológicas públicas · SINAN",
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

        if consumo_previsto_diario <= 0:
            risco_surto = "BAIXO"
        else:
            risco_surto = "ALTO" if "crescente" in tendencia else ("MODERADO" if "estável" in tendencia else "BAIXO")

        data_corte = datetime.now() - timedelta(days=90)
        consumo_historico = db.query(func.sum(MovimentacaoEstoque.quantidade)).join(Lote).filter(
            Lote.material_id == material_id,
            MovimentacaoEstoque.tipo == "USO",
            MovimentacaoEstoque.criado_em >= data_corte
        ).scalar() or 0.0

        baseline_diario_real = round(float(consumo_historico) / 90, 4)
        if baseline_diario_real == 0.0 and consumo_previsto_diario > 0:
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
