"""
StockIA — Endpoint Materiais
===============================
CRUD completo do catálogo de materiais protegido por JWT.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.models import Material, Categoria, Fornecedor, Usuario
from app.schemas.material_schema import CriarMaterial, AtualizarMaterial, MaterialRetorno
from app.core.security import get_current_user

router = APIRouter()


def validar_fks(db: Session, categoria_id, fornecedor_id):
    """Garante que categoria/fornecedor referenciados existem (evita erro de FK cru)."""
    if categoria_id is not None and not db.query(Categoria).filter(Categoria.id == categoria_id).first():
        raise HTTPException(status_code=400, detail="Categoria informada não existe.")
    if fornecedor_id is not None and not db.query(Fornecedor).filter(Fornecedor.id == fornecedor_id).first():
        raise HTTPException(status_code=400, detail="Fornecedor informado não existe.")


@router.post("/", response_model=MaterialRetorno, status_code=201)
def criar_material(
    material: CriarMaterial,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    validar_fks(db, material.categoria_id, material.fornecedor_id)
    novo = Material(**material.model_dump())
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return novo


@router.get("/", response_model=List[MaterialRetorno])
def listar_materiais(db: Session = Depends(get_db), _user: Usuario = Depends(get_current_user)):
    return db.query(Material).filter(Material.ativo == True).all()


@router.get("/{material_id}", response_model=MaterialRetorno)
def buscar_material(
    material_id: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material não encontrado.")
    return material


@router.put("/{material_id}", response_model=MaterialRetorno)
def atualizar_material(
    material_id: int,
    dados: AtualizarMaterial,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material não encontrado.")

    validar_fks(db, dados.categoria_id, dados.fornecedor_id)

    for key, value in dados.model_dump().items():
        setattr(material, key, value)

    db.commit()
    db.refresh(material)
    return material


@router.delete("/{material_id}")
def deletar_material(
    material_id: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material não encontrado.")

    material.ativo = False  # Soft delete
    db.commit()
    return {"mensagem": f"Material '{material.nome}' desativado com sucesso."}