from pydantic import BaseModel, ConfigDict
from typing import Optional


class CategoriaPadrao(BaseModel):
    nome: str
    descricao: Optional[str] = None


class CriarCategoria(CategoriaPadrao):
    pass


class AtualizarCategoria(CategoriaPadrao):
    pass


class CategoriaRetorno(CategoriaPadrao):
    id: int
    model_config = ConfigDict(from_attributes=True)
