from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date, datetime

class LotePadrao(BaseModel):
    numero_lote: str
    data_validade: date
    quantidade_atual: float=0
    material_id: int
    

class CriarLote(LotePadrao):
    pass

class LoteRetorno(LotePadrao):
    id: int
    criado_em: datetime
    model_config = ConfigDict(from_attributes=True)