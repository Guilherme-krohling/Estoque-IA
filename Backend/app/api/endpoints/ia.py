"""
StockIA — Endpoints de IA
==========================
Endpoints disponíveis:
  GET  /api/ia/cobertura                → Motor de Estoque determinístico (todos os materiais)
  GET  /api/ia/cobertura/{id}           → Cobertura de um único material
  GET  /api/ia/previsao                 → Previsão Prophet de todos os materiais com dados
  GET  /api/ia/previsao/material/{id}   → Previsão Prophet de um material específico
  POST /api/ia/justificativa            → Texto explicativo gerado pelo Gemini
"""

import os
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.motor_estoque import calcular_cobertura, calcular_cobertura_todos
from app.core.previsao_epidemiologica import prever_demanda_material, prever_demanda_todos
from app.core.ai_guard import check_ai_quota
from app.core.security import get_current_user
from app.core.limiter import limiter
from app.models.models import Usuario

logger = logging.getLogger("stockia.ia")

router = APIRouter()


# =====================================================================
# SCHEMAS DE ENTRADA
# =====================================================================
class JustificativaRequest(BaseModel):
    material_ids: list[int]
    doenca_nome: Optional[str] = None
    contexto_epidemiologico: Optional[str] = None


# =====================================================================
# ENDPOINT 1 — Cobertura geral de todos os materiais
# =====================================================================
@router.get("/cobertura", summary="Cobertura de todos os materiais ativos")
def cobertura_geral(
    apenas_criticos: bool = Query(False, description="Se true, retorna apenas COMPRAR"),
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),  # 🔒 JWT obrigatório
):
    """
    Calcula o indicador de cobertura de dias para TODOS os materiais ativos.
    Usa o motor determinístico (matemática pura, sem IA generativa).
    """
    try:
        resultados = calcular_cobertura_todos(db, apenas_criticos=apenas_criticos)
        return resultados
    except Exception as exc:
        logger.error("Erro ao calcular cobertura geral: %s", exc)
        raise HTTPException(status_code=500, detail="Erro interno ao calcular cobertura de estoque.")


# =====================================================================
# ENDPOINT 2 — Cobertura de um único material
# =====================================================================
@router.get("/cobertura/{material_id}", summary="Cobertura de um material específico")
def cobertura_material(
    material_id: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),  # 🔒 JWT obrigatório
):
    """
    Calcula indicadores de estoque para um único material pelo ID.
    """
    try:
        resultado = calcular_cobertura(material_id, db)
        return resultado
    except Exception as exc:
        logger.error("Erro ao calcular cobertura material %d: %s", material_id, exc)
        raise HTTPException(status_code=500, detail="Erro interno ao calcular cobertura.")


# =====================================================================
# ENDPOINT 3 — Previsão Prophet de todos os materiais
# =====================================================================
@router.get("/previsao", summary="Previsão epidemiológica de todos os materiais")
def previsao_geral(
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),  # 🔒 JWT obrigatório
):
    """
    Roda o Prophet em todos os materiais com histórico suficiente (≥14 dias).
    Retorna lista ordenada por risco_surto (ALTO primeiro).
    """
    try:
        resultados = prever_demanda_todos(db)
        return resultados
    except Exception as exc:
        logger.error("Erro ao calcular previsão geral: %s", exc)
        raise HTTPException(status_code=500, detail="Erro interno na previsão epidemiológica.")


# =====================================================================
# ENDPOINT 4 — Previsão Prophet de um único material
# =====================================================================
@router.get("/previsao/material/{material_id}", summary="Previsão epidemiológica de um material")
def previsao_material(
    material_id: int,
    horizonte_dias: int = Query(56, ge=7, le=180, description="Dias de previsão (7–180)"),
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),  # 🔒 JWT obrigatório
):
    """
    Roda o Prophet para um único material pelo ID.
    Retorna previsão de consumo + tendência + classificação de risco.
    """
    try:
        resultado = prever_demanda_material(material_id, db, horizonte_dias=horizonte_dias)
        return resultado
    except Exception as exc:
        logger.error("Erro ao prever material %d: %s", material_id, exc)
        raise HTTPException(status_code=500, detail="Erro interno na previsão.")


# =====================================================================
# ENDPOINT 5 — Justificativa técnica via Gemini
# =====================================================================
@router.post("/justificativa", summary="Gera justificativa técnica de compras via Gemini")
@limiter.limit("10/minute")  # 🔒 Máx. 10 chamadas ao Gemini por IP por minuto (anti-custo)
def gerar_justificativa(
    request: Request,  # necessário para o slowapi
    body: JustificativaRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),  # 🔒 JWT obrigatório
):
    """
    Recebe IDs de materiais, monta contexto com os dados do Motor de Estoque
    e pede ao Gemini uma justificativa técnica formal para compras.

    Retorna:
        { "texto": "..." }
    """
    # --- 1. Verifica API Key ---
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key or api_key.startswith("COLE_"):
        raise HTTPException(
            status_code=503,
            detail="Chave GEMINI_API_KEY não configurada. Adicione ao .env e reinicie o servidor.",
        )

    # --- 2. Circuit Breaker (anti-custo) ---
    check_ai_quota()  # lança HTTP 429 se o limite for atingido

    # --- 3. Coleta dados do Motor de Estoque para os materiais solicitados ---
    coberturas = []
    for mid in body.material_ids[:10]:  # Limita a 10 materiais por chamada
        cob = calcular_cobertura(mid, db)
        if cob.get("nome"):
            coberturas.append(cob)

    if not coberturas:
        raise HTTPException(status_code=404, detail="Nenhum material válido encontrado para os IDs informados.")

    # --- 4. Monta o prompt ---
    linhas_materiais = "\n".join(
        f"  - {c['nome']} | Saldo: {c['saldo_atual']} {c['unidade_medida']} | "
        f"Cobertura: {c['cobertura_dias']} dias | Lead Time: {c['lead_time_dias']} dias | "
        f"Risco: {c['risco']} | Recomendação: Comprar {c['quantidade_recomendada_comprar']} {c['unidade_medida']}"
        for c in coberturas
    )

    contexto_epidemio = ""
    if body.doenca_nome:
        contexto_epidemio = f"\nContexto epidemiológico: {body.doenca_nome}"
    if body.contexto_epidemiologico:
        contexto_epidemio += f"\n{body.contexto_epidemiologico}"

    prompt = f"""Você é um sistema especialista em gestão de estoque laboratorial biomédico.
Com base nos dados abaixo do sistema StockIA, redija uma justificativa técnica FORMAL e CONCISA
para abertura de processo de compra de materiais laboratoriais.

MATERIAIS ANALISADOS:
{linhas_materiais}
{contexto_epidemio}

INSTRUÇÕES:
- Use linguagem técnica e formal (adequada para documentos oficiais de compras hospitalares)
- Mencione o risco de ruptura de estoque e o impacto na continuidade do diagnóstico laboratorial
- Cite os números de cobertura e lead time de forma objetiva
- Seja direto, sem introduções longas. Máximo 250 palavras.
- Escreva em português do Brasil.

JUSTIFICATIVA:"""

    # --- 5. Chama o Gemini (google-genai >= 1.0) ---
    try:
        from google import genai as google_genai  # type: ignore  # nova biblioteca oficial

        client = google_genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-3.6-flash",  # modelo atual disponível nesta conta API
            contents=prompt,
            config={
                "max_output_tokens": 1500,  # Limita custo de tokens
                "temperature": 0.3,         # Mais factual, menos criativo
            },
        )
        texto = response.text.strip()
        logger.info("Gemini 2.5-flash chamado com sucesso para %d materiais.", len(coberturas))
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Biblioteca google-genai não instalada. Execute: pip install google-genai",
        )
    except Exception as exc:
        logger.error("Erro na chamada ao Gemini: %s", exc)
        raise HTTPException(
            status_code=502,
            detail=f"Falha ao consultar o Gemini: {str(exc)[:200]}",
        )

    return {"texto": texto, "materiais_analisados": len(coberturas)}
