"""
StockIA — Endpoint Usuários (Admin)
=====================================
CRUD de usuários protegido por autenticação.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.models import Usuario
from app.schemas.usuario_schema import UsuarioRetorno
from app.core.security import get_current_user, require_admin

router = APIRouter()


@router.get("/", response_model=List[UsuarioRetorno])
def listar_usuarios(db: Session = Depends(get_db), _admin: Usuario = Depends(require_admin)):
    return db.query(Usuario).all()


@router.get("/me", response_model=UsuarioRetorno)
def perfil_atual(current_user: Usuario = Depends(get_current_user)):
    return current_user


@router.get("/{usuario_id}", response_model=UsuarioRetorno)
def buscar_usuario(usuario_id: int, db: Session = Depends(get_db), _admin: Usuario = Depends(require_admin)):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    return usuario


@router.patch("/{usuario_id}/desativar")
def desativar_usuario(usuario_id: int, db: Session = Depends(get_db), _admin: Usuario = Depends(require_admin)):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    usuario.ativo = False
    db.commit()
    return {"mensagem": f"Usuário '{usuario.nome}' desativado."}


@router.patch("/{usuario_id}/ativar")
def ativar_usuario(usuario_id: int, db: Session = Depends(get_db), _admin: Usuario = Depends(require_admin)):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    usuario.ativo = True
    db.commit()
    return {"mensagem": f"Usuário '{usuario.nome}' ativado."}
