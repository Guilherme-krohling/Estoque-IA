from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from decimal import Decimal


class MovimentacaoPadrao(BaseModel):
    lote_id: int
    tipo: str  # ENTRADA | USO | DESCARTE | AJUSTE
    quantidade: Decimal
    unidade_medida: Optional[str] = None  # un, ml, caixa
    motivo: Optional[str] = None
    referencia: Optional[str] = None  # NF ou Pedido


class CriarMovimentacao(MovimentacaoPadrao):
    pass


class MovimentacaoRetorno(MovimentacaoPadrao):
    id: int
    usuario_id: int
    criado_em: datetime
    model_config = ConfigDict(from_attributes=True)