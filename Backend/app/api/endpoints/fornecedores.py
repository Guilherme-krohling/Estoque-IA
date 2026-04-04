"""
StockIA — Endpoint Fornecedores
=================================
CRUD completo para gestão de fornecedores.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.models import Fornecedor, Usuario
from app.schemas.fornecedor_schema import CriarFornecedor, AtualizarFornecedor, FornecedorRetorno
from app.core.security import get_current_user

router = APIRouter()


@router.post("/", response_model=FornecedorRetorno, status_code=201)
def criar_fornecedor(
    fornecedor: CriarFornecedor,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    if fornecedor.cnpj:
        existente = db.query(Fornecedor).filter(Fornecedor.cnpj == fornecedor.cnpj).first()
        if existente:
            raise HTTPException(status_code=409, detail="Fornecedor com este CNPJ já existe.")

    novo = Fornecedor(**fornecedor.model_dump())
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return novo


@router.get("/", response_model=List[FornecedorRetorno])
def listar_fornecedores(db: Session = Depends(get_db), _user: Usuario = Depends(get_current_user)):
    return db.query(Fornecedor).filter(Fornecedor.ativo == True).all()


@router.get("/{fornecedor_id}", response_model=FornecedorRetorno)
def buscar_fornecedor(
    fornecedor_id: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    fornecedor = db.query(Fornecedor).filter(Fornecedor.id == fornecedor_id).first()
    if not fornecedor:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")
    return fornecedor


@router.put("/{fornecedor_id}", response_model=FornecedorRetorno)
def atualizar_fornecedor(
    fornecedor_id: int,
    dados: AtualizarFornecedor,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    fornecedor = db.query(Fornecedor).filter(Fornecedor.id == fornecedor_id).first()
    if not fornecedor:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")

    for key, value in dados.model_dump().items():
        setattr(fornecedor, key, value)

    db.commit()
    db.refresh(fornecedor)
    return fornecedor


@router.delete("/{fornecedor_id}")
def deletar_fornecedor(
    fornecedor_id: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    fornecedor = db.query(Fornecedor).filter(Fornecedor.id == fornecedor_id).first()
    if not fornecedor:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")

    fornecedor.ativo = False  # Soft delete — não apaga, só desativa
    db.commit()
    return {"mensagem": f"Fornecedor '{fornecedor.nome}' desativado com sucesso."}
