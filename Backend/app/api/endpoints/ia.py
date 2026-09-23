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
from app.core.previsao_epidemiologica import (
    prever_demanda_material,
    prever_demanda_todos,
    prever_casos_epidemiologicos,
)
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


# =====================================================================
# ENDPOINT 6 — Previsão Epidemiológica Completa (Tela Nova)
# =====================================================================
@router.get("/previsao-epidemiologica", summary="Previsão epidemiológica por doença e localidade")
def obter_previsao_epidemiologica(
    doenca: str = Query("Dengue", description="Dengue | Influenza | Ambas"),
    localidades: str = Query("Santos", description="Localidades separadas por vírgula"),
    horizonte_semanas: int = Query(8, ge=4, le=20, description="Próximas X semanas (4 a 20)"),
    periodo_historico_meses: int = Query(24, description="12 | 24 | 36 meses"),
    modo: str = Query("ampliado", description="ampliado (todos os notificados) | conservador (confirmados)"),
    faixa_etaria: str = Query("todas", description="todas | 0-19 | 20-59 | 60+"),
    sexo: str = Query("todos", description="todos | F | M"),
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    """
    Retorna a análise e projeção epidemiológica via Prophet, indicadores,
    série temporal para gráfico, panorama textual e potencial impacto laboratorial.
    """
    try:
        loc_list = [l.strip() for l in localidades.split(",") if l.strip()]
        if not loc_list:
            loc_list = ["Santos"]

        resultado = prever_casos_epidemiologicos(
            doenca_nome=doenca,
            localidades=loc_list,
            horizonte_semanas=horizonte_semanas,
            periodo_historico_meses=periodo_historico_meses,
            modo=modo,
            faixa_etaria=faixa_etaria,
            sexo=sexo,
            db=db,
        )
        return resultado
    except Exception as exc:
        logger.error("Erro ao gerar previsão epidemiológica: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao processar modelo epidemiológico: {str(exc)}"
        )


# =====================================================================
# ENDPOINT 7 — Cruzamento Direto de Insumos com Estoque
# =====================================================================
@router.get("/cruzamento", summary="Cruzamento de demanda epidemiológica com estoque físico")
def obter_cruzamento_estoque(
    doenca: str = Query("Dengue", description="Dengue | Influenza | Ambas"),
    localidades: str = Query("Santos", description="Localidades separadas por vírgula"),
    horizonte_semanas: int = Query(8, ge=4, le=20),
    modo: str = Query("ampliado"),
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    """
    Retorna o cruzamento detalhado entre a demanda projetada pela curva
    epidemiológica e os saldos em estoque dos lotes ativos (FEFO).
    """
    try:
        loc_list = [l.strip() for l in localidades.split(",") if l.strip()]
        resultado = prever_casos_epidemiologicos(
            doenca_nome=doenca,
            localidades=loc_list or ["Santos"],
            horizonte_semanas=horizonte_semanas,
            modo=modo,
            db=db,
        )
        return {
            "doenca": doenca,
            "localidades": loc_list,
            "horizonte_semanas": horizonte_semanas,
            "modo": modo,
            "casos_previstos": resultado["indicadores"]["casos_previstos"],
            "impacto_materiais": resultado["impacto_demanda"]["materiais"],
        }
    except Exception as exc:
        logger.error("Erro no cruzamento epidemiológico: %s", exc)
        raise HTTPException(status_code=500, detail=f"Erro no cruzamento: {str(exc)}")


# =====================================================================
# ENDPOINT 6 — Consulta Assistente Dinâmico (Sem LLM / Dados Reais)
# =====================================================================
class ConsultaAssistenteRequest(BaseModel):
    mensagem: str

@router.post("/assistente/consulta", summary="Respostas dinâmicas baseadas em regras e dados reais")
def consulta_assistente(
    body: ConsultaAssistenteRequest,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    """
    Recebe a pergunta do usuário, identifica o tema e retorna dados formatados
    diretamente do banco de dados (Substitui as respostas estáticas).
    """
    mensagem = body.mensagem.lower()
    
    if "vencer" in mensagem or "30 dias" in mensagem or "validade" in mensagem:
        from datetime import date, timedelta
        limite = date.today() + timedelta(days=30)
        from app.models.models import Lote, Material
        lotes_vencendo = db.query(Lote).join(Material).filter(
            Lote.data_validade <= limite,
            Lote.data_validade >= date.today(),
            Lote.quantidade_atual > 0
        ).order_by(Lote.data_validade.asc()).all()
        
        if not lotes_vencendo:
            return {"resposta": "Excelente notícia! Não há lotes com vencimento previsto para os próximos 30 dias com saldo em estoque."}
            
        texto = f"Encontrei {len(lotes_vencendo)} lote(s) com atenção exigida nos próximos 30 dias:\\n\\n"
        for lote in lotes_vencendo:
            dias = (lote.data_validade - date.today()).days
            texto += f"• **{lote.material.nome}**\\n  - Lote: {lote.numero_lote} (Saldo: {float(lote.quantidade_atual)} {lote.material.unidade_medida})\\n  - Vence em {dias} dias.\\n\\n"
        texto += "**Recomendação Biomédica:** Priorizar o consumo imediato destes lotes no método PEPS."
        return {"resposta": texto}
        
    elif "outono" in mensagem or "doenç" in mensagem or "pico" in mensagem or "epidemiolog" in mensagem:
        res_influenza = prever_casos_epidemiologicos("Influenza", ["Santos"], db=db)
        res_dengue = prever_casos_epidemiologicos("Dengue", ["Santos"], db=db)
        
        pico_inf = res_influenza["indicadores"].get("pico_semana", "N/A")
        pico_inf_data = res_influenza["indicadores"].get("pico_data", "N/A")
        pico_den = res_dengue["indicadores"].get("pico_semana", "N/A")
        
        texto = "Analisando as previsões epidemiológicas (Prophet) para a região:\\n\\n"
        texto += f"1. **Influenza A/B (J10):** Tendência {res_influenza['indicadores'].get('tendencia')}. Pico esperado na semana {pico_inf} ({pico_inf_data}).\\n"
        texto += f"2. **Dengue (A90):** Tendência {res_dengue['indicadores'].get('tendencia')}. Pico esperado na semana {pico_den}.\\n\\n"
        texto += "**Recomendação:** Acompanhe a aba Previsão Epidemiológica para cruzar as informações com as datas reais de validade dos kits diagnósticos associados."
        return {"resposta": texto}
        
    elif "brometo" in mensagem or "biossegurança" in mensagem or "fispq" in mensagem:
        return {"resposta": "🛡️ **Ficha de Biossegurança Padrão ANVISA (RDC 302/2005)**\\n\\n• **Exemplo - Brometo de Etídio:** Agente Mutagênico (Grupo B).\\n• **EPIs Obrigatórios:** Luvas duplas de nitrilo, óculos de segurança contra respingos, capela de exaustão química.\\n\\n• **Derramamento:** Isolar, absorver a seco, descontaminar (KMnO4 + HCl diluído) e descartar no Grupo B.\\n\\n*Nota: O acesso a PDFs FISPQ vetoriais estará disponível em versão futura (RAG).*"}
        
    elif "resumo" in mensagem or "diretoria" in mensagem or "executivo" in mensagem:
        from app.models.models import Material, Lote
        from sqlalchemy import func
        total_materiais = db.query(func.count(Material.id)).filter(Material.ativo == True).scalar()
        criticos = calcular_cobertura_todos(db, apenas_criticos=True)
        texto = f"📊 **RESUMO EXECUTIVO DO ESTOQUE STOCKIA**\\n\\n"
        texto += f"• **Total de Itens Monitorados:** {total_materiais} materiais cadastrados ativos.\\n"
        texto += f"• **Status da Reposição:** {len(criticos)} materiais identificados como nível CRÍTICO (Abaixo da linha de segurança).\\n"
        texto += f"\\n*Relatório atualizado em tempo real no banco de dados do laboratório.*"
        return {"resposta": texto}
        
    else:
        return {"resposta": f"Com base nos dados atuais do seu estoque:\\n\\nPara **\\\"{body.mensagem}\\\"**, recomendo verificar a aba de Reposição ou Estoque.\\n\\nExperimente perguntar sobre vencimentos em 30 dias, resumo para diretoria, picos epidemiológicos ou procedimentos FISPQ de biossegurança."}
