from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date, datetime

class MovimentacaoPadrao(BaseModel):
    tipo: str
    quantidade: float
    motivo: str
    lote_id: int
    

class CriarMovimentacao(MovimentacaoPadrao):
    pass

class MovimentacaoRetorno(MovimentacaoPadrao):
    id: int
    criado_em: datetime
    model_config = ConfigDict(from_attributes=True)