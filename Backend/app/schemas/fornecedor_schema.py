from pydantic import BaseModel, ConfigDict
from typing import Optional


class FornecedorPadrao(BaseModel):
    nome: str
    cnpj: Optional[str] = None
    contato: Optional[str] = None
    email: Optional[str] = None


class CriarFornecedor(FornecedorPadrao):
    pass


class AtualizarFornecedor(FornecedorPadrao):
    pass


class FornecedorRetorno(FornecedorPadrao):
    id: int
    ativo: bool
    model_config = ConfigDict(from_attributes=True)
