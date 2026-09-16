"""
StockIA — Motor de Estoque Determinístico
==========================================
Calcula cobertura de dias, risco de ruptura e recomendação de compra
com matemática pura — sem IA generativa. O Gemini só lê os resultados
deste motor para gerar texto explicativo.

Fluxo:
  1. Recebe material_id
  2. Busca saldo atual dos lotes (FEFO)
  3. Calcula consumo médio diário via histórico real de USO
  4. Busca lead time do fornecedor (campo lead_time_dias — usa padrão 15 se ausente)
  5. Calcula cobertura_dias = saldo / consumo_diario
  6. Compara cobertura vs. lead_time → classifica risco
  7. Calcula quantidade recomendada a comprar

Uso:
    from app.core.motor_estoque import calcular_cobertura
    resultado = calcular_cobertura(material_id=3, db=session)
"""

from datetime import datetime, timedelta, date
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, Date, cast

from app.models.models import Material, Lote, MovimentacaoEstoque


# =====================================================================
# CONSTANTES
# =====================================================================
LEAD_TIME_PADRAO_DIAS = 15     # Usado quando fornecedor não tem lead_time definido
JANELA_CONSUMO_DIAS = 90       # Últimos 90 dias para calcular consumo médio
ESTOQUE_SEGURANCA_PORCENTO = 0.20  # 20% sobre o consumo no lead time (margem de segurança)


# =====================================================================
# SCHEMA DE SAÍDA — dicionário tipado
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
# FUNÇÃO PRINCIPAL
# =====================================================================
def calcular_cobertura(material_id: int, db: Session) -> dict:
    """
    Calcula todos os indicadores de estoque para um material.

    Returns:
        dict com:
          - saldo_atual         : saldo somado de todos os lotes não vencidos
          - consumo_diario_medio: média dos últimos 90 dias de USO
          - cobertura_dias      : saldo / consumo_diario
          - lead_time_dias      : prazo de entrega do fornecedor
          - quantidade_recomendada_comprar: quanto pedir agora
          - classificacao       : 'COMPRAR' | 'MONITORAR' | 'ESTOQUE_OK' | 'DADOS_INSUFICIENTES'
          - risco               : 'ALTO' | 'MODERADO' | 'BAIXO' | 'DADOS_INSUFICIENTES'
          - mensagem            : texto explicativo do diagnóstico
    """

    # --- 1. Busca o material ---
    material = db.query(Material).filter(Material.id == material_id, Material.ativo.is_(True)).first()
    if not material:
        return _resultado_vazio(material_id, f"Material ID {material_id} não encontrado ou inativo.")

    hoje = date.today()

    # --- 2. Lotes válidos com saldo ---
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

    # --- 3. Consumo médio diário (últimos JANELA_CONSUMO_DIAS dias) ---
    data_inicio_janela = datetime.now() - timedelta(days=JANELA_CONSUMO_DIAS)

    # Busca IDs dos lotes deste material (incluindo vencidos, pois o histórico deve cobrir tudo)
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

    # Conta dias úteis distintos com pelo menos uma movimentação (para média real)
    dias_com_movimento = (
        db.query(func.count(cast(MovimentacaoEstoque.criado_em, Date).distinct()))
        .filter(
            MovimentacaoEstoque.lote_id.in_(ids_lotes),
            MovimentacaoEstoque.tipo == "USO",
            MovimentacaoEstoque.criado_em >= data_inicio_janela,
        )
        .scalar()
    ) or 1  # evita divisão por zero

    consumo_diario_medio = round(total_consumido / max(dias_com_movimento, 1), 4)

    if consumo_diario_medio < 0.0001:
        return {
            **_resultado_vazio(material_id, "Consumo histórico insuficiente (< 0.0001/dia). Aguarde mais dados."),
            "nome": material.nome,
            "saldo_atual": saldo_atual,
            "unidade_medida": material.unidade_medida,
            "estoque_minimo": float(material.estoque_minimo or 0),
            "lotes_ativos": lotes_info,
        }

    # --- 4. Lead time do fornecedor ---
    # Se o fornecedor tiver o campo lead_time_dias no futuro, usar aqui.
    # Por ora, usamos padrão de 15 dias para todos os fornecedores.
    lead_time = LEAD_TIME_PADRAO_DIAS

    # --- 5. Cobertura em dias ---
    cobertura_dias = round(saldo_atual / consumo_diario_medio, 1)

    # --- 6. Estoque de segurança ---
    consumo_no_lead_time = consumo_diario_medio * lead_time
    estoque_seguranca = round(consumo_no_lead_time * ESTOQUE_SEGURANCA_PORCENTO, 2)
    estoque_minimo = float(material.estoque_minimo or 0)

    # --- 7. Classificação de risco ---
    # ALTO: cobertura < lead_time (vai acabar antes do pedido chegar)
    # MODERADO: cobertura < lead_time * 1.5 (margem estreita)
    # BAIXO: cobertura >= lead_time * 1.5
    if cobertura_dias < lead_time:
        risco = "ALTO"
        classificacao = "COMPRAR"
        mensagem = (
            f"⚠️ RISCO ALTO: Cobertura atual ({cobertura_dias} dias) menor que o lead time "
            f"do fornecedor ({lead_time} dias). Há risco de ruptura de estoque antes da chegada "
            f"de nova remessa. Ação imediata recomendada."
        )
    elif cobertura_dias < lead_time * 1.5:
        risco = "MODERADO"
        classificacao = "MONITORAR"
        mensagem = (
            f"⚡ RISCO MODERADO: Cobertura ({cobertura_dias} dias) próxima ao lead time "
            f"({lead_time} dias). Monitore o consumo. Emita pedido preventivo se a demanda aumentar."
        )
    elif saldo_atual <= estoque_minimo and estoque_minimo > 0:
        risco = "MODERADO"
        classificacao = "COMPRAR"
        mensagem = (
            f"📦 Saldo atual ({saldo_atual} {material.unidade_medida}) abaixo ou igual ao "
            f"estoque mínimo configurado ({estoque_minimo}). Reposição recomendada."
        )
    else:
        risco = "BAIXO"
        classificacao = "ESTOQUE_OK"
        mensagem = (
            f"✅ Estoque adequado. Cobertura de {cobertura_dias} dias com consumo médio de "
            f"{consumo_diario_medio} {material.unidade_medida}/dia."
        )

    # --- 8. Quantidade recomendada a comprar ---
    # Fórmula: consumo previsto no período = lead_time + 30 dias de folga
    # + estoque de segurança - saldo atual
    periodo_cobertura = lead_time + 30
    necessidade_bruta = (consumo_diario_medio * periodo_cobertura) + estoque_seguranca
    quantidade_recomendada = max(0.0, round(necessidade_bruta - saldo_atual, 2))

    # Respeita o estoque máximo configurado
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
        "classificacao": classificacao,  # COMPRAR | MONITORAR | ESTOQUE_OK
        "mensagem": mensagem,
        "lotes_ativos": lotes_info,
        "calculado_em": datetime.now().isoformat(),
    }


def calcular_cobertura_todos(db: Session, apenas_criticos: bool = False) -> list[dict]:
    """
    Calcula a cobertura de todos os materiais ativos.
    Se apenas_criticos=True, retorna somente os que precisam de compra.
    """
    materiais = db.query(Material).filter(Material.ativo.is_(True)).all()
    resultados = []

    for mat in materiais:
        r = calcular_cobertura(mat.id, db)
        if apenas_criticos and r["classificacao"] not in ("COMPRAR",):
            continue
        resultados.append(r)

    # Ordena por risco: ALTO primeiro
    ordem = {"ALTO": 0, "MODERADO": 1, "BAIXO": 2, "DADOS_INSUFICIENTES": 3}
    resultados.sort(key=lambda x: ordem.get(x["risco"], 99))

    return resultados
