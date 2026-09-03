from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class MovimentacaoPadrao(BaseModel):
    lote_id: int
    tipo: str  # ENTRADA | USO | DESCARTE | AJUSTE | TRANSFERENCIA
    quantidade: Decimal = Field(ge=0)  # nunca negativo; o sinal vem do tipo
    unidade_medida: Optional[str] = None  # un, ml, caixa
    local_origem_id: Optional[int] = None   # usado em TRANSFERENCIA
    local_destino_id: Optional[int] = None  # usado em TRANSFERENCIA
    motivo: Optional[str] = None
    referencia: Optional[str] = None  # NF ou Pedido


class CriarMovimentacao(MovimentacaoPadrao):
    pass


class _UsuarioMov(BaseModel):
    id: int
    nome: str
    model_config = ConfigDict(from_attributes=True)


class _MaterialMov(BaseModel):
    id: int
    nome: str
    unidade_medida: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class _LoteMov(BaseModel):
    id: int
    numero_lote: str
    material: Optional[_MaterialMov] = None
    model_config = ConfigDict(from_attributes=True)


class MovimentacaoRetorno(MovimentacaoPadrao):
    id: int
    usuario_id: int
    estorno_de_id: Optional[int] = None
    criado_em: datetime
    usuario: Optional[_UsuarioMov] = None
    lote: Optional[_LoteMov] = None
    model_config = ConfigDict(from_attributes=True)