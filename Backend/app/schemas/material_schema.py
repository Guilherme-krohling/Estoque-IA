from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from decimal import Decimal


class MaterialPadrao(BaseModel):
    nome: str
    descricao: Optional[str] = None
    categoria_id: Optional[int] = None
    fabricante: Optional[str] = None
    fornecedor_id: Optional[int] = None
    codigo_catalogo: Optional[str] = None
    classe_risco: Optional[str] = None
    exige_refrigeracao: bool = False
    temperatura_min: Optional[Decimal] = None
    temperatura_max: Optional[Decimal] = None


class CriarMaterial(MaterialPadrao):
    pass


class AtualizarMaterial(MaterialPadrao):
    pass


class MaterialRetorno(MaterialPadrao):
    id: int
    ativo: bool
    criado_em: datetime
    model_config = ConfigDict(from_attributes=True)