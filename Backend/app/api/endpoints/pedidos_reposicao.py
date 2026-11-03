"""
Laurus AI — Endpoints de Pedidos de Reposição, Notas Fiscais e Entregas Parciais (Fase 4.1)
===========================================================================================
Gerencia o ciclo completo de compras/reposição junto aos fornecedores:
  - Registro do Pedido de Reposição (Material, Empresa/Fornecedor, Data do Pedido, Qtd Solicitada)
  - Registro de Entregas (Totais ou Parciais) vinculadas à Nota Fiscal (NF) e Data de Chegada
  - Cálculo automático de Quanto Chegou, Quanto Falta Chegar (Saldo Pendente) e Status
  - Integração automática opcional com o saldo físico de Lotes e Movimentações (ENTRADA)
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.db.database import get_db
from app.core.security import get_current_user
from app.models.models import (
    PedidoReposicao,
    EntregaPedido,
    Material,
    Fornecedor,
    Lote,
    MovimentacaoEstoque,
    Usuario,
)

router = APIRouter()


# =====================================================================
# SCHEMAS PYDANTIC
# =====================================================================
class CriarPedidoRequest(BaseModel):
    material_id: int
    fornecedor_id: Optional[int] = None
    empresa_fornecedora: Optional[str] = None
    data_pedido: Optional[str] = None  # YYYY-MM-DD
    quantidade_solicitada: float
    observacoes: Optional[str] = None


class RegistrarEntregaRequest(BaseModel):
    numero_nf: str
    data_recebimento: Optional[str] = None  # YYYY-MM-DD
    quantidade_entregue: float
    abastecer_estoque: bool = True
    lote_id: Optional[int] = None
    numero_lote_recebido: Optional[str] = None
    data_validade_lote: Optional[str] = None  # YYYY-MM-DD
    local_id: Optional[int] = None
    observacoes: Optional[str] = None


def _parse_date(val: Optional[str], fallback: date) -> date:
    if not val:
        return fallback
    try:
        return date.fromisoformat(val[:10])
    except ValueError:
        return fallback


def _serializar_pedido(p: PedidoReposicao) -> dict:
    qtd_sol = float(p.quantidade_solicitada or 0)
    qtd_rec = float(p.quantidade_recebida or 0)
    qtd_pend = max(0.0, round(qtd_sol - qtd_rec, 2))
    pct = round(min(100.0, (qtd_rec / qtd_sol) * 100.0), 1) if qtd_sol > 0 else 0.0

    entregas_list = []
    for e in (p.entregas or []):
        entregas_list.append({
            "id": e.id,
            "pedido_id": e.pedido_id,
            "numero_nf": e.numero_nf,
            "data_recebimento": e.data_recebimento.isoformat() if e.data_recebimento else None,
            "quantidade_entregue": float(e.quantidade_entregue or 0),
            "lote_id": e.lote_id,
            "numero_lote_recebido": e.numero_lote_recebido or (e.lote.numero_lote if e.lote else "-"),
            "data_validade_lote": e.data_validade_lote.isoformat() if e.data_validade_lote else None,
            "movimentacao_id": e.movimentacao_id,
            "observacoes": e.observacoes,
            "usuario_nome": e.usuario.nome if e.usuario else "-",
            "criado_em": e.criado_em.isoformat() if e.criado_em else None,
        })

    return {
        "id": p.id,
        "material_id": p.material_id,
        "material_nome": p.material.nome if p.material else f"Material #{p.material_id}",
        "codigo_catalogo": p.material.codigo_catalogo if p.material else None,
        "unidade_medida": p.material.unidade_medida if p.material else "un",
        "fornecedor_id": p.fornecedor_id,
        "empresa_fornecedora": p.empresa_fornecedora or (p.fornecedor.nome if p.fornecedor else "Fornecedor Padrão"),
        "data_pedido": p.data_pedido.isoformat() if p.data_pedido else None,
        "quantidade_solicitada": qtd_sol,
        "quantidade_recebida": qtd_rec,
        "quantidade_pendente": qtd_pend,
        "percentual_entregue": pct,
        "status": p.status,
        "observacoes": p.observacoes,
        "usuario_nome": p.usuario.nome if p.usuario else "-",
        "qtd_entregas": len(entregas_list),
        "entregas": entregas_list,
        "criado_em": p.criado_em.isoformat() if p.criado_em else None,
    }


# =====================================================================
# ENDPOINTS
# =====================================================================
@router.get("/")
def listar_pedidos_reposicao(
    status: Optional[str] = Query(None, description="PENDENTE | PARCIAL | CONCLUIDO | CANCELADO"),
    material_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    """Lista todos os pedidos de reposição com suas respectivas entregas e saldos pendentes."""
    query = (
        db.query(PedidoReposicao)
        .options(
            joinedload(PedidoReposicao.material),
            joinedload(PedidoReposicao.fornecedor),
            joinedload(PedidoReposicao.usuario),
            joinedload(PedidoReposicao.entregas).joinedload(EntregaPedido.lote),
            joinedload(PedidoReposicao.entregas).joinedload(EntregaPedido.usuario),
        )
    )
    if status:
        query = query.filter(PedidoReposicao.status == status.upper())
    if material_id:
        query = query.filter(PedidoReposicao.material_id == material_id)

    pedidos = query.order_by(PedidoReposicao.data_pedido.desc(), PedidoReposicao.id.desc()).all()
    return [_serializar_pedido(p) for p in pedidos]


@router.post("/", status_code=201)
def criar_pedido_reposicao(
    body: CriarPedidoRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Registra um novo pedido de compra/reposição junto a um fornecedor."""
    if body.quantidade_solicitada <= 0:
        raise HTTPException(status_code=400, detail="A quantidade solicitada deve ser maior que zero.")

    material = db.query(Material).filter(Material.id == body.material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material não encontrado.")

    empresa = (body.empresa_fornecedora or "").strip()
    fornecedor_id = body.fornecedor_id or material.fornecedor_id
    if not empresa and fornecedor_id:
        forn = db.query(Fornecedor).filter(Fornecedor.id == fornecedor_id).first()
        if forn:
            empresa = forn.nome
    if not empresa:
        empresa = material.fabricante or "Fornecedor Laboratorial"

    dt_pedido = _parse_date(body.data_pedido, date.today())

    novo_pedido = PedidoReposicao(
        material_id=material.id,
        fornecedor_id=fornecedor_id,
        empresa_fornecedora=empresa,
        usuario_id=current_user.id if current_user else None,
        data_pedido=dt_pedido,
        quantidade_solicitada=Decimal(str(body.quantidade_solicitada)),
        quantidade_recebida=Decimal("0"),
        status="PENDENTE",
        observacoes=body.observacoes,
    )
    db.add(novo_pedido)
    db.commit()
    db.refresh(novo_pedido)
    return _serializar_pedido(novo_pedido)


@router.post("/{pedido_id}/entregas", status_code=201)
def registrar_entrega_pedido(
    pedido_id: int,
    body: RegistrarEntregaRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Registra o recebimento (total ou parcial) de um pedido mediante Nota Fiscal (NF).
    Atualiza automaticamente quanto já chegou, quanto falta chegar, o status do pedido
    (PARCIAL ou CONCLUIDO) e, se abastecer_estoque=True, soma o saldo no Lote e gera
    MovimentacaoEstoque de ENTRADA.
    """
    pedido = (
        db.query(PedidoReposicao)
        .options(joinedload(PedidoReposicao.material))
        .filter(PedidoReposicao.id == pedido_id)
        .first()
    )
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido de reposição não encontrado.")

    if pedido.status == "CANCELADO":
        raise HTTPException(status_code=400, detail="Não é possível registrar entrega em um pedido cancelado.")

    if body.quantidade_entregue <= 0:
        raise HTTPException(status_code=400, detail="A quantidade entregue deve ser maior que zero.")

    nf_limpa = (body.numero_nf or "").strip()
    if not nf_limpa:
        raise HTTPException(status_code=400, detail="Informe o número da Nota Fiscal (NF).")

    dt_recebimento = _parse_date(body.data_recebimento, date.today())
    qtd_entregue_dec = Decimal(str(body.quantidade_entregue))

    lote_vinculado = None
    mov_vinculada = None
    num_lote_str = (body.numero_lote_recebido or "").strip()

    if body.abastecer_estoque:
        if body.lote_id:
            lote_vinculado = db.query(Lote).filter(Lote.id == body.lote_id).first()
            if not lote_vinculado:
                raise HTTPException(status_code=404, detail="Lote informado não encontrado.")
        elif num_lote_str:
            lote_vinculado = (
                db.query(Lote)
                .filter(Lote.material_id == pedido.material_id, Lote.numero_lote == num_lote_str)
                .first()
            )

        if lote_vinculado:
            atual = Decimal(str(lote_vinculado.quantidade_atual or 0))
            lote_vinculado.quantidade_atual = atual + qtd_entregue_dec
            num_lote_str = lote_vinculado.numero_lote
        else:
            if not num_lote_str:
                num_lote_str = f"LOTE-NF-{nf_limpa[-6:]}-{pedido.id}"
            dt_val = _parse_date(body.data_validade_lote, dt_recebimento + timedelta(days=365))
            lote_vinculado = Lote(
                material_id=pedido.material_id,
                local_id=body.local_id or 1,
                fornecedor_id=pedido.fornecedor_id,
                numero_lote=num_lote_str,
                data_fabricacao=dt_recebimento,
                data_validade=dt_val,
                quantidade_atual=qtd_entregue_dec,
            )
            db.add(lote_vinculado)
            db.flush()

        mov_vinculada = MovimentacaoEstoque(
            lote_id=lote_vinculado.id,
            usuario_id=current_user.id if current_user else 1,
            tipo="ENTRADA",
            quantidade=qtd_entregue_dec,
            unidade_medida=pedido.material.unidade_medida if pedido.material else "un",
            motivo=f"Recebimento Pedido #{pedido.id} ({pedido.empresa_fornecedora}) — NF {nf_limpa}",
            referencia=f"NF {nf_limpa}",
        )
        db.add(mov_vinculada)
        db.flush()

    nova_entrega = EntregaPedido(
        pedido_id=pedido.id,
        lote_id=lote_vinculado.id if lote_vinculado else None,
        movimentacao_id=mov_vinculada.id if mov_vinculada else None,
        numero_nf=nf_limpa,
        data_recebimento=dt_recebimento,
        quantidade_entregue=qtd_entregue_dec,
        numero_lote_recebido=num_lote_str or None,
        data_validade_lote=lote_vinculado.data_validade if lote_vinculado else None,
        observacoes=body.observacoes,
        usuario_id=current_user.id if current_user else None,
    )
    db.add(nova_entrega)

    # Atualiza saldo recebido e status do pedido
    recebido_anterior = Decimal(str(pedido.quantidade_recebida or 0))
    novo_recebido = recebido_anterior + qtd_entregue_dec
    pedido.quantidade_recebida = novo_recebido

    solicitado_dec = Decimal(str(pedido.quantidade_solicitada or 0))
    if novo_recebido >= solicitado_dec:
        pedido.status = "CONCLUIDO"
    else:
        pedido.status = "PARCIAL"

    db.commit()
    db.refresh(pedido)
    return _serializar_pedido(pedido)


@router.patch("/{pedido_id}/cancelar")
def cancelar_pedido_reposicao(
    pedido_id: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    pedido = db.query(PedidoReposicao).filter(PedidoReposicao.id == pedido_id).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado.")
    if pedido.status == "CONCLUIDO":
        raise HTTPException(status_code=400, detail="Não é possível cancelar um pedido já concluído.")
    pedido.status = "CANCELADO"
    db.commit()
    db.refresh(pedido)
    return _serializar_pedido(pedido)

