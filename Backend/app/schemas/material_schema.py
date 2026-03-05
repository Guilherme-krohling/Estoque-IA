from pydantic import BaseModel, ConfigDict
from typing import Optional

#campos que sempre existem
class MaterialPadrao(BaseModel):
    nome: str
    quantidade_estoque: int=0
    categoria_id: int
    

# Essa é a classe que o usuário vai usar para criar um Material nova
class CriarMaterial(MaterialPadrao):
    pass

#Essa é a classe que o nosso sistema vai devolver para o frontend depois que o Material for salva no banco.
class MaterialRetorno(MaterialPadrao):
    id: int
    model_config = ConfigDict(from_attributes=True)