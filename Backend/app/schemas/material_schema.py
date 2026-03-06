from pydantic import BaseModel, ConfigDict
from typing import Optional

class MaterialPadrao(BaseModel):
    nome: str
    quantidade_estoque: int=0
    categoria_id: int
    

class CriarMaterial(MaterialPadrao):
    pass

class MaterialRetorno(MaterialPadrao):
    id: int
    model_config = ConfigDict(from_attributes=True)