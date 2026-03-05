from fastapi import FastAPI, APIRouter

app = FastAPI(
    title="StockIA - Gestão de Laboratorio",
    description="API para controle de estoque de laboratório",
    version="1.0.0"
)

# Nossa primeira rota (O endpoint raiz)
@app.router.get('/')
def rota_raiz():
    return {"mensagem": "API do StockAI está online e operante!"}