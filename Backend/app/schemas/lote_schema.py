from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date, datetime

#campos que sempre existem
class LotePadrao(BaseModel):
    numero_lote: str
    data_validade: date
    quantidade_atual: float=0
    material_id: int
    

# Essa é a classe que o usuário vai usar para criar um Lote nova
class CriarLote(LotePadrao):
    pass

#Essa é a classe que o nosso sistema vai devolver para o frontend depois que o Lote for salva no banco.
class LoteRetorno(LotePadrao):
    id: int
    criado_em: datetime
    model_config = ConfigDict(from_attributes=True)