"""
Testes automatizados para os endpoints de Previsão Epidemiológica e Cruzamento de Estoque.
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
