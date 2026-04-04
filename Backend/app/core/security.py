"""
StockIA — Módulo de Autenticação JWT
======================================
Hash de senhas com bcrypt + criação/validação de tokens JWT.
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import Usuario

load_dotenv()

# =====================================================================
# CONFIGURAÇÕES
# =====================================================================
SECRET_KEY = os.getenv("SECRET_KEY", "chave-padrao-insegura")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

# Contexto de hash bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Esquema OAuth2 — extrai o token do header Authorization: Bearer <token>
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# =====================================================================
# FUNÇÕES DE HASH
# =====================================================================
def hash_senha(senha: str) -> str:
    """Gera hash bcrypt de uma senha em texto puro."""
    return pwd_context.hash(senha)


def verificar_senha(senha_pura: str, senha_hash: str) -> bool:
    """Compara senha digitada com o hash armazenado no banco."""
    return pwd_context.verify(senha_pura, senha_hash)


# =====================================================================
# FUNÇÕES DE TOKEN JWT
# =====================================================================
def criar_token_acesso(dados: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Cria um token JWT assinado com os dados do usuário."""
    to_encode = dados.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# =====================================================================
# DEPENDENCY — Injeção do Usuário Autenticado nas rotas
# =====================================================================
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Usuario:
    """
    Dependency do FastAPI que:
    1. Extrai o token do header Authorization.
    2. Decodifica e valida o JWT.
    3. Busca o usuário no banco.
    4. Retorna o objeto Usuario para a rota usar.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido ou expirado.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = int(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exception

    usuario = db.query(Usuario).filter(Usuario.id == user_id).first()
    if usuario is None or not usuario.ativo:
        raise credentials_exception

    return usuario


def require_admin(current_user: Usuario = Depends(get_current_user)) -> Usuario:
    """Dependency que restringe acesso apenas a Admins."""
    if current_user.perfil != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores.",
        )
    return current_user
