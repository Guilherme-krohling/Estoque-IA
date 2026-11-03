"""
Laurus AI — Endpoints de Rastreabilidade de Materiais por Paciente, Convênio e Exames (Fase 4.2)
================================================================================================
Permite vincular a baixa/utilização de materiais e lotes a pacientes atendidos no laboratório,
registrando o convênio e a lista completa de exames realizados, com auditoria cruzada.
"""

import json
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.db.database import get_db
from app.core.security import get_current_user
from app.models.models import (
    AtendimentoPaciente,
    ConsumoMaterialPaciente,
    Material,
    Lote,
    MovimentacaoEstoque,
    Usuario,
)

router = APIRouter()


# =====================================================================
# SCHEMAS PYDANTIC
# =====================================================================
class ItemConsumoPacienteInput(BaseModel):
    lote_id: int
    quantidade: float
    exame_especifico: Optional[str] = None


class RegistrarAtendimentoRastreavelRequest(BaseModel):
    paciente_nome: str
    paciente_documento: Optional[str] = None
    convenio: str
    codigo_atendimento: Optional[str] = None
    exames: List[str]
    observacoes: Optional[str] = None
    itens_consumidos: List[ItemConsumoPacienteInput]


def _parse_exames(exames_json_str: Optional[str]) -> List[str]:
    if not exames_json_str:
        return []
    try:
        parsed = json.loads(exames_json_str)
        if isinstance(parsed, list):
            return [str(x).strip() for x in parsed if str(x).strip()]
    except Exception:
        pass
    return [x.strip() for x in exames_json_str.split(",") if x.strip()]


def _serializar_consumo(c: ConsumoMaterialPaciente) -> dict:
    atd = c.atendimento
    exames_lista = _parse_exames(atd.exames_json if atd else "[]")
    qtd_exames = len(exames_lista)
    mat_nome = c.material.nome if c.material else f"Material #{c.material_id}"
    num_lote = c.lote.numero_lote if c.lote else f"Lote #{c.lote_id}"
    pac_nome = atd.paciente_nome if atd else "Paciente"
    conv_nome = atd.convenio if atd else "Particular"

    descricao_narrativa = (
        f"{mat_nome} (Lote {num_lote}) foi utilizado no paciente {pac_nome} "
        f"(convênio {conv_nome}), que realizou {qtd_exames} exame(s): "
        f"{', '.join(exames_lista) if exames_lista else 'Exame laboratorial'}."
    )

    return {
        "id": c.id,
        "atendimento_id": c.atendimento_id,
        "codigo_atendimento": atd.codigo_atendimento if atd else "-",
        "data_atendimento": atd.data_atendimento.isoformat() if (atd and atd.data_atendimento) else None,
        "paciente_nome": pac_nome,
        "paciente_documento": atd.paciente_documento if atd else None,
        "convenio": conv_nome,
        "qtd_exames": qtd_exames,
        "exames_realizados": exames_lista,
        "exame_especifico": c.exame_especifico,
        "material_id": c.material_id,
        "material_nome": mat_nome,
        "codigo_catalogo": c.material.codigo_catalogo if c.material else None,
        "lote_id": c.lote_id,
        "numero_lote": num_lote,
        "data_validade_lote": c.lote.data_validade.isoformat() if (c.lote and c.lote.data_validade) else None,
        "quantidade_utilizada": float(c.quantidade_utilizada or 0),
        "unidade_medida": c.unidade_medida or (c.material.unidade_medida if c.material else "un"),
        "movimentacao_id": c.movimentacao_id,
        "usuario_nome": atd.usuario.nome if (atd and atd.usuario) else "-",
        "observacoes": atd.observacoes if atd else None,
        "descricao_rastreabilidade": descricao_narrativa,
        "criado_em": c.criado_em.isoformat() if c.criado_em else None,
    }


# =====================================================================
# ENDPOINTS
# =====================================================================
@router.get("/")
def listar_rastreabilidade(
    material_id: Optional[int] = Query(None),
    lote_id: Optional[int] = Query(None),
    paciente: Optional[str] = Query(None),
    convenio: Optional[str] = Query(None),
    exame: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    """
    Lista todos os registros de rastreabilidade (Material -> Lote -> Paciente -> Convênio -> Exames).
    """
    query = (
        db.query(ConsumoMaterialPaciente)
        .join(AtendimentoPaciente, ConsumoMaterialPaciente.atendimento_id == AtendimentoPaciente.id)
        .options(
            joinedload(ConsumoMaterialPaciente.atendimento).joinedload(AtendimentoPaciente.usuario),
            joinedload(ConsumoMaterialPaciente.material),
            joinedload(ConsumoMaterialPaciente.lote),
        )
    )

    if material_id:
        query = query.filter(ConsumoMaterialPaciente.material_id == material_id)
    if lote_id:
        query = query.filter(ConsumoMaterialPaciente.lote_id == lote_id)
    if paciente:
        query = query.filter(AtendimentoPaciente.paciente_nome.ilike(f"%{paciente.strip()}%"))
    if convenio:
        query = query.filter(AtendimentoPaciente.convenio.ilike(f"%{convenio.strip()}%"))

    consumos = query.order_by(AtendimentoPaciente.data_atendimento.desc(), ConsumoMaterialPaciente.id.desc()).all()
    serializados = [_serializar_consumo(c) for c in consumos]

    if exame and exame.strip():
        termo_exame = exame.strip().lower()
        serializados = [
            item
            for item in serializados
            if any(termo_exame in ex.lower() for ex in item["exames_realizados"])
            or (item["exame_especifico"] and termo_exame in item["exame_especifico"].lower())
        ]

    pacientes_unicos = {item["paciente_nome"] for item in serializados}
    convenios_unicos = {item["convenio"] for item in serializados}
    atendimentos_vistos = {}
    for item in serializados:
        atendimentos_vistos[item["atendimento_id"]] = item["qtd_exames"]

    return {
        "resumo": {
            "total_registros_uso": len(serializados),
            "total_pacientes_atendidos": len(pacientes_unicos),
            "total_convenios": len(convenios_unicos),
            "total_exames_realizados": sum(atendimentos_vistos.values()),
        },
        "itens": serializados,
    }


@router.post("/atendimentos", status_code=201)
def registrar_uso_paciente(
    body: RegistrarAtendimentoRastreavelRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Registra um atendimento de paciente (com convênio e lista de exames realizados)
    e realiza automaticamente a baixa (USO) dos materiais/lotes consumidos.
    """
    pac_nome = (body.paciente_nome or "").strip()
    if not pac_nome:
        raise HTTPException(status_code=400, detail="Informe o nome do paciente.")

    conv_nome = (body.convenio or "").strip() or "Particular"
    exames_limpos = [ex.strip() for ex in (body.exames or []) if ex and ex.strip()]
    if not exames_limpos:
        raise HTTPException(status_code=400, detail="Informe ao menos 1 exame realizado pelo paciente.")

    if not body.itens_consumidos:
        raise HTTPException(status_code=400, detail="Informe ao menos 1 material/lote utilizado no atendimento.")

    # Valida todos os lotes antes de aplicar a baixa
    lotes_validados = []
    hoje = date.today()
    for item in body.itens_consumidos:
        if item.quantidade <= 0:
            raise HTTPException(status_code=400, detail="A quantidade utilizada deve ser maior que zero.")

        lote = (
            db.query(Lote)
            .options(joinedload(Lote.material))
            .filter(Lote.id == item.lote_id)
            .first()
        )
        if not lote:
            raise HTTPException(status_code=404, detail=f"Lote #{item.lote_id} não encontrado.")

        if lote.data_validade and lote.data_validade < hoje:
            raise HTTPException(
                status_code=400,
                detail=f"Bloqueado por Validade: O lote {lote.numero_lote} está vencido!",
            )

        saldo_lote = Decimal(str(lote.quantidade_atual or 0))
        qtd_dec = Decimal(str(item.quantidade))
        if saldo_lote < qtd_dec:
            raise HTTPException(
                status_code=400,
                detail=f"Saldo insuficiente no lote {lote.numero_lote}! Disponível: {saldo_lote}, Solicitado: {qtd_dec}",
            )

        lotes_validados.append((lote, qtd_dec, item.exame_especifico))

    codigo_atd = (body.codigo_atendimento or "").strip()
    if not codigo_atd:
        codigo_atd = f"ATD-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

    novo_atd = AtendimentoPaciente(
        codigo_atendimento=codigo_atd,
        paciente_nome=pac_nome,
        paciente_documento=(body.paciente_documento or "").strip() or None,
        convenio=conv_nome,
        exames_json=json.dumps(exames_limpos, ensure_ascii=False),
        usuario_id=current_user.id if current_user else None,
        observacoes=body.observacoes,
    )
    db.add(novo_atd)
    db.flush()

    consumos_criados = []
    resumo_exames_motivo = ", ".join(exames_limpos[:3]) + (
        f" (+{len(exames_limpos) - 3})" if len(exames_limpos) > 3 else ""
    )

    for lote, qtd_dec, exame_esp in lotes_validados:
        # Subtrai saldo do lote
        lote.quantidade_atual = Decimal(str(lote.quantidade_atual or 0)) - qtd_dec
        unidade = lote.material.unidade_medida if lote.material else "un"

        # Gera movimentação de auditoria (USO)
        mov = MovimentacaoEstoque(
            lote_id=lote.id,
            usuario_id=current_user.id if current_user else 1,
            tipo="USO",
            quantidade=qtd_dec,
            unidade_medida=unidade,
            motivo=f"Paciente: {pac_nome} ({conv_nome}) · {len(exames_limpos)} exame(s): {resumo_exames_motivo}",
            referencia=codigo_atd,
        )
        db.add(mov)
        db.flush()

        consumo = ConsumoMaterialPaciente(
            atendimento_id=novo_atd.id,
            material_id=lote.material_id,
            lote_id=lote.id,
            movimentacao_id=mov.id,
            quantidade_utilizada=qtd_dec,
            unidade_medida=unidade,
            exame_especifico=exame_esp or None,
        )
        db.add(consumo)
        db.flush()
        consumos_criados.append(consumo)

    db.commit()
    for c in consumos_criados:
        db.refresh(c)

    return {
        "atendimento_id": novo_atd.id,
        "codigo_atendimento": novo_atd.codigo_atendimento,
        "paciente_nome": novo_atd.paciente_nome,
        "convenio": novo_atd.convenio,
        "qtd_exames": len(exames_limpos),
        "exames_realizados": exames_limpos,
        "consumos": [_serializar_consumo(c) for c in consumos_criados],
    }

