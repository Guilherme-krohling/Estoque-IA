"""
StockIA — Endpoint de Autenticação
====================================
Registro de usuários e Login (retorna JWT).
Com Rate Limiting e logging de auditoria de segurança.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.limiter import limiter
from app.models.models import Usuario
from app.schemas.usuario_schema import CriarUsuario, LoginUsuario, TokenRetorno, UsuarioRetorno
from app.core.security import hash_senha, verificar_senha, criar_token_acesso, require_admin

router = APIRouter()
security_logger = logging.getLogger("stockia.security")


# =====================================================================
# REGISTRO — Cria um novo usuário (somente ADMIN)
# =====================================================================
@router.post("/registrar", response_model=UsuarioRetorno, status_code=status.HTTP_201_CREATED)
def registrar_usuario(
    usuario: CriarUsuario,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    # Verifica se email já existe
    existente = db.query(Usuario).filter(Usuario.email == usuario.email).first()
    if existente:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe um usuário com este email.",
        )

    novo_usuario = Usuario(
        nome=usuario.nome,
        email=usuario.email,
        senha_hash=hash_senha(usuario.senha),
        perfil=usuario.perfil,
    )

    db.add(novo_usuario)
    db.commit()
    db.refresh(novo_usuario)
    return novo_usuario


# =====================================================================
# LOGIN — Retorna um JWT válido (Rate Limit: 5 tentativas/minuto por IP)
# =====================================================================
@router.post("/login", response_model=TokenRetorno)
@limiter.limit("5/minute")
def login(request: Request, dados: LoginUsuario, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.email == dados.email).first()

    if not usuario or not verificar_senha(dados.senha, usuario.senha_hash):
        # Registra falha de login para detecção de ataques de brute-force
        security_logger.warning(
            "Falha de login | email=%s | IP=%s",
            dados.email,
            request.client.host if request.client else "unknown",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos.",
        )

    if not usuario.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conta desativada. Entre em contato com o administrador.",
        )

    security_logger.info(
        "Login bem-sucedido | user_id=%s | perfil=%s | IP=%s",
        usuario.id,
        usuario.perfil,
        request.client.host if request.client else "unknown",
    )

    token = criar_token_acesso(dados={"sub": str(usuario.id), "perfil": usuario.perfil})
    return {"access_token": token, "token_type": "bearer"}
