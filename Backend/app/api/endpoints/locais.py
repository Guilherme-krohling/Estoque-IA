"""
StockIA — Endpoint Locais de Armazenamento
============================================
CRUD de depósitos/geladeiras/freezers protegido por JWT.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.models import LocalArmazenamento, Lote, Usuario
from app.schemas.local_schema import CriarLocal, AtualizarLocal, LocalRetorno
from app.core.security import get_current_user

router = APIRouter()


@router.post("/", response_model=LocalRetorno, status_code=201)
def criar_local(
    local: CriarLocal,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    novo = LocalArmazenamento(**local.model_dump())
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return novo


@router.get("/", response_model=List[LocalRetorno])
def listar_locais(db: Session = Depends(get_db), _user: Usuario = Depends(get_current_user)):
    return db.query(LocalArmazenamento).filter(LocalArmazenamento.ativo == True).all()


@router.get("/{local_id}", response_model=LocalRetorno)
def buscar_local(
    local_id: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    local = db.query(LocalArmazenamento).filter(LocalArmazenamento.id == local_id).first()
    if not local:
        raise HTTPException(status_code=404, detail="Local não encontrado.")
    return local


@router.put("/{local_id}", response_model=LocalRetorno)
def atualizar_local(
    local_id: int,
    dados: AtualizarLocal,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    local = db.query(LocalArmazenamento).filter(LocalArmazenamento.id == local_id).first()
    if not local:
        raise HTTPException(status_code=404, detail="Local não encontrado.")

    for key, value in dados.model_dump().items():
        setattr(local, key, value)

    db.commit()
    db.refresh(local)
    return local


@router.delete("/{local_id}")
def deletar_local(
    local_id: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    local = db.query(LocalArmazenamento).filter(LocalArmazenamento.id == local_id).first()
    if not local:
        raise HTTPException(status_code=404, detail="Local não encontrado.")

    em_uso = db.query(Lote).filter(Lote.local_id == local_id).first()
    if em_uso:
        raise HTTPException(
            status_code=400,
            detail="Não é possível desativar um local com lotes vinculados.",
        )

    local.ativo = False  # Soft delete
    db.commit()
    return {"mensagem": f"Local '{local.nome}' desativado com sucesso."}
