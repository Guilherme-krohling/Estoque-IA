from fastapi import FastAPI
# Importamos o arquivo de rotas que acabamos de criar
from app.api.endpoints import categorias, materiais, lotes, movimentacoes

app = FastAPI(
    title="StockIA - Gestão de Laboratorio",
    description="API para controle de estoque de laboratório",
    version="1.0.0"
)

# Conectamos as rotas de categorias no servidor. 
# O prefixo "/api/v1/categorias" significa que todas as rotas daquele arquivo vão começar com isso.
app.include_router(categorias.router, prefix="/api/categorias", tags=["Categorias"])
app.include_router(materiais.router, prefix="/api/materiais", tags=["Materiais"])
# app.include_router(lotes.router, prefix="/api/lotes", tags=["Lotes"])
# app.include_router(movimentacoes.router, prefix="/api/movimentacoes", tags=["Movimentacoes"])

# Nossa primeira rota (O endpoint raiz)
@app.router.get('/')
def rota_raiz():
    return {"mensagem": "API do StockAI está online e operante!"}