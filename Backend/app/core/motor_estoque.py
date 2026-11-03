"""
Laurus AI — Motor de Estoque Determinístico e Algorítmico
========================================================
Calcula cobertura de dias, Média Móvel Ponderada (MMP), Ponto de Reposição (ROP),
Estoque de Segurança, risco de ruptura e recomendação de compra com matemática
pura e auditável — sem IA generativa.

Inclui o cruzamento determinístico com Previsões Epidemiológicas Salvas no banco.
"""

import json
from datetime import datetime, timedelta, date
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func, Date, cast

from app.models.models import (
    Material,
    Lote,
    MovimentacaoEstoque,
    Doenca,
    PrevisaoSalva,
    PedidoReposicao,
    materiais_doencas,
)


# =====================================================================
# CONSTANTES E THRESHOLDS PADRÃO
# =====================================================================
LEAD_TIME_PADRAO_DIAS = 15          # Prazo médio de entrega dos fornecedores (dias)
JANELA_CONSUMO_DIAS = 90            # Últimos 90 dias para calcular consumo histórico
ESTOQUE_SEGURANCA_PORCENTO = 0.20   # 20% sobre a demanda no lead time (margem de segurança)


# =====================================================================
# SCHEMA DE SAÍDA — dicionário tipado (Retrocompatibilidade)
# =====================================================================
def _resultado_vazio(material_id: int, motivo: str) -> dict:
    return {
        "material_id": material_id,
        "nome": None,
        "saldo_atual": 0.0,
        "unidade_medida": "un",
        "consumo_diario_medio": 0.0,
        "cobertura_dias": None,
        "lead_time_dias": LEAD_TIME_PADRAO_DIAS,
        "estoque_minimo": 0.0,
        "estoque_seguranca": 0.0,
        "quantidade_recomendada_comprar": 0.0,
        "risco": "DADOS_INSUFICIENTES",
        "classificacao": "MONITORAR",
        "mensagem": motivo,
        "lotes_ativos": [],
        "calculado_em": datetime.now().isoformat(),
    }


# =====================================================================
# 1. FUNÇÃO DE COBERTURA INDIVIDUAL (Mantida para compatibilidade)
# =====================================================================
def calcular_cobertura(
    material_id: int,
    db: Session,
    consumo_diario_projetado: Optional[float] = None,
) -> dict:
    """
    Calcula todos os indicadores de estoque para um material com matemática pura.
    """
    material = db.query(Material).filter(Material.id == material_id, Material.ativo.is_(True)).first()
    if not material:
        return _resultado_vazio(material_id, f"Material ID {material_id} não encontrado ou inativo.")

    hoje = date.today()

    lotes_ativos = (
        db.query(Lote)
        .filter(
            Lote.material_id == material_id,
            Lote.quantidade_atual > 0,
            Lote.data_validade >= hoje,
        )
        .order_by(Lote.data_validade.asc())  # FEFO
        .all()
    )

    saldo_atual = float(sum(float(l.quantidade_atual) for l in lotes_ativos))

    lotes_info = [
        {
            "lote_id": l.id,
            "numero_lote": l.numero_lote,
            "quantidade_atual": float(l.quantidade_atual),
            "data_validade": l.data_validade.isoformat(),
            "dias_para_vencer": (l.data_validade - hoje).days,
        }
        for l in lotes_ativos
    ]

    data_inicio_janela = datetime.now() - timedelta(days=JANELA_CONSUMO_DIAS)
    ids_lotes = [l.id for l in db.query(Lote).filter(Lote.material_id == material_id).all()]

    if not ids_lotes:
        return _resultado_vazio(material_id, "Nenhum lote encontrado para este material.")

    total_consumido = (
        db.query(func.coalesce(func.sum(MovimentacaoEstoque.quantidade), 0))
        .filter(
            MovimentacaoEstoque.lote_id.in_(ids_lotes),
            MovimentacaoEstoque.tipo == "USO",
            MovimentacaoEstoque.criado_em >= data_inicio_janela,
        )
        .scalar()
    )
    total_consumido = float(total_consumido or 0)

    dias_com_movimento = (
        db.query(func.count(cast(MovimentacaoEstoque.criado_em, Date).distinct()))
        .filter(
            MovimentacaoEstoque.lote_id.in_(ids_lotes),
            MovimentacaoEstoque.tipo == "USO",
            MovimentacaoEstoque.criado_em >= data_inicio_janela,
        )
        .scalar()
    ) or 1

    if consumo_diario_projetado is not None and consumo_diario_projetado > 0:
        consumo_diario_medio = round(float(consumo_diario_projetado), 4)
        origem_consumo = "PROJECAO_EPIDEMIOLOGICA"
    else:
        consumo_diario_medio = round(total_consumido / max(dias_com_movimento, 1), 4)
        origem_consumo = "HISTORICO_USO"

    if consumo_diario_medio < 0.0001:
        return {
            **_resultado_vazio(material_id, "Consumo histórico ou projetado insuficiente (< 0.0001/dia). Aguarde mais dados."),
            "nome": material.nome,
            "saldo_atual": saldo_atual,
            "unidade_medida": material.unidade_medida,
            "estoque_minimo": float(material.estoque_minimo or 0),
            "lotes_ativos": lotes_info,
            "origem_consumo": origem_consumo,
        }

    lead_time = LEAD_TIME_PADRAO_DIAS
    cobertura_dias = round(saldo_atual / consumo_diario_medio, 1)

    consumo_no_lead_time = consumo_diario_medio * lead_time
    estoque_seguranca = round(consumo_no_lead_time * ESTOQUE_SEGURANCA_PORCENTO, 2)
    estoque_minimo = float(material.estoque_minimo or 0)

    if cobertura_dias < lead_time:
        risco = "ALTO"
        classificacao = "COMPRAR"
        mensagem = (
            f"RISCO ALTO: Cobertura atual ({cobertura_dias} dias) menor que o lead time "
            f"do fornecedor ({lead_time} dias). Há risco de ruptura de estoque antes da chegada "
            f"de nova remessa. Ação imediata recomendada."
        )
    elif cobertura_dias < lead_time * 1.5:
        risco = "MODERADO"
        classificacao = "MONITORAR"
        mensagem = (
            f"RISCO MODERADO: Cobertura ({cobertura_dias} dias) próxima ao lead time "
            f"({lead_time} dias). Monitore o consumo. Emita pedido preventivo se a demanda aumentar."
        )
    elif saldo_atual <= estoque_minimo and estoque_minimo > 0:
        risco = "MODERADO"
        classificacao = "COMPRAR"
        mensagem = (
            f"Saldo atual ({saldo_atual} {material.unidade_medida}) abaixo ou igual ao "
            f"estoque mínimo configurado ({estoque_minimo}). Reposição recomendada."
        )
    else:
        risco = "BAIXO"
        classificacao = "ESTOQUE_OK"
        mensagem = (
            f"Estoque adequado. Cobertura de {cobertura_dias} dias com consumo médio de "
            f"{consumo_diario_medio} {material.unidade_medida}/dia."
        )

    periodo_cobertura = lead_time + 30
    necessidade_bruta = (consumo_diario_medio * periodo_cobertura) + estoque_seguranca
    quantidade_recomendada = max(0.0, round(necessidade_bruta - saldo_atual, 2))

    if material.estoque_maximo:
        teto = float(material.estoque_maximo) - saldo_atual
        quantidade_recomendada = min(quantidade_recomendada, max(0.0, teto))

    return {
        "material_id": material_id,
        "nome": material.nome,
        "unidade_medida": material.unidade_medida,
        "saldo_atual": saldo_atual,
        "consumo_diario_medio": consumo_diario_medio,
        "janela_consumo_dias": JANELA_CONSUMO_DIAS,
        "cobertura_dias": cobertura_dias,
        "lead_time_dias": lead_time,
        "estoque_minimo": estoque_minimo,
        "estoque_maximo": float(material.estoque_maximo) if material.estoque_maximo else None,
        "estoque_seguranca": estoque_seguranca,
        "quantidade_recomendada_comprar": quantidade_recomendada,
        "risco": risco,
        "classificacao": classificacao,
        "mensagem": mensagem,
        "lotes_ativos": lotes_info,
        "calculado_em": datetime.now().isoformat(),
    }


def calcular_cobertura_todos(db: Session, apenas_criticos: bool = False) -> list[dict]:
    """
    Calcula a cobertura de todos os materiais ativos.
    """
    materiais = db.query(Material).filter(Material.ativo.is_(True)).all()
    resultados = []

    for mat in materiais:
        r = calcular_cobertura(mat.id, db)
        if apenas_criticos and r["classificacao"] not in ("COMPRAR",):
            continue
        resultados.append(r)

    ordem = {"ALTO": 0, "MODERADO": 1, "BAIXO": 2, "DADOS_INSUFICIENTES": 3}
    resultados.sort(key=lambda x: ordem.get(x["risco"], 99))

    return resultados


# =====================================================================
# 2. MOTOR ALGORÍTMICO E MATEMÁTICO DE ESTOQUE + PREVISÃO SALVA (FASE 2)
# =====================================================================
def analisar_estoque_algoritmico(
    db: Session,
    previsao_salva_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Realiza a análise 100% matemática, determinística e auditável do estoque:
      1. Calcula o consumo histórico real por Média Móvel Ponderada (MMP 30/60/90 dias)
         e inclinação de tendência por Regressão Linear Simples.
      2. Se previsao_salva_id for informada, lê o snapshot salvo no banco e
         calcula o impacto exato daquela previsão epidemiológica sobre cada insumo.
      3. Aplica thresholds configuráveis:
         - Estoque Mínimo
         - Estoque de Segurança (20%)
         - Ponto de Reposição (Reorder Point = Consumo no Lead Time + Estoque Segurança)
         - Quantidade Sugerida para Compra no Horizonte
    """
    hoje = date.today()
    agora = datetime.now()

    # 1. Busca a Previsão Epidemiológica Salva (se selecionada no Dropdown)
    previsao_info = None
    casos_por_doenca: Dict[str, int] = {"Dengue": 0, "Influenza": 0}
    horizonte_semanas = 8

    if previsao_salva_id is not None:
        prev = db.query(PrevisaoSalva).filter(PrevisaoSalva.id == previsao_salva_id).first()
        if prev:
            horizonte_semanas = max(1, int(prev.horizonte_semanas or 8))
            casos_por_doenca["Dengue"] = int(prev.casos_dengue_previstos or 0)
            casos_por_doenca["Influenza"] = int(prev.casos_influenza_previstos or 0)
            previsao_info = {
                "id": prev.id,
                "nome": prev.nome,
                "titulo": prev.nome,
                "doenca": prev.doenca,
                "localidades": prev.localidades,
                "data_inicio": prev.data_inicio,
                "data_fim": prev.data_fim,
                "horizonte_semanas": prev.horizonte_semanas,
                "horizonte_dias": horizonte_semanas * 7,
                "modo": prev.modo,
                "faixa_etaria": prev.faixa_etaria,
                "sexo": prev.sexo,
                "grau_confianca": (prev.grau_confianca / 100.0) if (prev.grau_confianca and prev.grau_confianca > 1.0) else (prev.grau_confianca or 0.80),
                "casos_previstos": prev.casos_previstos_total,
                "casos_previstos_total": prev.casos_previstos_total,
                "casos_dengue_previstos": prev.casos_dengue_previstos,
                "casos_influenza_previstos": prev.casos_influenza_previstos,
                "mudanca_esperada_pct": prev.mudanca_esperada_pct,
                "pico_semana": prev.pico_semana,
                "pico_data": prev.pico_data,
                "pico_casos": prev.pico_casos,
                "tendencia": prev.tendencia,
                "criado_em": prev.criado_em.strftime("%d/%m/%Y %H:%M") if prev.criado_em else "",
            }

    horizonte_dias = horizonte_semanas * 7

    # 2. Mapeia vínculos entre materiais e doenças (BOM: quantidade_por_exame)
    vinculos_rows = (
        db.query(
            materiais_doencas.c.material_id,
            Doenca.nome.label("doenca_nome"),
            materiais_doencas.c.quantidade_por_exame,
            materiais_doencas.c.unidade_por_exame,
        )
        .join(Doenca, materiais_doencas.c.doenca_id == Doenca.id)
        .all()
    )
    mapa_vinculos: Dict[int, List[Dict[str, Any]]] = {}
    for vr in vinculos_rows:
        mapa_vinculos.setdefault(vr[0], []).append({
            "doenca": vr[1],
            "quantidade_por_exame": float(vr[2] or 1.0),
            "unidade_por_exame": vr[3] or "un",
        })

    # 3. Analisa todos os materiais ativos
    materiais = db.query(Material).filter(Material.ativo.is_(True)).all()
    itens_analisados = []

    dt_30 = agora - timedelta(days=30)
    dt_60 = agora - timedelta(days=60)
    dt_90 = agora - timedelta(days=90)

    for mat in materiais:
        # Saldo físico atual não vencido (FEFO)
        lotes_validos = (
            db.query(Lote)
            .filter(
                Lote.material_id == mat.id,
                Lote.quantidade_atual > 0,
                Lote.data_validade >= hoje,
            )
            .all()
        )
        saldo_atual = round(float(sum(float(l.quantidade_atual) for l in lotes_validos)), 2)

        todos_lotes_ids = [l.id for l in db.query(Lote.id).filter(Lote.material_id == mat.id).all()]

        # Cálculo de Média Móvel Ponderada (MMP) em 3 janelas de 30 dias (pesos: 0.50, 0.30, 0.20)
        uso_0_30 = 0.0
        uso_31_60 = 0.0
        uso_61_90 = 0.0

        if todos_lotes_ids:
            movs = (
                db.query(MovimentacaoEstoque.quantidade, MovimentacaoEstoque.criado_em)
                .filter(
                    MovimentacaoEstoque.lote_id.in_(todos_lotes_ids),
                    MovimentacaoEstoque.tipo == "USO",
                    MovimentacaoEstoque.criado_em >= dt_90,
                )
                .all()
            )
            for qtd, criado_em in movs:
                val_q = float(qtd or 0)
                if criado_em and criado_em >= dt_30:
                    uso_0_30 += val_q
                elif criado_em and criado_em >= dt_60:
                    uso_31_60 += val_q
                else:
                    uso_61_90 += val_q

        media_diaria_30 = uso_0_30 / 30.0
        media_diaria_60 = uso_31_60 / 30.0
        media_diaria_90 = uso_61_90 / 30.0

        # Média Móvel Ponderada (MMP)
        mmp_diaria = round((0.50 * media_diaria_30) + (0.30 * media_diaria_60) + (0.20 * media_diaria_90), 4)

        # Regressão Linear Simples sobre as 3 janelas mensais: x = [1, 2, 3], y = [m90, m60, m30]
        inclinacao_mensal = round((media_diaria_30 - media_diaria_90) / 2.0, 4)
        if inclinacao_mensal > 0.05:
            tendencia_consumo = "Crescente"
        elif inclinacao_mensal < -0.05:
            tendencia_consumo = "Decrescente"
        else:
            tendencia_consumo = "Estável"

        # Demanda histórica basal para o horizonte (Média Móvel Ponderada × dias do horizonte)
        demanda_historica_horizonte = round(mmp_diaria * horizonte_dias, 1)

        # Demanda adicional oriunda da Previsão Epidemiológica Salva selecionada
        vinculos_mat = mapa_vinculos.get(mat.id, [])
        doencas_vinculadas = [v["doenca"] for v in vinculos_mat]
        demanda_epidemiologica_horizonte = 0.0
        detalhe_conversao = []

        if previsao_info:
            for v in vinculos_mat:
                doe_v = v["doenca"]
                qtd_exame = v["quantidade_por_exame"]
                casos_doe = casos_por_doenca.get(doe_v, 0)
                if casos_doe > 0:
                    dem_doe = round(casos_doe * qtd_exame, 1)
                    demanda_epidemiologica_horizonte += dem_doe
                    detalhe_conversao.append(f"{casos_doe} casos {doe_v} × {qtd_exame} {mat.unidade_medida}")

        demanda_epidemiologica_horizonte = round(demanda_epidemiologica_horizonte, 1)

        # Demanda total combinada no horizonte
        # Se houver previsão epidemiológica ativa para este material, usa o maior impacto entre
        # a demanda epidemiológica projetada (+ consumo basal de rotina) ou a MMP pura.
        if demanda_epidemiologica_horizonte > 0:
            demanda_total_horizonte = round(demanda_historica_horizonte + demanda_epidemiologica_horizonte, 1)
        else:
            demanda_total_horizonte = demanda_historica_horizonte

        consumo_diario_combinado = round(demanda_total_horizonte / max(horizonte_dias, 1), 4)

        # Thresholds configuráveis e matemáticos
        lead_time = LEAD_TIME_PADRAO_DIAS
        estoque_minimo = round(float(mat.estoque_minimo or 0), 2)
        consumo_lead_time = round(consumo_diario_combinado * lead_time, 2)
        estoque_seguranca = round(
            max(estoque_minimo * ESTOQUE_SEGURANCA_PORCENTO, consumo_lead_time * ESTOQUE_SEGURANCA_PORCENTO),
            2,
        )
        ponto_reposicao = round(max(estoque_minimo, consumo_lead_time + estoque_seguranca), 2)

        # Cobertura em dias
        if consumo_diario_combinado > 0.0001:
            cobertura_dias = round(saldo_atual / consumo_diario_combinado, 1)
        else:
            cobertura_dias = 999.0

        # Quantidade recomendada de compra (Matemática determinística e auditável)
        # Considera também o saldo de entregas pendentes já pedidas na Fase 4.1
        saldo_entregas_pendentes = 0.0
        try:
            pedidos_abertos = (
                db.query(PedidoReposicao)
                .filter(
                    PedidoReposicao.material_id == mat.id,
                    PedidoReposicao.status.in_(["PENDENTE", "PARCIAL"]),
                )
                .all()
            )
            for ped in pedidos_abertos:
                faltante_ped = float(ped.quantidade_solicitada or 0) - float(ped.quantidade_recebida or 0)
                if faltante_ped > 0:
                    saldo_entregas_pendentes += faltante_ped
        except Exception:
            saldo_entregas_pendentes = 0.0
        saldo_entregas_pendentes = round(saldo_entregas_pendentes, 2)

        necessidade_total = round(demanda_total_horizonte + estoque_seguranca, 2)
        if saldo_atual < ponto_reposicao:
            necessidade_total = max(necessidade_total, round(ponto_reposicao + estoque_seguranca, 2))

        quantidade_comprar = max(0.0, round(necessidade_total - (saldo_atual + saldo_entregas_pendentes), 1))
        if mat.estoque_maximo:
            teto_max = max(0.0, float(mat.estoque_maximo) - (saldo_atual + saldo_entregas_pendentes))
            if teto_max > 0:
                quantidade_comprar = min(quantidade_comprar, round(teto_max, 1))

        # Classificação determinística por Thresholds
        if saldo_atual <= estoque_minimo or cobertura_dias < lead_time or saldo_atual < demanda_total_horizonte:
            status_alerta = "CRITICO"
            acao_recomendada = "COMPRAR IMEDIATO"
            motivo_alerta = (
                f"Saldo ({saldo_atual}) insuficiente para a demanda projetada ({demanda_total_horizonte}) "
                f"ou abaixo do mínimo ({estoque_minimo})."
            )
        elif saldo_atual <= ponto_reposicao or cobertura_dias < (lead_time * 1.8):
            status_alerta = "ATENCAO"
            acao_recomendada = "PROGRAMAR REPOSIÇÃO"
            motivo_alerta = (
                f"Saldo ({saldo_atual}) atingiu a faixa do Ponto de Reposição ({ponto_reposicao})."
            )
        else:
            status_alerta = "SEGURO"
            acao_recomendada = "ESTOQUE ADEQUADO"
            motivo_alerta = "Saldo acima do ponto de reposição e da demanda projetada."

        risco_label = "ALTO" if status_alerta == "CRITICO" else ("MODERADO" if status_alerta == "ATENCAO" else "BAIXO")

        itens_analisados.append({
            "material_id": mat.id,
            "nome": mat.nome,
            "unidade_medida": mat.unidade_medida or "un",
            "doencas_vinculadas": doencas_vinculadas,
            "saldo_atual": saldo_atual,
            "saldo_entregas_pendentes": saldo_entregas_pendentes,
            "estoque_minimo": estoque_minimo,
            "estoque_seguranca": estoque_seguranca,
            "ponto_reposicao": ponto_reposicao,
            "lead_time_dias": lead_time,
            "mmp_consumo_diario": mmp_diaria,
            "consumo_diario_mmp": mmp_diaria,
            "tendencia_consumo_historico": tendencia_consumo,
            "tendencia_consumo": tendencia_consumo.lower(),
            "demanda_historica_horizonte": demanda_historica_horizonte,
            "demanda_epidemiologica_horizonte": demanda_epidemiologica_horizonte,
            "detalhe_conversao_epidemiologica": " + ".join(detalhe_conversao) if detalhe_conversao else "Sem vínculo na previsão ativa",
            "demanda_total_horizonte": demanda_total_horizonte,
            "consumo_diario_projetado": consumo_diario_combinado,
            "cobertura_dias": cobertura_dias,
            "quantidade_sugerida_compra": quantidade_comprar,
            "quantidade_recomendada_comprar": quantidade_comprar,
            "status_alerta": status_alerta,
            "risco": risco_label,
            "acao_recomendada": acao_recomendada,
            "motivo_alerta": motivo_alerta,
            "horizonte_dias": horizonte_dias,
        })

    ordem_status = {"CRITICO": 0, "ATENCAO": 1, "SEGURO": 2}
    itens_analisados.sort(
        key=lambda x: (
            ordem_status.get(x["status_alerta"], 9),
            -x["quantidade_sugerida_compra"],
            -x["demanda_total_horizonte"],
        )
    )

    resumo = {
        "total_materiais": len(itens_analisados),
        "total_criticos": sum(1 for i in itens_analisados if i["status_alerta"] == "CRITICO"),
        "total_atencao": sum(1 for i in itens_analisados if i["status_alerta"] == "ATENCAO"),
        "total_seguros": sum(1 for i in itens_analisados if i["status_alerta"] == "SEGURO"),
        "horizonte_dias": horizonte_dias,
        "metodo_calculo": (
            "Média Móvel Ponderada (30/60/90d) + Demanda Epidemiológica (Previsão Salva) + Thresholds (ROP / Estoque Segurança 20%)"
            if previsao_info
            else "Média Móvel Ponderada (30/60/90d) + Thresholds (Ponto de Reposição / Estoque Segurança 20%)"
        ),
    }

    return {
        "previsao_selecionada": previsao_info,
        "previsao_aplicada": previsao_info,
        "resumo": resumo,
        "materiais": itens_analisados,
        "calculado_em": datetime.now().strftime("%d/%m/%Y às %H:%M"),
    }
