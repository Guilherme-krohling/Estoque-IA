from pydantic import BaseModel, ConfigDict
from typing import Optional, Literal
from datetime import datetime
from decimal import Decimal

TipoLocal = Literal["REFRIGERADO", "CONGELADO", "AMBIENTE", "INFLAMAVEIS"]


class LocalPadrao(BaseModel):
    nome: str
    tipo: TipoLocal
    temperatura_atual: Optional[Decimal] = None
    descricao: Optional[str] = None


class CriarLocal(LocalPadrao):
    pass


class AtualizarLocal(LocalPadrao):
    pass


class LocalRetorno(LocalPadrao):
    id: int
    ativo: bool
    criado_em: datetime
    model_config = ConfigDict(from_attributes=True)
