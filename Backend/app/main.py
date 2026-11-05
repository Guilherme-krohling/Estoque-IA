"""
Laurus AI — API Principal
=========================
FastAPI com todas as rotas, CORS, Rate Limiting, headers de segurança e logging de auditoria.
"""

import json
import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy.exc import IntegrityError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.core.limiter import limiter
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
    ia,
    pedidos_reposicao,
    rastreabilidade,
    convenios,
    pacientes,
)

# =====================================================================
# LOGGING DE SEGURANÇA
# =====================================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
security_logger = logging.getLogger("laurus.security")

# =====================================================================
# RATE LIMITER e APLICAÇÃO
# =====================================================================
app = FastAPI(
    title="Laurus AI - Gestão de Laboratório",
    description="API para controle de estoque laboratorial com rastreabilidade, auditoria e previsão de demanda por IA.",
    version="2.0.0",
)

# Expõe o limiter para que os endpoints possam usá-lo via import
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# =====================================================================
# MIDDLEWARE — Headers de Segurança HTTP
# =====================================================================
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Injeta headers de segurança em todas as respostas da API."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        return response


app.add_middleware(SecurityHeadersMiddleware)

# =====================================================================
# CORS — Permite comunicação com o Frontend Next.js
# =====================================================================
_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    '["http://localhost:3000","http://127.0.0.1:3000","http://localhost:3001","http://127.0.0.1:3001","https://laurus-pi.vercel.app"]',
)
try:
    ALLOWED_ORIGINS = json.loads(_raw_origins)
except (json.JSONDecodeError, TypeError):
    ALLOWED_ORIGINS = ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
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
app.include_router(ia.router, prefix="/api/ia", tags=["IA — Motor de Estoque"])
app.include_router(pedidos_reposicao.router, prefix="/api/pedidos-reposicao", tags=["Pedidos de Reposição e NF"])
app.include_router(rastreabilidade.router, prefix="/api/rastreabilidade", tags=["Rastreabilidade por Paciente"])
app.include_router(convenios.router, prefix="/api/convenios", tags=["Convênios"])
app.include_router(pacientes.router, prefix="/api/pacientes", tags=["Pacientes"])


# =====================================================================
# TRATAMENTO GLOBAL DE ERROS DE INTEGRIDADE DO BANCO
# =====================================================================
@app.exception_handler(IntegrityError)
def integrity_error_handler(request: Request, exc: IntegrityError):
    return JSONResponse(
        status_code=409,
        content={"detail": "Operação viola uma restrição do banco de dados (duplicidade ou referência inválida)."},
    )


@app.get("/", tags=["Status"])
def rota_raiz():
    return {
        "aplicacao": "Laurus AI",
        "versao": "2.0.0",
        "status": "online",
        "docs": "/docs",
    }
