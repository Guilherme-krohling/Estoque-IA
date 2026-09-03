from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime


# Schema simplificado de Material para evitar referência circular
class MaterialResumo(BaseModel):
    id: int
    nome: str
    fabricante: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class DoencaPadrao(BaseModel):
    nome: str
    descricao: Optional[str] = None
    cid_codigo: Optional[str] = None  # Código CID-10 (ex: A90 = Dengue)


class CriarDoenca(DoencaPadrao):
    material_ids: Optional[List[int]] = []  # IDs dos materiais relacionados


class AtualizarDoenca(DoencaPadrao):
    material_ids: Optional[List[int]] = []


class DoencaRetorno(DoencaPadrao):
    id: int
    ativo: bool
    criado_em: datetime
    materiais: List[MaterialResumo] = []
    model_config = ConfigDict(from_attributes=True)
