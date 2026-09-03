"""
StockIA — Endpoint Doenças
============================
CRUD de doenças com gerenciamento da relação Many-to-Many com materiais.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List

from app.db.database import get_db
from app.models.models import Doenca, Material, Usuario
from app.schemas.doenca_schema import CriarDoenca, AtualizarDoenca, DoencaRetorno
from app.core.security import get_current_user

router = APIRouter()


@router.post("/", response_model=DoencaRetorno, status_code=201)
def criar_doenca(
    doenca: CriarDoenca,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    existente = db.query(Doenca).filter(Doenca.nome == doenca.nome).first()
    if existente:
        raise HTTPException(status_code=409, detail="Doença com este nome já existe.")

    nova_doenca = Doenca(
        nome=doenca.nome,
        descricao=doenca.descricao,
        cid_codigo=doenca.cid_codigo,
    )

    # Vincula materiais (Many-to-Many)
    if doenca.material_ids:
        materiais = db.query(Material).filter(Material.id.in_(doenca.material_ids)).all()
        nova_doenca.materiais = materiais

    db.add(nova_doenca)
    db.commit()
    db.refresh(nova_doenca)
    return nova_doenca


@router.get("/", response_model=List[DoencaRetorno])
def listar_doencas(db: Session = Depends(get_db), _user: Usuario = Depends(get_current_user)):
    return db.query(Doenca).options(joinedload(Doenca.materiais)).filter(Doenca.ativo == True).all()


@router.get("/{doenca_id}", response_model=DoencaRetorno)
def buscar_doenca(
    doenca_id: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    doenca = db.query(Doenca).options(joinedload(Doenca.materiais)).filter(Doenca.id == doenca_id).first()
    if not doenca:
        raise HTTPException(status_code=404, detail="Doença não encontrada.")
    return doenca


@router.put("/{doenca_id}", response_model=DoencaRetorno)
def atualizar_doenca(
    doenca_id: int,
    dados: AtualizarDoenca,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    doenca = db.query(Doenca).filter(Doenca.id == doenca_id).first()
    if not doenca:
        raise HTTPException(status_code=404, detail="Doença não encontrada.")

    doenca.nome = dados.nome
    doenca.descricao = dados.descricao
    doenca.cid_codigo = dados.cid_codigo

    # Atualiza vínculos Many-to-Many
    if dados.material_ids is not None:
        materiais = db.query(Material).filter(Material.id.in_(dados.material_ids)).all()
        doenca.materiais = materiais

    db.commit()
    db.refresh(doenca)
    return doenca


@router.delete("/{doenca_id}")
def deletar_doenca(
    doenca_id: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    doenca = db.query(Doenca).filter(Doenca.id == doenca_id).first()
    if not doenca:
        raise HTTPException(status_code=404, detail="Doença não encontrada.")

    doenca.ativo = False  # Soft delete
    db.commit()
    return {"mensagem": f"Doença '{doenca.nome}' desativada com sucesso."}
