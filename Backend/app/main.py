"""
StockIA — API Principal
=========================
FastAPI com todas as rotas, CORS e documentação Swagger.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.endpoints import (
    auth,
    usuarios,
    categorias,
    materiais,
    lotes,
    movimentacoes,
    fornecedores,
    doencas,
)

app = FastAPI(
    title="StockIA - Gestão de Laboratório",
    description="API para controle de estoque laboratorial com rastreabilidade, auditoria e previsão de demanda por IA.",
    version="2.0.0",
)

# =====================================================================
# CORS — Permite comunicação com o Frontend Next.js
# =====================================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",   # Next.js dev
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================================
# ROTAS
# =====================================================================
app.include_router(auth.router, prefix="/api/auth", tags=["Autenticação"])
app.include_router(usuarios.router, prefix="/api/usuarios", tags=["Usuários"])
app.include_router(categorias.router, prefix="/api/categorias", tags=["Categorias"])
app.include_router(materiais.router, prefix="/api/materiais", tags=["Materiais"])
app.include_router(lotes.router, prefix="/api/lotes", tags=["Lotes"])
app.include_router(movimentacoes.router, prefix="/api/movimentacoes", tags=["Movimentações"])
app.include_router(fornecedores.router, prefix="/api/fornecedores", tags=["Fornecedores"])
app.include_router(doencas.router, prefix="/api/doencas", tags=["Doenças"])


@app.get("/", tags=["Status"])
def rota_raiz():
    return {
        "aplicacao": "StockIA",
        "versao": "2.0.0",
        "status": "online",
        "docs": "/docs",
    }