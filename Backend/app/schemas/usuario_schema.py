from pydantic import BaseModel, ConfigDict, EmailStr, Field
from typing import Literal
from datetime import datetime

Perfil = Literal["ADMIN", "GESTOR", "PESQUISADOR"]


class UsuarioPadrao(BaseModel):
    nome: str = Field(min_length=2, max_length=100)
    email: EmailStr
    perfil: Perfil = "PESQUISADOR"


class CriarUsuario(UsuarioPadrao):
    senha: str = Field(min_length=8, max_length=128)  # Texto puro, hasheado no backend


class LoginUsuario(BaseModel):
    email: EmailStr
    senha: str


class UsuarioRetorno(UsuarioPadrao):
    id: int
    ativo: bool
    criado_em: datetime
    model_config = ConfigDict(from_attributes=True)


class TokenRetorno(BaseModel):
    access_token: str
    token_type: str = "bearer"
