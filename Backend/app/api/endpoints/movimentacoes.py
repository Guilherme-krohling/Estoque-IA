"""
StockIA — Endpoint Movimentações de Estoque
==============================================
Cada movimentação é registrada com o usuário autenticado (auditoria).
Tipos: ENTRADA | USO | DESCARTE | AJUSTE
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from decimal import Decimal

from app.db.database import get_db
from app.models.models import MovimentacaoEstoque, Lote, Usuario
from app.schemas.movimentacao_schema import CriarMovimentacao, MovimentacaoRetorno
from app.core.security import get_current_user

router = APIRouter()


def processar_entrada(lote: Lote, quantidade: Decimal):
    """Soma ao estoque do lote."""
    lote.quantidade_atual = Decimal(str(lote.quantidade_atual)) + quantidade


def processar_saida(lote: Lote, quantidade: Decimal):
    """Subtrai do estoque do lote com validação."""
    atual = Decimal(str(lote.quantidade_atual))
    if atual < quantidade:
        raise HTTPException(
            status_code=400,
            detail=f"Estoque insuficiente neste lote! Disponível: {atual}, Solicitado: {quantidade}",
        )
    lote.quantidade_atual = atual - quantidade


@router.post("/", response_model=MovimentacaoRetorno, status_code=201)
def criar_movimentacao(
    movimentacao: CriarMovimentacao,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    # Busca o lote
    lote = db.query(Lote).filter(Lote.id == movimentacao.lote_id).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote não encontrado!")

    tipo = movimentacao.tipo.upper()
    quantidade = movimentacao.quantidade

    # Processa conforme o tipo de movimentação
    if tipo == "ENTRADA":
        processar_entrada(lote, quantidade)
    elif tipo in ("USO", "DESCARTE", "AJUSTE"):
        processar_saida(lote, quantidade)
    else:
        raise HTTPException(
            status_code=400,
            detail="Tipo inválido! Use: ENTRADA, USO, DESCARTE ou AJUSTE.",
        )

    # Cria o registro de movimentação COM o usuario_id (auditoria)
    nova_movimentacao = MovimentacaoEstoque(
        lote_id=movimentacao.lote_id,
        usuario_id=current_user.id,  # Quem fez a movimentação
        tipo=tipo,
        quantidade=quantidade,
        unidade_medida=movimentacao.unidade_medida,
        motivo=movimentacao.motivo,
        referencia=movimentacao.referencia,
    )

    db.add(nova_movimentacao)
    db.commit()
    db.refresh(nova_movimentacao)
    return nova_movimentacao


@router.get("/", response_model=List[MovimentacaoRetorno])
def listar_movimentacoes(db: Session = Depends(get_db), _user: Usuario = Depends(get_current_user)):
    return db.query(MovimentacaoEstoque).order_by(MovimentacaoEstoque.criado_em.desc()).all()


@router.get("/{movimentacao_id}", response_model=MovimentacaoRetorno)
def buscar_movimentacao(
    movimentacao_id: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    movimentacao = db.query(MovimentacaoEstoque).filter(MovimentacaoEstoque.id == movimentacao_id).first()
    if not movimentacao:
        raise HTTPException(status_code=404, detail="Movimentação não encontrada!")
    return movimentacao


@router.get("/lote/{lote_id}", response_model=List[MovimentacaoRetorno])
def listar_movimentacoes_por_lote(
    lote_id: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    """Histórico completo de movimentações de um lote específico."""
    return (
        db.query(MovimentacaoEstoque)
        .filter(MovimentacaoEstoque.lote_id == lote_id)
        .order_by(MovimentacaoEstoque.criado_em.desc())
        .all()
    )