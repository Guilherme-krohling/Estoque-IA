"""
Laurus AI — Endpoint Pacientes
==============================
CRUD completo para gestão de pacientes em Configurações Globais,
sempre organizados em ordem alfabética (A-Z).
"""

from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import Convenio, Paciente, Usuario
from app.core.security import get_current_user

router = APIRouter()


class PacienteInput(BaseModel):
    nome_completo: str
    convenio_id: Optional[int] = None
    convenio: Optional[str] = None
    numero_carteirinha: str
    data_nascimento: date
    codigo_atendimento: str
    endereco: Optional[str] = None
    cpf: str
    rg: str
    telefone: str


class PacienteRetorno(BaseModel):
    id: int
    nome_completo: str
    convenio_id: Optional[int] = None
    convenio: str
    numero_carteirinha: str
    data_nascimento: date
    codigo_atendimento: str
    endereco: Optional[str] = None
    cpf: str
    rg: str
    telefone: str
    ativo: bool
    criado_em: Optional[datetime] = None

    class Config:
        from_attributes = True


def _resolver_convenio(db: Session, convenio_id: Optional[int], convenio_str: Optional[str]) -> tuple[Optional[int], str]:
    if convenio_id:
        conv_obj = db.query(Convenio).filter(Convenio.id == convenio_id).first()
        if conv_obj:
            rotulo = f"{conv_obj.nome} ({conv_obj.plano})" if conv_obj.plano else conv_obj.nome
            return conv_obj.id, rotulo
    conv_limpo = (convenio_str or "").strip()
    if not conv_limpo:
        raise HTTPException(status_code=400, detail="Selecione um convênio cadastrado.")
    return None, conv_limpo


@router.get("/", response_model=List[PacienteRetorno])
def listar_pacientes(
    busca: Optional[str] = Query(None, description="Filtra por nome, CPF, carteirinha ou código de atendimento"),
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    query = db.query(Paciente).filter(Paciente.ativo == True)

    if busca and busca.strip():
        termo = f"%{busca.strip()}%"
        query = query.filter(
            or_(
                Paciente.nome_completo.ilike(termo),
                Paciente.cpf.ilike(termo),
                Paciente.numero_carteirinha.ilike(termo),
                Paciente.codigo_atendimento.ilike(termo),
                Paciente.convenio.ilike(termo),
            )
        )

    return query.order_by(func.lower(Paciente.nome_completo).asc()).all()


@router.post("/", response_model=PacienteRetorno, status_code=201)
def criar_paciente(
    dados: PacienteInput,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    nome = (dados.nome_completo or "").strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome completo do paciente é obrigatório.")

    conv_id, conv_nome = _resolver_convenio(db, dados.convenio_id, dados.convenio)

    cpf_limpo = (dados.cpf or "").strip()
    if cpf_limpo:
        existente = (
            db.query(Paciente)
            .filter(Paciente.cpf == cpf_limpo, Paciente.ativo == True)
            .first()
        )
        if existente:
            raise HTTPException(status_code=409, detail="Já existe um paciente ativo cadastrado com este CPF.")

    novo = Paciente(
        nome_completo=nome,
        convenio_id=conv_id,
        convenio=conv_nome,
        numero_carteirinha=(dados.numero_carteirinha or "").strip(),
        data_nascimento=dados.data_nascimento,
        codigo_atendimento=(dados.codigo_atendimento or "").strip(),
        endereco=(dados.endereco or "").strip() or None,
        cpf=cpf_limpo,
        rg=(dados.rg or "").strip(),
        telefone=(dados.telefone or "").strip(),
        ativo=True,
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return novo


@router.put("/{paciente_id}", response_model=PacienteRetorno)
def atualizar_paciente(
    paciente_id: int,
    dados: PacienteInput,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    pac = db.query(Paciente).filter(Paciente.id == paciente_id).first()
    if not pac:
        raise HTTPException(status_code=404, detail="Paciente não encontrado.")

    conv_id, conv_nome = _resolver_convenio(db, dados.convenio_id, dados.convenio)

    cpf_limpo = (dados.cpf or "").strip()
    if cpf_limpo and cpf_limpo != pac.cpf:
        existente = (
            db.query(Paciente)
            .filter(Paciente.cpf == cpf_limpo, Paciente.ativo == True, Paciente.id != paciente_id)
            .first()
        )
        if existente:
            raise HTTPException(status_code=409, detail="Outro paciente ativo já possui este CPF.")

    pac.nome_completo = (dados.nome_completo or "").strip()
    pac.convenio_id = conv_id
    pac.convenio = conv_nome
    pac.numero_carteirinha = (dados.numero_carteirinha or "").strip()
    pac.data_nascimento = dados.data_nascimento
    pac.codigo_atendimento = (dados.codigo_atendimento or "").strip()
    pac.endereco = (dados.endereco or "").strip() or None
    pac.cpf = cpf_limpo
    pac.rg = (dados.rg or "").strip()
    pac.telefone = (dados.telefone or "").strip()

    db.commit()
    db.refresh(pac)
    return pac


@router.delete("/{paciente_id}")
def deletar_paciente(
    paciente_id: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    pac = db.query(Paciente).filter(Paciente.id == paciente_id).first()
    if not pac:
        raise HTTPException(status_code=404, detail="Paciente não encontrado.")

    pac.ativo = False
    db.commit()
    return {"mensagem": f"Paciente '{pac.nome_completo}' removido com sucesso."}

