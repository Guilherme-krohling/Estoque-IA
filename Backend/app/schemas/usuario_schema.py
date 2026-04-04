from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class UsuarioPadrao(BaseModel):
    nome: str
    email: str
    perfil: str = "PESQUISADOR"


class CriarUsuario(UsuarioPadrao):
    senha: str  # Texto puro que será hasheado no backend


class LoginUsuario(BaseModel):
    email: str
    senha: str


class UsuarioRetorno(UsuarioPadrao):
    id: int
    ativo: bool
    criado_em: datetime
    model_config = ConfigDict(from_attributes=True)


class TokenRetorno(BaseModel):
    access_token: str
    token_type: str = "bearer"
