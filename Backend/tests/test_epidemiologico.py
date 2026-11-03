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
