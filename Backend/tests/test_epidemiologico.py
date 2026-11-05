"""
Testes automatizados para os endpoints de Previsão Epidemiológica, Previsões Salvas e Análise Algorítmica de Estoque.
"""

def test_endpoint_previsao_epidemiologica(client, auth):
    r = client.get("/api/ia/previsao-epidemiologica?doenca=Dengue&localidades=Santos&horizonte_semanas=8", headers=auth)
    assert r.status_code == 200, r.text
    dados = r.json()
    assert dados["doenca"] == "Dengue"
    assert "indicadores" in dados
    assert "serie_temporal" in dados
    assert "panorama_texto" in dados
    assert "distribuicao" in dados
    assert "impacto_demanda" in dados


def test_endpoint_cruzamento_estoque(client, auth):
    r = client.get("/api/ia/cruzamento?doenca=Influenza&localidades=Santos&horizonte_semanas=8", headers=auth)
    assert r.status_code == 200, r.text
    dados = r.json()
    assert dados["doenca"] == "Influenza"
    assert "casos_previstos" in dados
    assert "impacto_materiais" in dados
    assert isinstance(dados["impacto_materiais"], list)


def test_fluxo_previsao_salva_e_analise_algoritmica(client, auth):
    payload = {
        "titulo": "Dengue · Santos · 8 sem (Teste)",
        "doenca": "Dengue",
        "localidades": ["Santos"],
        "data_inicio": "2024-01",
        "data_fim": "2026-09",
        "horizonte_semanas": 8,
        "modo": "ampliado",
        "faixa_etaria": "todas",
        "sexo": "todos",
        "casos_recentes": 15,
        "casos_previstos": 140,
        "casos_dengue_previstos": 140,
        "casos_influenza_previstos": 0,
        "mudanca_esperada_pct": 12.5,
        "pico_data": "2026-10-15",
        "pico_casos": 25,
        "tendencia": "Crescente",
        "grau_confianca": 0.80,
        "dados_completos": {"indicadores": {"casos_previstos": 140}, "serie_temporal": []},
    }
    r_post = client.post("/api/ia/previsoes-salvas", json=payload, headers=auth)
    assert r_post.status_code == 200, r_post.text
    criada = r_post.json()
    assert criada["id"] > 0
    assert criada["titulo"] == "Dengue · Santos · 8 sem (Teste)"

    r_list = client.get("/api/ia/previsoes-salvas", headers=auth)
    assert r_list.status_code == 200
    assert any(p["id"] == criada["id"] for p in r_list.json())

    r_get = client.get(f"/api/ia/previsoes-salvas/{criada['id']}", headers=auth)
    assert r_get.status_code == 200
    assert r_get.json()["dados_completos"]["indicadores"]["casos_previstos"] == 140

    r_analise = client.get(f"/api/ia/analise-estoque?previsao_id={criada['id']}", headers=auth)
    assert r_analise.status_code == 200, r_analise.text
    analise = r_analise.json()
    assert analise["previsao_aplicada"]["id"] == criada["id"]
    assert "resumo" in analise
    assert isinstance(analise["materiais"], list)


def test_fluxo_pedidos_reposicao_nf_e_entregas_parciais(client, auth):
    # 1. Cria material para o pedido
    r_mat = client.post(
        "/api/materiais/",
        json={"nome": "Kit Teste Rápido Dengue NS1", "unidade_medida": "cx", "estoque_minimo": 20},
        headers=auth,
    )
    assert r_mat.status_code == 201, r_mat.text
    mat_id = r_mat.json()["id"]

    # 2. Cria pedido de reposição de 50 unidades
    r_ped = client.post(
        "/api/pedidos-reposicao/",
        json={
            "material_id": mat_id,
            "empresa_fornecedora": "BioTech Diagnósticos Ltda",
            "quantidade_solicitada": 50,
            "data_pedido": "2026-10-01",
            "previsao_entrega": "2026-10-15",
            "observacoes": "Pedido mensal de reposição",
        },
        headers=auth,
    )
    assert r_ped.status_code == 201, r_ped.text
    pedido = r_ped.json()
    assert pedido["status"] == "PENDENTE"
    assert pedido["quantidade_solicitada"] == 50.0
    assert pedido["quantidade_recebida"] == 0.0
    assert pedido["quantidade_pendente"] == 50.0

    # 3. Registra 1ª entrega PARCIAL (chegaram 30 de 50, faltam 20) com NF 00048291
    r_ent1 = client.post(
        f"/api/pedidos-reposicao/{pedido['id']}/entregas",
        json={
            "numero_nf": "00048291",
            "data_chegada": "2026-10-10",
            "quantidade_entregue": 30,
            "integrar_estoque": True,
            "numero_lote": "LOTE-NF-48291",
            "data_validade": "2028-12-31",
            "observacoes": "1ª remessa parcial",
        },
        headers=auth,
    )
    assert r_ent1.status_code == 201, r_ent1.text
    ped_parcial = r_ent1.json()
    assert ped_parcial["status"] == "PARCIAL"
    assert ped_parcial["quantidade_recebida"] == 30.0
    assert ped_parcial["quantidade_pendente"] == 20.0
    assert len(ped_parcial["entregas"]) == 1
    assert ped_parcial["entregas"][0]["numero_nf"] == "00048291"
    lote_criado_id = ped_parcial["entregas"][0]["lote_id"]
    assert lote_criado_id is not None

    # 4. Registra 2ª entrega concluindo os 20 restantes com NF 00000000
    r_ent2 = client.post(
        f"/api/pedidos-reposicao/{pedido['id']}/entregas",
        json={
            "numero_nf": "00000000",
            "data_chegada": "2026-10-14",
            "quantidade_entregue": 20,
            "integrar_estoque": True,
            "lote_id": lote_criado_id,
            "observacoes": "Entrega final concluindo o pedido",
        },
        headers=auth,
    )
    assert r_ent2.status_code == 201, r_ent2.text
    ped_concluido = r_ent2.json()
    assert ped_concluido["status"] == "CONCLUIDO"
    assert ped_concluido["quantidade_recebida"] == 50.0
    assert ped_concluido["quantidade_pendente"] == 0.0
    assert len(ped_concluido["entregas"]) == 2


def test_fluxo_rastreabilidade_paciente_convenio_exames(client, auth):
    # 1. Cria material e lote ativo com 20 unidades
    r_mat = client.post(
        "/api/materiais/",
        json={"nome": "Reagente Bioquímico Rastreável", "unidade_medida": "ml", "estoque_minimo": 5},
        headers=auth,
    )
    assert r_mat.status_code == 201
    mat_id = r_mat.json()["id"]

    r_lote = client.post(
        "/api/lotes/",
        json={
            "material_id": mat_id,
            "numero_lote": "LOTE-RAST-001",
            "quantidade_inicial": 20,
            "data_validade": "2028-12-31",
        },
        headers=auth,
    )
    assert r_lote.status_code == 201
    lote_id = r_lote.json()["id"]

    # 2. Registra uso no paciente Fernando (convênio Unimed, 8 exames)
    exames_fernando = [
        "EXAME 1 - Hemograma Completo",
        "EXAME 2 - Sorologia Dengue IgM/IgG",
        "EXAME 3 - Glicemia de Jejum",
        "EXAME 4 - Colesterol Total",
        "EXAME 5 - Triglicerídeos",
        "EXAME 6 - TGO (AST)",
        "EXAME 7 - TGP (ALT)",
        "EXAME 8 - Creatinina",
    ]
    r_atd = client.post(
        "/api/rastreabilidade/atendimentos",
        json={
            "paciente_nome": "Fernando",
            "convenio": "Unimed",
            "exames": exames_fernando,
            "itens_consumidos": [
                {"lote_id": lote_id, "quantidade": 2.5, "exame_especifico": "EXAME 2 - Sorologia Dengue IgM/IgG"}
            ],
        },
        headers=auth,
    )
    assert r_atd.status_code == 201, r_atd.text
    atd = r_atd.json()
    assert atd["paciente_nome"] == "Fernando"
    assert atd["convenio"] == "Unimed"
    assert atd["qtd_exames"] == 8
    assert len(atd["consumos"]) == 1

    # 3. Consulta listagem de rastreabilidade filtrando por paciente=Fernando
    r_list = client.get("/api/rastreabilidade/?paciente=Fernando", headers=auth)
    assert r_list.status_code == 200
    dados_rast = r_list.json()
    assert dados_rast["resumo"]["total_registros_uso"] >= 1
    item_fernando = dados_rast["itens"][0]
    assert item_fernando["paciente_nome"] == "Fernando"
    assert item_fernando["convenio"] == "Unimed"
    assert item_fernando["qtd_exames"] == 8
    assert item_fernando["quantidade_utilizada"] == 2.5

    # 4. Verifica se o saldo do lote baixou de 20 para 17.5
    r_lotes = client.get("/api/lotes/", headers=auth)
    lote_atualizado = next(l for l in r_lotes.json() if l["id"] == lote_id)
    assert float(lote_atualizado["quantidade_atual"]) == 17.5


def test_crud_convenios_e_pacientes_ordem_alfabetica(client, auth):
    # 1. Cria convênio
    r_conv = client.post(
        "/api/convenios/",
        json={"nome": "Unimed", "plano": "Nacional Flex", "carencia": "Sem carência"},
        headers=auth,
    )
    assert r_conv.status_code == 201, r_conv.text
    conv_id = r_conv.json()["id"]

    # 2. Cria dois pacientes fora de ordem (Zeca e Bruno) para testar ordenação alfabética A-Z
    r_pac_z = client.post(
        "/api/pacientes/",
        json={
            "nome_completo": "Zeca Pagodinho",
            "convenio_id": conv_id,
            "numero_carteirinha": "998877",
            "data_nascimento": "1970-05-10",
            "codigo_atendimento": "ATD-Z01",
            "endereco": "Rua A, 10",
            "cpf": "111.222.333-44",
            "rg": "12.345.678-9",
            "telefone": "(13) 99999-1111",
        },
        headers=auth,
    )
    assert r_pac_z.status_code == 201, r_pac_z.text

    r_pac_b = client.post(
        "/api/pacientes/",
        json={
            "nome_completo": "Bruno Silva",
            "convenio_id": conv_id,
            "numero_carteirinha": "112233",
            "data_nascimento": "1990-01-20",
            "codigo_atendimento": "ATD-B01",
            "cpf": "555.666.777-88",
            "rg": "98.765.432-1",
            "telefone": "(13) 98888-2222",
        },
        headers=auth,
    )
    assert r_pac_b.status_code == 201, r_pac_b.text

    # 3. Lista pacientes e verifica que Bruno vem antes de Zeca (ordem alfabética)
    r_list = client.get("/api/pacientes/", headers=auth)
    assert r_list.status_code == 200
    nomes = [p["nome_completo"] for p in r_list.json()]
    assert nomes.index("Bruno Silva") < nomes.index("Zeca Pagodinho")

    # 4. Testa filtro de busca (?busca=Bruno)
    r_busca = client.get("/api/pacientes/?busca=Bruno", headers=auth)
    assert r_busca.status_code == 200
    assert len(r_busca.json()) == 1
    assert r_busca.json()[0]["convenio"] == "Unimed (Nacional Flex)"

