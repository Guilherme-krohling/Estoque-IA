"""
Laurus AI — Endpoint Convênios
==============================
CRUD completo para gestão de convênios e planos de saúde em Configurações Globais.
"""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import Convenio, Paciente, Usuario
from app.core.security import get_current_user

router = APIRouter()


class ConvenioInput(BaseModel):
    nome: str
    plano: str
    carencia: str


class ConvenioRetorno(BaseModel):
    id: int
    nome: str
    plano: str
    carencia: str
    ativo: bool
    criado_em: Optional[datetime] = None

    class Config:
        from_attributes = True


@router.get("/", response_model=List[ConvenioRetorno])
def listar_convenios(
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    return (
        db.query(Convenio)
        .filter(Convenio.ativo == True)
        .order_by(Convenio.nome.asc(), Convenio.plano.asc())
        .all()
    )


@router.post("/", response_model=ConvenioRetorno, status_code=201)
def criar_convenio(
    dados: ConvenioInput,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    nome = (dados.nome or "").strip()
    plano = (dados.plano or "").strip()
    carencia = (dados.carencia or "").strip()

    if not nome or not plano or not carencia:
        raise HTTPException(
            status_code=400,
            detail="Nome do convênio, plano e carência são obrigatórios.",
        )

    novo = Convenio(nome=nome, plano=plano, carencia=carencia, ativo=True)
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return novo


@router.put("/{convenio_id}", response_model=ConvenioRetorno)
def atualizar_convenio(
    convenio_id: int,
    dados: ConvenioInput,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    conv = db.query(Convenio).filter(Convenio.id == convenio_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Convênio não encontrado.")

    conv.nome = (dados.nome or "").strip()
    conv.plano = (dados.plano or "").strip()
    conv.carencia = (dados.carencia or "").strip()

    # Atualiza o rótulo do convênio nos pacientes vinculados
    pacientes_vinculados = db.query(Paciente).filter(Paciente.convenio_id == conv.id).all()
    rotulo = f"{conv.nome} ({conv.plano})" if conv.plano else conv.nome
    for pac in pacientes_vinculados:
        pac.convenio = rotulo

    db.commit()
    db.refresh(conv)
    return conv


@router.delete("/{convenio_id}")
def deletar_convenio(
    convenio_id: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    conv = db.query(Convenio).filter(Convenio.id == convenio_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Convênio não encontrado.")

    conv.ativo = False
    db.commit()
    return {"mensagem": f"Convênio '{conv.nome}' desativado com sucesso."}

