from pydantic import BaseModel, ConfigDict
from typing import Optional

#campos que sempre existem
#CLASSE MAE
class CategoriaPadrao(BaseModel):
    nome: str
    descricao: Optional[str] = None
    

# Essa é a classe que o usuário vai usar para criar uma categoria nova
#Ta PASS por que vai herdar tudo da classe mae, se fosse necessario mais coisa entao colocaria aqui.
class CriarCategoria(CategoriaPadrao):
    pass

#Essa é a classe que o nosso sistema vai devolver para o frontend depois que a categoria for salva no banco.
class CategoriaRetorno(CategoriaPadrao):
    id: int
    model_config = ConfigDict(from_attributes=True)
#from_attributes serve para permitir que um modelo Pydantic seja criado a partir de um objeto arbitrário (como um objeto ORM) lendo seus atributos, em vez de esperar um dicionário. 

#Permite que você pegue uma instância de banco de dados (que usa pontos, ex: db_user.name) e a converta diretamente para um modelo Pydantic, 
# sem ter que transformar o objeto em um dicionário manualmente.

#Quando ativado (from_attributes=True), o método model_validate() do Pydantic passa a ser capaz de extrair valores de propriedades e atributos de instâncias de classes Python, 
# não apenas de chaves de dicionário.
