from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date, datetime
from decimal import Decimal


class LotePadrao(BaseModel):
    material_id: int
    numero_lote: str
    data_fabricacao: Optional[date] = None
    data_validade: date
    certificado_analise: Optional[str] = None
    fornecedor_id: Optional[int] = None
    quantidade_atual: Decimal = Decimal("0")


class CriarLote(LotePadrao):
    pass


class AtualizarLote(LotePadrao):
    pass


class LoteRetorno(LotePadrao):
    id: int
    criado_em: datetime
    model_config = ConfigDict(from_attributes=True)