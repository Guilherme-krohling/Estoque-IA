"""
StockIA — Endpoints de Relatórios Operacionais
================================================
Alimentam os cards do dashboard, telas de Alertas e Reposição.
"""

from datetime import date, timedelta
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.db.database import get_db
from app.models.models import Material, Lote, Usuario, Fornecedor
from app.core.security import get_current_user

router = APIRouter()


@router.get("/estoque-critico")
def estoque_critico(db: Session = Depends(get_db), _user: Usuario = Depends(get_current_user)):
    """Materiais cujo saldo total (soma dos lotes) está no ou abaixo do estoque mínimo."""
    materiais = (
        db.query(Material)
        .options(joinedload(Material.fornecedor), joinedload(Material.lotes))
        .filter(Material.ativo == True)
        .filter(Material.estoque_minimo != None)
        .filter(Material.estoque_minimo > 0)
        .all()
    )

    resultado = []
    for material in materiais:
        saldo_val = sum((lote.quantidade_atual or 0) for lote in material.lotes)
        lotes_ativos = [l for l in material.lotes if (l.quantidade_atual or 0) > 0]
        
        if Decimal(str(saldo_val)) <= Decimal(str(material.estoque_minimo)):
            sugestao_comprar = max(0, float(Decimal(str(material.estoque_minimo)) - Decimal(str(saldo_val))))
            resultado.append({
                "material_id": material.id,
                "nome": material.nome,
                "codigo_catalogo": material.codigo_catalogo or "S/R",
                "fabricante": material.fabricante or "-",
                "fornecedor_nome": material.fornecedor.nome if material.fornecedor else "-",
                "unidade_medida": material.unidade_medida or "un",
                "saldo_atual": float(saldo_val),
                "estoque_minimo": float(material.estoque_minimo),
                "qtd_lotes": len(lotes_ativos),
                "sugestao_comprar": sugestao_comprar,
                "status": "Faltante" if saldo_val == 0 else "Baixo",
            })
    return resultado


@router.get("/reposicao")
def relatorio_reposicao(db: Session = Depends(get_db), _user: Usuario = Depends(get_current_user)):
    """Relatório completo de materiais monitorados para reposição."""
    todos_materiais = (
        db.query(Material)
        .options(joinedload(Material.fornecedor), joinedload(Material.lotes))
        .filter(Material.ativo == True)
        .all()
    )

    monitorados = []
    para_repor = []
    faltantes = []
    sugestao_total_qtd = 0.0

    for m in todos_materiais:
        saldo_val = sum((lote.quantidade_atual or 0) for lote in m.lotes)
        est_min = float(m.estoque_minimo or 0)

        if est_min > 0:
            item_data = {
                "material_id": m.id,
                "nome": m.nome,
                "codigo_catalogo": m.codigo_catalogo or "S/R",
                "fabricante": m.fabricante or "-",
                "fornecedor_nome": m.fornecedor.nome if m.fornecedor else "-",
                "unidade_medida": m.unidade_medida or "un",
                "saldo_atual": float(saldo_val),
                "estoque_minimo": est_min,
                "sugestao_comprar": max(0.0, est_min - float(saldo_val)),
                "status": "Faltante" if saldo_val == 0 else ("Baixo" if saldo_val <= est_min else "OK"),
            }
            monitorados.append(item_data)
            if saldo_val <= est_min:
                para_repor.append(item_data)
                sugestao_total_qtd += item_data["sugestao_comprar"]
            if saldo_val == 0:
                faltantes.append(item_data)

    return {
        "resumo": {
            "total_monitorados": len(monitorados),
            "total_para_repor": len(para_repor),
            "total_faltantes": len(faltantes),
            "sugestao_total_qtd": sugestao_total_qtd,
        },
        "itens": para_repor,
    }


@router.get("/lotes-vencendo")
def lotes_vencendo(
    dias: int = Query(60, ge=1, le=365),
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    """Lotes com saldo > 0 que vencem nos próximos N dias (ainda não vencidos)."""
    hoje = date.today()
    limite = hoje + timedelta(days=dias)
    lotes = (
        db.query(Lote)
        .options(joinedload(Lote.material), joinedload(Lote.local))
        .filter(Lote.quantidade_atual > 0)
        .filter(Lote.data_validade >= hoje)
        .filter(Lote.data_validade <= limite)
        .order_by(Lote.data_validade.asc())
        .all()
    )
    return [
        {
            "lote_id": l.id,
            "numero_lote": l.numero_lote,
            "material": l.material.nome if l.material else "Desconhecido",
            "material_id": l.material_id,
            "local_nome": l.local.nome if l.local else "-",
            "saldo": float(l.quantidade_atual or 0),
            "data_validade": l.data_validade.isoformat(),
            "dias_para_vencer": (l.data_validade - hoje).days,
            "status": "Crítico" if (l.data_validade - hoje).days <= 30 else "Atenção",
        }
        for l in lotes
    ]


@router.get("/lotes-vencidos")
def lotes_vencidos(db: Session = Depends(get_db), _user: Usuario = Depends(get_current_user)):
    """Lotes já vencidos que ainda têm saldo (precisam de descarte)."""
    hoje = date.today()
    lotes = (
        db.query(Lote)
        .options(joinedload(Lote.material), joinedload(Lote.local))
        .filter(Lote.quantidade_atual > 0)
        .filter(Lote.data_validade < hoje)
        .order_by(Lote.data_validade.asc())
        .all()
    )
    return [
        {
            "lote_id": l.id,
            "numero_lote": l.numero_lote,
            "material": l.material.nome if l.material else "Desconhecido",
            "material_id": l.material_id,
            "local_nome": l.local.nome if l.local else "-",
            "saldo": float(l.quantidade_atual or 0),
            "data_validade": l.data_validade.isoformat(),
            "dias_vencido": (hoje - l.data_validade).days,
            "status": "Vencido",
        }
        for l in lotes
    ]
