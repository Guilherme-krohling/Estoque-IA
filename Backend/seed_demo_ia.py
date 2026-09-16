"""
StockIA — Seed de Dados de Demonstração para Banca de TCC
===========================================================
Insere no banco SQLite:
  1. Doenças sazonais com CID-10 e meses de pico
  2. Categorias de insumos
  3. Fornecedores
  4. Materiais laboratoriais vinculados às doenças
  5. Local de armazenamento padrão
  6. Lotes com saldo inicial
  7. Histórico simulado de 6 meses de movimentações (USO diário)

Execute com:
    cd backend
    .venv\\Scripts\\python seed_demo_ia.py

ATENÇÃO: Este script é IDEMPOTENTE — verifica se o registro já existe
antes de inserir, então pode ser executado mais de uma vez sem duplicar.
"""

import os
import sys
import random
from datetime import date, datetime, timedelta

# Garante que o path do projeto esteja no PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app.db.database import SessionLocal, engine, Base
from app.models.models import (
    Doenca, Material, Categoria, Fornecedor, Lote,
    MovimentacaoEstoque, LocalArmazenamento, Usuario,
    materiais_doencas
)
from app.core.security import hash_senha

# Garante que as tabelas existem (seguro para SQLite dev)
Base.metadata.create_all(bind=engine)

db = SessionLocal()

# =====================================================================
# HELPERS
# =====================================================================

def get_or_create(model, defaults=None, **kwargs):
    """Retorna o objeto se existir, ou cria e retorna."""
    instance = db.query(model).filter_by(**kwargs).first()
    if instance:
        return instance, False
    params = {**kwargs, **(defaults or {})}
    instance = model(**params)
    db.add(instance)
    db.flush()
    return instance, True

# =====================================================================
# 1. USUÁRIO ADMIN (necessário para criar movimentações)
# =====================================================================
admin, criado = get_or_create(
    Usuario,
    defaults={"senha_hash": hash_senha("Admin@123"), "perfil": "ADMIN", "ativo": True},
    email="admin@stockia.lab",
    nome="Administrador StockIA",
)
if criado:
    print("✅ Usuário admin criado")
else:
    print("ℹ️  Usuário admin já existe")

# =====================================================================
# 2. LOCAL DE ARMAZENAMENTO
# =====================================================================
local_geo, _ = get_or_create(
    LocalArmazenamento,
    defaults={"tipo": "REFRIGERADO", "descricao": "Geladeira principal do setor de biologia molecular. Temperatura: 2°C a 8°C.", "ativo": True},
    nome="Geladeira Biologia Molecular",
)
local_amb, _ = get_or_create(
    LocalArmazenamento,
    defaults={"tipo": "AMBIENTE", "descricao": "Depósito seco de temperatura ambiente. 18°C a 25°C.", "ativo": True},
    nome="Depósito Principal",
)
local_freeze, _ = get_or_create(
    LocalArmazenamento,
    defaults={"tipo": "CONGELADO", "descricao": "Ultrafreezer -20°C para amostras e reagentes sensíveis.", "ativo": True},
    nome="Ultrafreezer -20°C",
)
print("✅ Locais de armazenamento prontos")

# =====================================================================
# 3. CATEGORIAS
# =====================================================================
cat_pcr, _ = get_or_create(Categoria, defaults={"descricao": "Reagentes para reações em cadeia da polimerase"}, nome="Reagentes PCR")
cat_soro, _ = get_or_create(Categoria, defaults={"descricao": "Testes sorológicos e kits rápidos diagnósticos"}, nome="Sorologia e Kits Rápidos")
cat_consum, _ = get_or_create(Categoria, defaults={"descricao": "Ponteiras, tubos, swabs e materiais descartáveis"}, nome="Consumíveis e Descartáveis")
cat_extr, _ = get_or_create(Categoria, defaults={"descricao": "Kits de extração de DNA/RNA viral e bacteriano"}, nome="Extração de Ácido Nucleico")
print("✅ Categorias prontas")

# =====================================================================
# 4. FORNECEDORES
# =====================================================================
bioclin, _ = get_or_create(Fornecedor, defaults={"contato": "(21) 3030-1100", "email": "vendas@bioclin.com.br", "ativo": True}, cnpj="33.000.167/0001-01", nome="Bioclin / Quibasa")
qiagen, _ = get_or_create(Fornecedor, defaults={"contato": "(11) 5503-6000", "email": "vendas@qiagen.com.br", "ativo": True}, cnpj="02.111.230/0001-33", nome="Qiagen do Brasil")
biorad, _ = get_or_create(Fornecedor, defaults={"contato": "(11) 5665-7000", "email": "pedidos@bio-rad.com.br", "ativo": True}, cnpj="45.983.281/0001-18", nome="Bio-Rad Laboratories")
laborclin, _ = get_or_create(Fornecedor, defaults={"contato": "(41) 3665-5000", "email": "comercial@laborclin.com.br", "ativo": True}, cnpj="75.059.919/0001-05", nome="Laborclin")
print("✅ Fornecedores prontos")

# =====================================================================
# 5. DOENÇAS SAZONAIS COM CID-10 E MESES DE PICO
# =====================================================================
doencas_data = [
    {
        "nome": "Dengue (Sorotipos 1, 2, 3 e 4)",
        "cid_codigo": "A90",
        "descricao": (
            "Doença febril aguda causada pelo vírus Dengue (DENV). Transmitida pelo mosquito Aedes aegypti. "
            "Meses de pico no Brasil: Janeiro, Fevereiro e Março (verão / período chuvoso). "
            "Alta incidência em regiões tropicais e subtropicais. "
            "Insumos principais: Kit NS1 Rápido, Sorologia IgG/IgM Dengue, RT-PCR Dengue. "
            "Quantidade média por exame: 1 cassete por paciente (sorologia); 1 reação de PCR."
        ),
    },
    {
        "nome": "Influenza A e B (Gripe Sazonal)",
        "cid_codigo": "J10",
        "descricao": (
            "Infecção respiratória aguda causada pelos vírus Influenza A e B. "
            "Meses de pico no Brasil: Abril, Maio, Junho e Julho (outono/inverno). "
            "Principal causa de pandemia respiratória anual. "
            "Insumos principais: Swab Nasofaríngeo, Tampão PCR 10X, Kit RT-PCR Influenza A/B. "
            "Quantidade média por exame: 1 swab + 1 reação de PCR por paciente."
        ),
    },
    {
        "nome": "Vírus Sincicial Respiratório (VSR)",
        "cid_codigo": "B97.4",
        "descricao": (
            "Principal causa de bronquiolite e pneumonia em lactentes. Altamente sazonal. "
            "Meses de pico no Brasil: Março, Abril e Maio. Risco elevado em crianças < 2 anos e imunodeprimidos. "
            "Insumos principais: Meio de Transporte Viral (VTM), Kit RT-PCR VSR, Ponteiras 200uL c/ filtro. "
            "Quantidade média por exame: 1 VTM + 2 reações por paciente (duplicata de segurança)."
        ),
    },
    {
        "nome": "Chikungunya",
        "cid_codigo": "A92.0",
        "descricao": (
            "Arbovirose transmitida pelo Aedes aegypti e Aedes albopictus. "
            "Meses de pico no Brasil: Janeiro a Abril (coincide com Dengue e Zika). "
            "Caracterizada por artralgia intensa e febre. Diagnóstico por RT-PCR ou Sorologia IgM. "
            "Insumos principais: Kit RT-PCR Chikungunya, Tubos Vacutainer EDTA. "
            "Quantidade média por exame: 1 reação de PCR."
        ),
    },
    {
        "nome": "Zika Vírus",
        "cid_codigo": "A92.5",
        "descricao": (
            "Arbovirose do gênero Flavivirus, transmitida pelo Aedes aegypti. "
            "Meses de pico: Janeiro a Abril (período chuvoso). Associado à microcefalia congênita. "
            "Insumos principais: Kit RT-PCR Zika, Ponteiras 10uL para carga viral. "
            "Quantidade média por exame: 1 reação de PCR; gestantes requerem confirmação em duplicata."
        ),
    },
]

doenca_objs = {}
for d_data in doencas_data:
    doenca, criado_d = get_or_create(Doenca, defaults={"descricao": d_data["descricao"], "ativo": True, "cid_codigo": d_data["cid_codigo"]}, nome=d_data["nome"])
    doenca_objs[d_data["cid_codigo"]] = doenca
    status = "✅ Criada" if criado_d else "ℹ️  Já existe"
    print(f"{status}: {d_data['nome']} ({d_data['cid_codigo']})")

db.commit()

# =====================================================================
# 6. MATERIAIS + VÍNCULO COM DOENÇAS
# =====================================================================
materiais_data = [
    # Reagentes PCR (Influenza e VSR)
    {
        "nome": "Tampão PCR 10X (PCR Buffer)",
        "categoria": cat_pcr, "fornecedor": bioclin,
        "codigo_catalogo": "BCL-PCR-10X-50mL",
        "fabricante": "Bioclin", "classe_risco": "Químico",
        "exige_refrigeracao": True, "temperatura_min": 2.0, "temperatura_max": 8.0,
        "unidade_medida": "ml", "estoque_minimo": 100, "estoque_maximo": 500,
        "local": local_geo,
        "doencas_cid": ["J10", "B97.4"],
        "lotes": [
            {"numero": "BCL-2026-001", "validade": date(2027, 6, 30), "saldo_inicial": 180},
        ],
        "consumo_diario_media": 4.5,  # ml/dia (base para o histórico simulado)
    },
    # Kit RT-PCR Influenza A/B
    {
        "nome": "Kit RT-PCR Influenza A/B (50 reações)",
        "categoria": cat_pcr, "fornecedor": biorad,
        "codigo_catalogo": "BIORAD-FLUAB-50RX",
        "fabricante": "Bio-Rad", "classe_risco": "Biológico",
        "exige_refrigeracao": True, "temperatura_min": 2.0, "temperatura_max": 8.0,
        "unidade_medida": "kit", "estoque_minimo": 5, "estoque_maximo": 30,
        "local": local_geo,
        "doencas_cid": ["J10"],
        "lotes": [
            {"numero": "BIORAD-2026-011", "validade": date(2027, 3, 15), "saldo_inicial": 8},
        ],
        "consumo_diario_media": 0.2,
    },
    # Kit Sorologia Dengue NS1 + IgG/IgM
    {
        "nome": "Kit NS1 + Sorologia Dengue IgG/IgM (25 cassetes)",
        "categoria": cat_soro, "fornecedor": bioclin,
        "codigo_catalogo": "BCL-DNG-NS1-25",
        "fabricante": "Bioclin", "classe_risco": "Biológico",
        "exige_refrigeracao": True, "temperatura_min": 2.0, "temperatura_max": 8.0,
        "unidade_medida": "cassete", "estoque_minimo": 30, "estoque_maximo": 200,
        "local": local_geo,
        "doencas_cid": ["A90"],
        "lotes": [
            {"numero": "BCL-2025-091", "validade": date(2026, 12, 31), "saldo_inicial": 75},
        ],
        "consumo_diario_media": 2.0,
    },
    # Meio de Transporte Viral (VTM) - VSR, Influenza, Zika
    {
        "nome": "Meio de Transporte Viral (VTM) — Swab incluso",
        "categoria": cat_extr, "fornecedor": laborclin,
        "codigo_catalogo": "LBC-VTM-SWAB-100",
        "fabricante": "Laborclin", "classe_risco": "Biológico",
        "exige_refrigeracao": True, "temperatura_min": 2.0, "temperatura_max": 8.0,
        "unidade_medida": "un", "estoque_minimo": 50, "estoque_maximo": 400,
        "local": local_geo,
        "doencas_cid": ["B97.4", "J10", "A92.5"],
        "lotes": [
            {"numero": "LBC-2026-044", "validade": date(2027, 9, 30), "saldo_inicial": 120},
        ],
        "consumo_diario_media": 3.5,
    },
    # Kit Extração RNA Viral (Qiagen)
    {
        "nome": "Kit Extração RNA Viral QIAamp (50 extrações)",
        "categoria": cat_extr, "fornecedor": qiagen,
        "codigo_catalogo": "QIAGEN-52906",
        "fabricante": "Qiagen", "classe_risco": "Químico",
        "exige_refrigeracao": True, "temperatura_min": 2.0, "temperatura_max": 8.0,
        "unidade_medida": "kit", "estoque_minimo": 3, "estoque_maximo": 15,
        "local": local_geo,
        "doencas_cid": ["A90", "J10", "B97.4", "A92.0", "A92.5"],
        "lotes": [
            {"numero": "QIA-2026-089", "validade": date(2027, 8, 15), "saldo_inicial": 6},
        ],
        "consumo_diario_media": 0.1,
    },
    # Ponteiras c/ Filtro 200uL
    {
        "nome": "Ponteiras com Filtro 200uL (caixa 96 un.)",
        "categoria": cat_consum, "fornecedor": laborclin,
        "codigo_catalogo": "LBC-PONT-200F-96",
        "fabricante": "Laborclin", "classe_risco": "Comum",
        "exige_refrigeracao": False,
        "unidade_medida": "caixa", "estoque_minimo": 5, "estoque_maximo": 50,
        "local": local_amb,
        "doencas_cid": ["A90", "J10", "B97.4", "A92.0", "A92.5"],
        "lotes": [
            {"numero": "LBC-2026-PT200-01", "validade": date(2028, 12, 31), "saldo_inicial": 9},
        ],
        "consumo_diario_media": 0.3,
    },
    # Swab Nasofaríngeo
    {
        "nome": "Swab Nasofaríngeo Flocado (embalagem 50 un.)",
        "categoria": cat_consum, "fornecedor": laborclin,
        "codigo_catalogo": "LBC-SWAB-NF-50",
        "fabricante": "Laborclin", "classe_risco": "Comum",
        "exige_refrigeracao": False,
        "unidade_medida": "un", "estoque_minimo": 60, "estoque_maximo": 500,
        "local": local_amb,
        "doencas_cid": ["J10", "B97.4"],
        "lotes": [
            {"numero": "LBC-2026-SWB-33", "validade": date(2028, 6, 30), "saldo_inicial": 150},
        ],
        "consumo_diario_media": 5.0,
    },
    # Kit RT-PCR Dengue
    {
        "nome": "Kit RT-PCR Dengue (25 reações — Multiplex)",
        "categoria": cat_pcr, "fornecedor": biorad,
        "codigo_catalogo": "BIORAD-DNG-MPX-25",
        "fabricante": "Bio-Rad", "classe_risco": "Biológico",
        "exige_refrigeracao": True, "temperatura_min": -20.0, "temperatura_max": -20.0,
        "unidade_medida": "kit", "estoque_minimo": 4, "estoque_maximo": 20,
        "local": local_freeze,
        "doencas_cid": ["A90"],
        "lotes": [
            {"numero": "BIORAD-2026-DNG-01", "validade": date(2027, 1, 31), "saldo_inicial": 5},
        ],
        "consumo_diario_media": 0.08,
    },
]

# Cria materiais, lotes e vínculos com doenças
created_materials = []
for mat_data in materiais_data:
    mat, criado_m = get_or_create(
        Material,
        defaults={
            "descricao": f"Insumo diagnóstico biomédico — {mat_data['categoria'].nome}",
            "categoria_id": mat_data["categoria"].id,
            "fornecedor_id": mat_data["fornecedor"].id,
            "fabricante": mat_data.get("fabricante"),
            "codigo_catalogo": mat_data.get("codigo_catalogo"),
            "classe_risco": mat_data.get("classe_risco", "Biológico"),
            "exige_refrigeracao": mat_data.get("exige_refrigeracao", False),
            "temperatura_min": mat_data.get("temperatura_min"),
            "temperatura_max": mat_data.get("temperatura_max"),
            "unidade_medida": mat_data.get("unidade_medida", "un"),
            "estoque_minimo": mat_data.get("estoque_minimo", 0),
            "estoque_maximo": mat_data.get("estoque_maximo"),
            "ativo": True,
        },
        nome=mat_data["nome"],
    )
    db.flush()

    # Vínculo Material <-> Doenças
    for cid in mat_data.get("doencas_cid", []):
        doenca_obj = doenca_objs.get(cid)
        if doenca_obj and doenca_obj not in mat.doencas:
            mat.doencas.append(doenca_obj)

    # Lotes
    lotes_obj = []
    for lote_data in mat_data.get("lotes", []):
        lote, criado_l = get_or_create(
            Lote,
            defaults={
                "local_id": mat_data["local"].id,
                "data_validade": lote_data["validade"],
                "data_fabricacao": date(lote_data["validade"].year - 2, 1, 1),
                "fornecedor_id": mat_data["fornecedor"].id,
                "quantidade_atual": lote_data["saldo_inicial"],
            },
            material_id=mat.id,
            numero_lote=lote_data["numero"],
        )
        db.flush()

        # Movimentação de ENTRADA inicial (se lote foi criado agora)
        if criado_l:
            entrada = MovimentacaoEstoque(
                lote_id=lote.id,
                usuario_id=admin.id,
                tipo="ENTRADA",
                quantidade=lote_data["saldo_inicial"],
                unidade_medida=mat.unidade_medida,
                motivo="Entrada inicial de estoque — seed de demonstração",
                criado_em=datetime.now() - timedelta(days=185),  # ~6 meses atrás
            )
            db.add(entrada)

        lotes_obj.append((lote, mat_data.get("consumo_diario_media", 1.0)))

    created_materials.append((mat, lotes_obj))
    status_m = "✅ Criado" if criado_m else "ℹ️  Já existe"
    print(f"  {status_m}: {mat_data['nome']}")

db.commit()

# =====================================================================
# 7. HISTÓRICO SIMULADO — 6 MESES DE MOVIMENTAÇÕES DE USO
# =====================================================================
print("\n📊 Gerando histórico simulado de 6 meses de movimentações USO...")

# Verifica se já existem muitas movimentações (evita duplicar)
total_movs = db.query(MovimentacaoEstoque).filter(MovimentacaoEstoque.tipo == "USO").count()
if total_movs > 50:
    print(f"ℹ️  Histórico já existente ({total_movs} USOs). Pulando geração.")
else:
    hoje = date.today()
    inicio = hoje - timedelta(days=180)
    random.seed(42)

    movimentacoes_bulk = []

    for mat, lotes_obj in created_materials:
        for lote, consumo_medio in lotes_obj:
            data_atual = inicio
            saldo_simulado = float(lote.quantidade_atual)

            while data_atual <= hoje:
                # Simula sazonalidade: meses de pico têm demanda maior
                mes = data_atual.month

                # Fator epidemiológico: verão (dengue) e outono (influenza/VSR)
                if mes in [1, 2, 3]:  # verão — pico dengue/zika/chikungunya
                    fator = 1.6
                elif mes in [4, 5, 6]:  # outono — pico influenza/VSR
                    fator = 1.8
                elif mes in [7, 8]:  # inverno — demanda ainda alta
                    fator = 1.3
                else:  # primavera — demanda basal
                    fator = 0.8

                # Quantidade consumida neste dia (com variação aleatória ±20%)
                qtd_dia = consumo_medio * fator * random.uniform(0.8, 1.2)
                qtd_dia = round(qtd_dia, 2)

                # Só gera movimentação em dias úteis com alguma atividade
                if qtd_dia > 0.01 and data_atual.weekday() < 5 and random.random() > 0.25:
                    if saldo_simulado >= qtd_dia:
                        mov = MovimentacaoEstoque(
                            lote_id=lote.id,
                            usuario_id=admin.id,
                            tipo="USO",
                            quantidade=qtd_dia,
                            unidade_medida=mat.unidade_medida,
                            motivo=f"Consumo rotina diagnóstica — {data_atual.strftime('%b/%Y')}",
                            criado_em=datetime.combine(data_atual, datetime.min.time()).replace(
                                hour=random.randint(7, 17), minute=random.randint(0, 59)
                            ),
                        )
                        movimentacoes_bulk.append(mov)
                        saldo_simulado -= qtd_dia

                data_atual += timedelta(days=1)

    db.bulk_save_objects(movimentacoes_bulk)
    db.commit()
    print(f"✅ {len(movimentacoes_bulk)} movimentações de USO inseridas com sazonalidade epidemiológica!")

# =====================================================================
# RELATÓRIO FINAL
# =====================================================================
total_doencas = db.query(Doenca).count()
total_materiais = db.query(Material).count()
total_lotes = db.query(Lote).count()
total_movs_final = db.query(MovimentacaoEstoque).count()

print(f"""
╔══════════════════════════════════════════════════════════════════╗
║              SEED DE DEMONSTRAÇÃO — CONCLUÍDO                    ║
╠══════════════════════════════════════════════════════════════════╣
║  Doenças sazonais cadastradas  : {total_doencas:<32} ║
║  Materiais laboratoriais       : {total_materiais:<32} ║
║  Lotes ativos                  : {total_lotes:<32} ║
║  Movimentações (histórico)     : {total_movs_final:<32} ║
╠══════════════════════════════════════════════════════════════════╣
║  CREDENCIAIS DO ADMIN DE DEMO                                    ║
║  Email   : admin@stockia.lab                                     ║
║  Senha   : Admin@123                                             ║
╚══════════════════════════════════════════════════════════════════╝
""")

db.close()
