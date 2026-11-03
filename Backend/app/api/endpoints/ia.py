"""
Laurus AI — Endpoints de Análise Algorítmica e Previsão Epidemiológica
====================================================================
Endpoints disponíveis:
  GET    /api/ia/cobertura                → Motor de Estoque determinístico (todos os materiais)
  GET    /api/ia/cobertura/{id}           → Cobertura de um único material
  GET    /api/ia/previsao                 → Previsão Prophet de todos os materiais com dados
  GET    /api/ia/previsao/material/{id}   → Previsão Prophet de um material específico
  GET    /api/ia/previsao-epidemiologica  → Série temporal e previsão epidemiológica (Prophet/SINAN)
  GET    /api/ia/cruzamento               → Cruzamento direto de demanda epidemiológica com estoque
  POST   /api/ia/previsoes-salvas         → Salva snapshot completo da previsão (gráfico + filtros)
  GET    /api/ia/previsoes-salvas         → Lista previsões salvas (para o Dropdown de Alertas)
  GET    /api/ia/previsoes-salvas/{id}    → Retorna snapshot completo de uma previsão salva
  DELETE /api/ia/previsoes-salvas/{id}    → Remove uma previsão salva
  GET    /api/ia/analise-estoque          → Análise Algorítmica de Estoque cruzada com Previsão Salva
  POST   /api/ia/assistente/consulta      → Assistente dinâmico com dados reais do banco
"""

import json
import os
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.motor_estoque import (
    calcular_cobertura,
    calcular_cobertura_todos,
    analisar_estoque_algoritmico,
)
from app.core.previsao_epidemiologica import (
    prever_demanda_material,
    prever_demanda_todos,
    prever_casos_epidemiologicos,
)
from app.core.ai_guard import check_ai_quota
from app.core.security import get_current_user
from app.core.limiter import limiter
from app.models.models import Usuario, PrevisaoSalva

logger = logging.getLogger("stockia.ia")

router = APIRouter()


# =====================================================================
# SCHEMAS DE ENTRADA
# =====================================================================
class JustificativaRequest(BaseModel):
    material_ids: list[int]
    doenca_nome: Optional[str] = None
    contexto_epidemiologico: Optional[str] = None


class SalvarPrevisaoRequest(BaseModel):
    nome: Optional[str] = None
    titulo: Optional[str] = None
    doenca: str
    localidades: List[str]
    data_inicio: Optional[str] = None
    data_fim: Optional[str] = None
    horizonte_semanas: int = 8
    periodo_historico_meses: int = 24
    modo: str = "ampliado"
    faixa_etaria: str = "todas"
    sexo: str = "todos"
    casos_recentes: Optional[Any] = None
    casos_previstos: Optional[int] = None
    casos_dengue_previstos: Optional[int] = None
    casos_influenza_previstos: Optional[int] = None
    mudanca_esperada_pct: Optional[float] = None
    pico_data: Optional[str] = None
    pico_casos: Optional[int] = None
    tendencia: Optional[str] = None
    grau_confianca: float = 80.0
    dados_completos: Dict[str, Any]


# =====================================================================
# ENDPOINT 1 — Cobertura geral de todos os materiais
# =====================================================================
@router.get("/cobertura", summary="Cobertura de todos os materiais ativos")
def cobertura_geral(
    apenas_criticos: bool = Query(False, description="Se true, retorna apenas COMPRAR"),
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
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
    _user: Usuario = Depends(get_current_user),
):
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
    _user: Usuario = Depends(get_current_user),
):
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
    _user: Usuario = Depends(get_current_user),
):
    try:
        resultado = prever_demanda_material(material_id, db, horizonte_dias=horizonte_dias)
        return resultado
    except Exception as exc:
        logger.error("Erro ao prever material %d: %s", material_id, exc)
        raise HTTPException(status_code=500, detail="Erro interno na previsão.")


# =====================================================================
# ENDPOINT 5 — Justificativa técnica via Gemini (Legado / Chatbot Fase 5)
# =====================================================================
@router.post("/justificativa", summary="Gera justificativa técnica de compras via Gemini")
@limiter.limit("10/minute")
def gerar_justificativa(
    request: Request,
    body: JustificativaRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key or api_key.startswith("COLE_"):
        raise HTTPException(
            status_code=503,
            detail="Chave GEMINI_API_KEY não configurada. Adicione ao .env e reinicie o servidor.",
        )

    check_ai_quota()

    coberturas = []
    for mid in body.material_ids[:10]:
        cob = calcular_cobertura(mid, db)
        if cob.get("nome"):
            coberturas.append(cob)

    if not coberturas:
        raise HTTPException(status_code=404, detail="Nenhum material válido encontrado para os IDs informados.")

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
Com base nos dados abaixo do sistema Laurus AI, redija uma justificativa técnica FORMAL e CONCISA
para abertura de processo de compra de materiais laboratoriais.

MATERIAIS ANALISADOS:
{linhas_materiais}
{contexto_epidemio}

INSTRUÇÕES:
- Use linguagem técnica e formal (adequada para documentos oficiais de compras hospitalares)
- Mencione o risco de ruptura de estoque e o impacto na continuidade do diagnóstico laboratorial
- Cite os números de cobertura e lead time de forma objetiva
- Seja direto, sem introduções longas. Entre 200 e 400 palavras.
- IMPORTANTE: Conclua o texto com um parágrafo final de encerramento. Nunca deixe o texto incompleto.
- Escreva em português do Brasil.

JUSTIFICATIVA:"""

    try:
        from google import genai as google_genai  # type: ignore

        client = google_genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
            config={
                "max_output_tokens": 2048,
                "temperature": 0.3,
            },
        )
        texto = response.text.strip()
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
    periodo_historico_meses: int = Query(24, description="Meses de histórico"),
    data_inicio: Optional[str] = Query(None, description="Mês/Ano inicial (YYYY-MM)"),
    data_fim: Optional[str] = Query(None, description="Mês/Ano final (YYYY-MM)"),
    modo: str = Query("ampliado", description="ampliado (todos os notificados) | conservador (confirmados)"),
    faixa_etaria: str = Query("todas", description="todas | 0-19 | 20-59 | 60+"),
    sexo: str = Query("todos", description="todos | F | M"),
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
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
            data_inicio=data_inicio,
            data_fim=data_fim,
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
# ENDPOINT 8 — CRUD de Previsões Epidemiológicas Salvas (Fase 2.1)
# =====================================================================
@router.post("/previsoes-salvas", summary="Salva o snapshot completo da previsão epidemiológica e filtros")
def salvar_previsao_epidemiologica(
    body: SalvarPrevisaoRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Persiste todos os filtros ativos, métricas, grau de confiança e dados completos
    do gráfico para consumo na tela de Alertas / Análise Algorítmica de Estoque.
    """
    try:
        dados = body.dados_completos or {}
        indicadores = dados.get("indicadores", {})
        distribuicao = dados.get("distribuicao", {})
        serie = dados.get("serie_temporal", [])

        # Calcula casos previstos por doença a partir da distribuição, do body ou da série
        deng_prev = int(body.casos_dengue_previstos or distribuicao.get("dengue", {}).get("casos", 0) or 0)
        flu_prev = int(body.casos_influenza_previstos or distribuicao.get("influenza", {}).get("casos", 0) or 0)

        if deng_prev == 0 and flu_prev == 0 and serie:
            s_deng = sum(float(p.get("dengue_casos") or 0) for p in serie if p.get("tipo") == "previsto")
            s_flu = sum(float(p.get("influenza_casos") or 0) for p in serie if p.get("tipo") == "previsto")
            deng_prev = int(round(s_deng))
            flu_prev = int(round(s_flu))

        tot_prev = int(body.casos_previstos or indicadores.get("casos_previstos", deng_prev + flu_prev) or (deng_prev + flu_prev))
        if body.doenca == "Dengue" and deng_prev == 0:
            deng_prev = tot_prev
        elif body.doenca == "Influenza" and flu_prev == 0:
            flu_prev = tot_prev

        loc_str = ", ".join(body.localidades) if body.localidades else "Santos"
        agora_str = datetime.now().strftime("%d/%m/%Y %H:%M")

        nome_final = (body.nome or body.titulo or "").strip()
        if not nome_final:
            nome_final = f"{body.doenca} · {loc_str} · {body.horizonte_semanas} sem ({agora_str})"

        conf_val = body.grau_confianca or 80.0
        if conf_val <= 1.0:
            conf_val = round(conf_val * 100.0, 1)

        nova = PrevisaoSalva(
            nome=nome_final,
            usuario_id=current_user.id if current_user else None,
            doenca=body.doenca,
            localidades=loc_str,
            data_inicio=body.data_inicio,
            data_fim=body.data_fim,
            horizonte_semanas=body.horizonte_semanas,
            periodo_historico_meses=body.periodo_historico_meses,
            modo=body.modo,
            faixa_etaria=body.faixa_etaria,
            sexo=body.sexo,
            fonte="SINAN",
            grau_confianca=conf_val,
            casos_recentes_str=str(body.casos_recentes if body.casos_recentes is not None else indicadores.get("casos_recentes", "0")),
            casos_previstos_total=tot_prev,
            casos_dengue_previstos=deng_prev,
            casos_influenza_previstos=flu_prev,
            mudanca_esperada_pct=float(body.mudanca_esperada_pct if body.mudanca_esperada_pct is not None else (indicadores.get("mudanca_esperada_pct", 0.0) or 0.0)),
            pico_semana=str(indicadores.get("pico_semana", "SE --")),
            pico_data=str(body.pico_data if body.pico_data is not None else indicadores.get("pico_data", "")),
            pico_casos=int(body.pico_casos if body.pico_casos is not None else (indicadores.get("pico_casos", 0) or 0)),
            tendencia=str(body.tendencia if body.tendencia is not None else indicadores.get("tendencia", "Estável")),
            dados_completos_json=json.dumps(dados, ensure_ascii=False),
        )
        db.add(nova)
        db.commit()
        db.refresh(nova)

        return {
            "id": nova.id,
            "nome": nova.nome,
            "titulo": nova.nome,
            "doenca": nova.doenca,
            "localidades": nova.localidades,
            "horizonte_semanas": nova.horizonte_semanas,
            "casos_previstos": nova.casos_previstos_total,
            "casos_previstos_total": nova.casos_previstos_total,
            "tendencia": nova.tendencia,
            "grau_confianca": nova.grau_confianca,
            "criado_em": nova.criado_em.strftime("%d/%m/%Y %H:%M") if nova.criado_em else agora_str,
        }
    except Exception as exc:
        logger.error("Erro ao salvar previsão epidemiológica: %s", exc)
        raise HTTPException(status_code=500, detail=f"Erro ao salvar previsão: {str(exc)}")


@router.get("/previsoes-salvas", summary="Lista todas as previsões epidemiológicas salvas")
def listar_previsoes_salvas(
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    registros = db.query(PrevisaoSalva).order_by(PrevisaoSalva.criado_em.desc(), PrevisaoSalva.id.desc()).all()
    return [
        {
            "id": r.id,
            "nome": r.nome,
            "titulo": r.nome,
            "doenca": r.doenca,
            "localidades": r.localidades,
            "data_inicio": r.data_inicio,
            "data_fim": r.data_fim,
            "horizonte_semanas": r.horizonte_semanas,
            "periodo_historico_meses": r.periodo_historico_meses,
            "modo": r.modo,
            "faixa_etaria": r.faixa_etaria,
            "sexo": r.sexo,
            "fonte": r.fonte,
            "grau_confianca": r.grau_confianca,
            "casos_recentes_str": r.casos_recentes_str,
            "casos_previstos": r.casos_previstos_total,
            "casos_previstos_total": r.casos_previstos_total,
            "casos_dengue_previstos": r.casos_dengue_previstos,
            "casos_influenza_previstos": r.casos_influenza_previstos,
            "mudanca_esperada_pct": r.mudanca_esperada_pct,
            "pico_semana": r.pico_semana,
            "pico_data": r.pico_data,
            "pico_casos": r.pico_casos,
            "tendencia": r.tendencia,
            "criado_em": r.criado_em.strftime("%d/%m/%Y %H:%M") if r.criado_em else "",
        }
        for r in registros
    ]


@router.get("/previsoes-salvas/{previsao_id}", summary="Obtém o snapshot completo de uma previsão salva")
def obter_previsao_salva(
    previsao_id: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    r = db.query(PrevisaoSalva).filter(PrevisaoSalva.id == previsao_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Previsão salva não encontrada.")

    try:
        dados_completos = json.loads(r.dados_completos_json)
    except Exception:
        dados_completos = {}

    return {
        "id": r.id,
        "nome": r.nome,
        "titulo": r.nome,
        "doenca": r.doenca,
        "localidades": [l.strip() for l in r.localidades.split(",") if l.strip()],
        "data_inicio": r.data_inicio,
        "data_fim": r.data_fim,
        "horizonte_semanas": r.horizonte_semanas,
        "periodo_historico_meses": r.periodo_historico_meses,
        "modo": r.modo,
        "faixa_etaria": r.faixa_etaria,
        "sexo": r.sexo,
        "fonte": r.fonte,
        "grau_confianca": r.grau_confianca,
        "casos_previstos": r.casos_previstos_total,
        "casos_previstos_total": r.casos_previstos_total,
        "criado_em": r.criado_em.strftime("%d/%m/%Y %H:%M") if r.criado_em else "",
        "dados_completos": dados_completos,
    }


@router.delete("/previsoes-salvas/{previsao_id}", summary="Remove uma previsão salva")
def excluir_previsao_salva(
    previsao_id: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    r = db.query(PrevisaoSalva).filter(PrevisaoSalva.id == previsao_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Previsão salva não encontrada.")
    db.delete(r)
    db.commit()
    return {"ok": True, "mensagem": "Previsão removida com sucesso."}


# =====================================================================
# ENDPOINT 9 — Análise Algorítmica de Estoque + Previsão Salva (Fase 2.3)
# =====================================================================
@router.get("/analise-estoque", summary="Análise algorítmica determinística de estoque cruzada com previsão salva")
def obter_analise_estoque_algoritmica(
    previsao_id: Optional[int] = Query(None, description="ID da Previsão Salva selecionada no Dropdown"),
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    """
    Executa a análise matemática de estoque (Média Móvel Ponderada + Ponto de Reposição
    + Estoque de Segurança + Demanda Epidemiológica da Previsão selecionada).
    """
    try:
        return analisar_estoque_algoritmico(db=db, previsao_salva_id=previsao_id)
    except Exception as exc:
        logger.error("Erro na análise algorítmica de estoque: %s", exc)
        raise HTTPException(status_code=500, detail=f"Erro ao calcular análise algorítmica: {str(exc)}")


# =====================================================================
# ENDPOINT 10 — Consulta Assistente Dinâmico (Sem LLM / Dados Reais)
# =====================================================================
class ConsultaAssistenteRequest(BaseModel):
    mensagem: str


@router.post("/assistente/consulta", summary="Respostas dinâmicas baseadas em regras e dados reais")
def consulta_assistente(
    body: ConsultaAssistenteRequest,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
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

        texto = f"Encontrei {len(lotes_vencendo)} lote(s) com atenção exigida nos próximos 30 dias:\n\n"
        for lote in lotes_vencendo:
            dias = (lote.data_validade - date.today()).days
            texto += f"• **{lote.material.nome}**\n  - Lote: {lote.numero_lote} (Saldo: {float(lote.quantidade_atual)} {lote.material.unidade_medida})\n  - Vence em {dias} dias.\n\n"
        texto += "**Recomendação Biomédica:** Priorizar o consumo imediato destes lotes no método PEPS."
        return {"resposta": texto}

    elif "outono" in mensagem or "doenç" in mensagem or "pico" in mensagem or "epidemiolog" in mensagem:
        res_influenza = prever_casos_epidemiologicos("Influenza", ["Santos"], db=db)
        res_dengue = prever_casos_epidemiologicos("Dengue", ["Santos"], db=db)

        pico_inf = res_influenza["indicadores"].get("pico_semana", "N/A")
        pico_inf_data = res_influenza["indicadores"].get("pico_data", "N/A")
        pico_den = res_dengue["indicadores"].get("pico_semana", "N/A")

        texto = "Analisando as previsões epidemiológicas (Prophet) para a região:\n\n"
        texto += f"1. **Influenza A/B (J10):** Tendência {res_influenza['indicadores'].get('tendencia')}. Pico esperado na semana {pico_inf} ({pico_inf_data}).\n"
        texto += f"2. **Dengue (A90):** Tendência {res_dengue['indicadores'].get('tendencia')}. Pico esperado na semana {pico_den}.\n\n"
        texto += "**Recomendação:** Acompanhe a aba Previsão Epidemiológica para cruzar as informações com as datas reais de validade dos kits diagnósticos associados."
        return {"resposta": texto}

    elif "brometo" in mensagem or "biossegurança" in mensagem or "fispq" in mensagem:
        return {"resposta": "🛡️ **Ficha de Biossegurança Padrão ANVISA (RDC 302/2005)**\n\n• **Exemplo - Brometo de Etídio:** Agente Mutagênico (Grupo B).\n• **EPIs Obrigatórios:** Luvas duplas de nitrilo, óculos de segurança contra respingos, capela de exaustão química.\n\n• **Derramamento:** Isolar, absorver a seco, descontaminar (KMnO4 + HCl diluído) e descartar no Grupo B.\n\n*Nota: O acesso a PDFs FISPQ vetoriais estará disponível em versão futura (RAG).*"}

    elif "resumo" in mensagem or "diretoria" in mensagem or "executivo" in mensagem:
        from app.models.models import Material
        from sqlalchemy import func
        total_materiais = db.query(func.count(Material.id)).filter(Material.ativo.is_(True)).scalar()
        criticos = calcular_cobertura_todos(db, apenas_criticos=True)
        texto = "📊 **RESUMO EXECUTIVO DO ESTOQUE LAURUS AI**\n\n"
        texto += f"• **Total de Itens Monitorados:** {total_materiais} materiais cadastrados ativos.\n"
        texto += f"• **Status da Reposição:** {len(criticos)} materiais identificados como nível CRÍTICO (Abaixo da linha de segurança).\n"
        texto += "\n*Relatório atualizado em tempo real no banco de dados do laboratório.*"
        return {"resposta": texto}

    else:
        return {"resposta": f"Com base nos dados atuais do seu estoque:\n\nPara **\"{body.mensagem}\"**, recomendo verificar a aba de Reposição ou Estoque.\n\nExperimente perguntar sobre vencimentos em 30 dias, resumo para diretoria, picos epidemiológicos ou procedimentos FISPQ de biossegurança."}
