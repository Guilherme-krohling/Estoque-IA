from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import date, datetime
from decimal import Decimal


class LoteBase(BaseModel):
    """Campos do cadastro do lote (não incluem o saldo, que é movimentado à parte)."""
    material_id: int
    local_id: Optional[int] = None
    numero_lote: str
    data_fabricacao: Optional[date] = None
    data_validade: date
    certificado_analise: Optional[str] = None
    fornecedor_id: Optional[int] = None


class CriarLote(LoteBase):
    # Saldo de abertura: gera automaticamente uma movimentação de ENTRADA (rastreabilidade).
    quantidade_inicial: Decimal = Field(default=Decimal("0"), ge=0)


class AtualizarLote(LoteBase):
    # Edição do cadastro não altera o saldo — isso só acontece via movimentação.
    pass


class LoteRetorno(LoteBase):
    id: int
    quantidade_atual: Decimal
    criado_em: datetime
    model_config = ConfigDict(from_attributes=True)