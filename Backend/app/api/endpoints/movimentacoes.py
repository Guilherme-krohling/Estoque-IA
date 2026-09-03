"""
StockIA — Endpoint Movimentações de Estoque
==============================================
Cada movimentação é registrada com o usuário autenticado (auditoria).
Tipos: ENTRADA | USO | DESCARTE | AJUSTE

Efeito de cada tipo sobre lote.quantidade_atual:
  - ENTRADA  → soma a quantidade
  - USO      → subtrai (bloqueado em lote vencido)
  - DESCARTE → subtrai (permitido em lote vencido)
  - AJUSTE   → DEFINE o saldo para a quantidade informada (contagem de inventário)
"""

from datetime import date
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.db.database import get_db
from app.models.models import MovimentacaoEstoque, Lote, LocalArmazenamento, Usuario
from app.schemas.movimentacao_schema import CriarMovimentacao, MovimentacaoRetorno
from app.core.security import get_current_user

router = APIRouter()

TIPOS_VALIDOS = {"ENTRADA", "USO", "DESCARTE", "AJUSTE", "TRANSFERENCIA"}
TIPOS_SAIDA = {"USO", "DESCARTE"}
LOCAIS_FRIOS = {"REFRIGERADO", "CONGELADO"}


def aplicar_efeito_no_saldo(lote: Lote, tipo: str, quantidade: Decimal):
    """Aplica o efeito da movimentação no saldo do lote, com validações."""
    atual = Decimal(str(lote.quantidade_atual or 0))

    if tipo == "ENTRADA":
        lote.quantidade_atual = atual + quantidade
    elif tipo in TIPOS_SAIDA:
        if atual < quantidade:
            raise HTTPException(
                status_code=400,
                detail=f"Estoque insuficiente neste lote! Disponível: {atual}, Solicitado: {quantidade}",
            )
        lote.quantidade_atual = atual - quantidade
    elif tipo == "AJUSTE":
        # AJUSTE define o saldo para o valor contado no inventário.
        lote.quantidade_atual = quantidade


@router.post("/", response_model=MovimentacaoRetorno, status_code=201)
def criar_movimentacao(
    movimentacao: CriarMovimentacao,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    tipo = movimentacao.tipo.upper()
    quantidade = movimentacao.quantidade

    if tipo not in TIPOS_VALIDOS:
        raise HTTPException(
            status_code=400,
            detail="Tipo inválido! Use: ENTRADA, USO, DESCARTE, AJUSTE ou TRANSFERENCIA.",
        )

    if quantidade < 0:
        raise HTTPException(status_code=400, detail="A quantidade não pode ser negativa.")
    # Fluxo (entrada/saída) exige > 0; AJUSTE aceita 0; TRANSFERENCIA usa o saldo do lote.
    if tipo not in ("AJUSTE", "TRANSFERENCIA") and quantidade <= 0:
        raise HTTPException(status_code=400, detail="A quantidade deve ser maior que zero.")

    lote = db.query(Lote).filter(Lote.id == movimentacao.lote_id).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote não encontrado!")

    local_origem_id = movimentacao.local_origem_id
    local_destino_id = movimentacao.local_destino_id

    if tipo == "TRANSFERENCIA":
        # Move o lote inteiro para outro local; não altera o saldo.
        local_origem_id = local_origem_id or lote.local_id
        if not local_destino_id:
            raise HTTPException(status_code=400, detail="Transferência exige um local de destino.")
        if local_destino_id == local_origem_id:
            raise HTTPException(status_code=400, detail="Local de origem e destino devem ser diferentes.")

        destino = db.query(LocalArmazenamento).filter(LocalArmazenamento.id == local_destino_id).first()
        if not destino:
            raise HTTPException(status_code=400, detail="Local de destino não existe.")

        # Cadeia de frio: material que exige refrigeração não pode ir para local ambiente.
        if lote.material and lote.material.exige_refrigeracao and destino.tipo not in LOCAIS_FRIOS:
            raise HTTPException(
                status_code=400,
                detail="Cadeia de frio: este material exige local REFRIGERADO ou CONGELADO.",
            )

        quantidade = Decimal(str(lote.quantidade_atual or 0))
        lote.local_id = local_destino_id
    else:
        if tipo == "USO" and lote.data_validade and lote.data_validade < date.today():
            raise HTTPException(
                status_code=400,
                detail="Bloqueado por Validade: Lote vencido! Apenas DESCARTE permitido.",
            )
        aplicar_efeito_no_saldo(lote, tipo, quantidade)

    # Registro imutável da movimentação, com o usuário responsável (auditoria).
    nova_movimentacao = MovimentacaoEstoque(
        lote_id=movimentacao.lote_id,
        usuario_id=current_user.id,
        tipo=tipo,
        quantidade=quantidade,
        unidade_medida=movimentacao.unidade_medida,
        local_origem_id=local_origem_id if tipo == "TRANSFERENCIA" else movimentacao.local_origem_id,
        local_destino_id=local_destino_id if tipo == "TRANSFERENCIA" else movimentacao.local_destino_id,
        motivo=movimentacao.motivo,
        referencia=movimentacao.referencia,
    )

    db.add(nova_movimentacao)
    db.commit()
    db.refresh(nova_movimentacao)
    return nova_movimentacao


@router.get("/", response_model=List[MovimentacaoRetorno])
def listar_movimentacoes(
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
    tipo: Optional[str] = Query(None),
    lote_id: Optional[int] = Query(None),
    usuario_id: Optional[int] = Query(None),
    material_id: Optional[int] = Query(None),
):
    query = db.query(MovimentacaoEstoque).options(
        joinedload(MovimentacaoEstoque.usuario),
        joinedload(MovimentacaoEstoque.lote).joinedload(Lote.material),
    )
    if tipo:
        query = query.filter(MovimentacaoEstoque.tipo == tipo.upper())
    if lote_id:
        query = query.filter(MovimentacaoEstoque.lote_id == lote_id)
    if usuario_id:
        query = query.filter(MovimentacaoEstoque.usuario_id == usuario_id)
    if material_id:
        query = query.join(Lote).filter(Lote.material_id == material_id)
    return query.order_by(MovimentacaoEstoque.criado_em.desc()).all()


@router.post("/{movimentacao_id}/estornar", response_model=MovimentacaoRetorno, status_code=201)
def estornar_movimentacao(
    movimentacao_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Anula uma movimentação criando o lançamento inverso (nunca apaga o original)."""
    original = db.query(MovimentacaoEstoque).filter(MovimentacaoEstoque.id == movimentacao_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Movimentação não encontrada!")

    if original.estorno_de_id is not None:
        raise HTTPException(status_code=400, detail="Não é possível estornar um estorno.")

    ja_estornada = db.query(MovimentacaoEstoque).filter(MovimentacaoEstoque.estorno_de_id == original.id).first()
    if ja_estornada:
        raise HTTPException(status_code=400, detail="Esta movimentação já foi estornada.")

    if original.tipo in ("AJUSTE", "TRANSFERENCIA"):
        raise HTTPException(status_code=400, detail="Estorno disponível apenas para ENTRADA, USO e DESCARTE.")

    lote = db.query(Lote).filter(Lote.id == original.lote_id).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote da movimentação não existe mais.")

    atual = Decimal(str(lote.quantidade_atual or 0))
    quantidade = Decimal(str(original.quantidade))

    # Inverte o efeito original no saldo.
    if original.tipo == "ENTRADA":
        if atual < quantidade:
            raise HTTPException(status_code=400, detail="Saldo insuficiente para estornar esta entrada.")
        lote.quantidade_atual = atual - quantidade
    else:  # USO ou DESCARTE devolvem ao estoque
        lote.quantidade_atual = atual + quantidade

    estorno = MovimentacaoEstoque(
        lote_id=original.lote_id,
        usuario_id=current_user.id,
        tipo=original.tipo,
        quantidade=quantidade,
        estorno_de_id=original.id,
        motivo=f"Estorno da movimentação #{original.id}",
    )
    db.add(estorno)
    db.commit()
    db.refresh(estorno)
    return estorno


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