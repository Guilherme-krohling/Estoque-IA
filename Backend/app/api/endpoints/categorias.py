"""
StockIA — Endpoint Categorias
================================
CRUD completo de categorias protegido por JWT.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.models import Categoria, Usuario
from app.schemas.categoria_schema import CriarCategoria, AtualizarCategoria, CategoriaRetorno
from app.core.security import get_current_user

router = APIRouter()


@router.post("/", response_model=CategoriaRetorno, status_code=201)
def criar_categoria(
    categoria: CriarCategoria,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    existente = db.query(Categoria).filter(Categoria.nome == categoria.nome).first()
    if existente:
        raise HTTPException(status_code=409, detail="Categoria com este nome já existe.")

    nova_categoria = Categoria(**categoria.model_dump())
    db.add(nova_categoria)
    db.commit()
    db.refresh(nova_categoria)
    return nova_categoria


@router.get("/", response_model=List[CategoriaRetorno])
def listar_categorias(db: Session = Depends(get_db), _user: Usuario = Depends(get_current_user)):
    return db.query(Categoria).all()


@router.get("/{categoria_id}", response_model=CategoriaRetorno)
def buscar_categoria(
    categoria_id: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    categoria = db.query(Categoria).filter(Categoria.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria não encontrada.")
    return categoria


@router.put("/{categoria_id}", response_model=CategoriaRetorno)
def atualizar_categoria(
    categoria_id: int,
    dados: AtualizarCategoria,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    categoria = db.query(Categoria).filter(Categoria.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria não encontrada.")

    for key, value in dados.model_dump().items():
        setattr(categoria, key, value)

    db.commit()
    db.refresh(categoria)
    return categoria


@router.delete("/{categoria_id}")
def deletar_categoria(
    categoria_id: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    categoria = db.query(Categoria).filter(Categoria.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria não encontrada.")

    if categoria.materiais:
        raise HTTPException(
            status_code=400,
            detail="Não é possível excluir uma categoria que possui materiais vinculados.",
        )

    db.delete(categoria)
    db.commit()
    return {"mensagem": "Categoria deletada com sucesso!"}