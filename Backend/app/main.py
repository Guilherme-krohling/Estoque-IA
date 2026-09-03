"""
StockIA — API Principal
=========================
FastAPI com todas as rotas, CORS e documentação Swagger.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.api.endpoints import (
    auth,
    usuarios,
    categorias,
    materiais,
    lotes,
    movimentacoes,
    fornecedores,
    doencas,
    locais,
    relatorios,
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
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
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
app.include_router(locais.router, prefix="/api/locais", tags=["Locais de Armazenamento"])
app.include_router(relatorios.router, prefix="/api/relatorios", tags=["Relatórios"])


# =====================================================================
# TRATAMENTO GLOBAL DE ERROS DE INTEGRIDADE DO BANCO
# =====================================================================
@app.exception_handler(IntegrityError)
def integrity_error_handler(request: Request, exc: IntegrityError):
    """Converte violações de integridade (FK, UNIQUE, NOT NULL) em 409 amigável
    em vez de vazar stacktrace 500."""
    return JSONResponse(
        status_code=409,
        content={"detail": "Operação viola uma restrição do banco de dados (duplicidade ou referência inválida)."},
    )


@app.get("/", tags=["Status"])
def rota_raiz():
    return {
        "aplicacao": "StockIA",
        "versao": "2.0.0",
        "status": "online",
        "docs": "/docs",
    }