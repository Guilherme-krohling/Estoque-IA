"""
StockIA — Endpoint Lotes
===========================
CRUD de lotes com controle FEFO (First Expired, First Out).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.models import Lote, Material, MovimentacaoEstoque, Usuario
from app.schemas.lote_schema import CriarLote, AtualizarLote, LoteRetorno
from app.core.security import get_current_user

router = APIRouter()


@router.post("/", response_model=LoteRetorno, status_code=201)
def criar_lote(
    lote: CriarLote,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    # Verifica se o material existe
    material = db.query(Material).filter(Material.id == lote.material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material não encontrado.")

    dados = lote.model_dump()
    quantidade_inicial = dados.pop("quantidade_inicial", 0) or 0

    # Lote nasce com saldo 0; o saldo de abertura entra via movimentação (rastreabilidade).
    novo_lote = Lote(**dados, quantidade_atual=0)
    db.add(novo_lote)
    db.flush()  # garante novo_lote.id sem encerrar a transação

    if quantidade_inicial > 0:
        novo_lote.quantidade_atual = quantidade_inicial
        db.add(
            MovimentacaoEstoque(
                lote_id=novo_lote.id,
                usuario_id=current_user.id,
                tipo="ENTRADA",
                quantidade=quantidade_inicial,
                motivo="Saldo de abertura do lote",
            )
        )

    db.commit()
    db.refresh(novo_lote)
    return novo_lote


@router.get("/", response_model=List[LoteRetorno])
def listar_lotes(db: Session = Depends(get_db), _user: Usuario = Depends(get_current_user)):
    return db.query(Lote).order_by(Lote.data_validade.asc()).all()  # FEFO: vence primeiro, aparece primeiro


@router.get("/{lote_id}", response_model=LoteRetorno)
def buscar_lote(
    lote_id: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    lote = db.query(Lote).filter(Lote.id == lote_id).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote não encontrado.")
    return lote


@router.get("/material/{material_id}", response_model=List[LoteRetorno])
def listar_lotes_por_material(
    material_id: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    """Lista todos os lotes de um material específico, ordenados por FEFO."""
    return (
        db.query(Lote)
        .filter(Lote.material_id == material_id)
        .order_by(Lote.data_validade.asc())
        .all()
    )


@router.put("/{lote_id}", response_model=LoteRetorno)
def atualizar_lote(
    lote_id: int,
    dados: AtualizarLote,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    lote = db.query(Lote).filter(Lote.id == lote_id).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote não encontrado.")

    for key, value in dados.model_dump().items():
        setattr(lote, key, value)

    db.commit()
    db.refresh(lote)
    return lote


@router.delete("/{lote_id}")
def deletar_lote(
    lote_id: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    lote = db.query(Lote).filter(Lote.id == lote_id).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote não encontrado.")

    if lote.movimentacoes:
        raise HTTPException(
            status_code=400,
            detail="Não é possível excluir lote com movimentações registradas.",
        )

    db.delete(lote)
    db.commit()
    return {"mensagem": "Lote deletado com sucesso!"}