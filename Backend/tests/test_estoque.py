"""
Testes do núcleo de estoque: saldo, bloqueio de vencido, ajuste e estorno.
Cada teste usa um banco SQLite em memória isolado (ver conftest.py).
"""
from datetime import date, timedelta


def _criar_material(client, auth, **over):
    payload = {"nome": "Reagente PCR", "unidade_medida": "ml", "estoque_minimo": 10}
    payload.update(over)
    r = client.post("/api/materiais/", json=payload, headers=auth)
    assert r.status_code == 201, r.text
    return r.json()


def _criar_lote(client, auth, material_id, quantidade_inicial=0, validade=None):
    payload = {
        "material_id": material_id,
        "numero_lote": "L-001",
        "data_validade": (validade or (date.today() + timedelta(days=60))).isoformat(),
        "quantidade_inicial": quantidade_inicial,
    }
    r = client.post("/api/lotes/", json=payload, headers=auth)
    assert r.status_code == 201, r.text
    return r.json()


def test_saldo_de_abertura_gera_entrada(client, auth):
    mat = _criar_material(client, auth)
    lote = _criar_lote(client, auth, mat["id"], quantidade_inicial=100)
    assert float(lote["quantidade_atual"]) == 100

    # A abertura deve aparecer como uma movimentação ENTRADA na auditoria.
    movs = client.get("/api/movimentacoes/", headers=auth).json()
    assert any(m["tipo"] == "ENTRADA" and float(m["quantidade"]) == 100 for m in movs)


def test_fluxo_entrada_uso_descarte(client, auth):
    mat = _criar_material(client, auth)
    lote = _criar_lote(client, auth, mat["id"], quantidade_inicial=50)

    client.post("/api/movimentacoes/", json={"lote_id": lote["id"], "tipo": "ENTRADA", "quantidade": 30}, headers=auth)
    client.post("/api/movimentacoes/", json={"lote_id": lote["id"], "tipo": "USO", "quantidade": 20}, headers=auth)
    client.post("/api/movimentacoes/", json={"lote_id": lote["id"], "tipo": "DESCARTE", "quantidade": 10}, headers=auth)

    saldo = float(client.get(f"/api/lotes/{lote['id']}", headers=auth).json()["quantidade_atual"])
    assert saldo == 50 + 30 - 20 - 10  # 50


def test_uso_acima_do_saldo_bloqueado(client, auth):
    mat = _criar_material(client, auth)
    lote = _criar_lote(client, auth, mat["id"], quantidade_inicial=5)
    r = client.post("/api/movimentacoes/", json={"lote_id": lote["id"], "tipo": "USO", "quantidade": 10}, headers=auth)
    assert r.status_code == 400
    assert "insuficiente" in r.json()["detail"].lower()


def test_uso_em_lote_vencido_bloqueado(client, auth):
    mat = _criar_material(client, auth)
    lote = _criar_lote(client, auth, mat["id"], quantidade_inicial=20, validade=date.today() - timedelta(days=1))
    r = client.post("/api/movimentacoes/", json={"lote_id": lote["id"], "tipo": "USO", "quantidade": 5}, headers=auth)
    assert r.status_code == 400
    # Mas DESCARTE em vencido deve ser permitido
    r2 = client.post("/api/movimentacoes/", json={"lote_id": lote["id"], "tipo": "DESCARTE", "quantidade": 5}, headers=auth)
    assert r2.status_code == 201


def test_quantidade_invalida_rejeitada(client, auth):
    mat = _criar_material(client, auth)
    lote = _criar_lote(client, auth, mat["id"], quantidade_inicial=10)
    r = client.post("/api/movimentacoes/", json={"lote_id": lote["id"], "tipo": "USO", "quantidade": 0}, headers=auth)
    assert r.status_code == 400
    r2 = client.post("/api/movimentacoes/", json={"lote_id": lote["id"], "tipo": "ENTRADA", "quantidade": -5}, headers=auth)
    assert r2.status_code in (400, 422)


def test_ajuste_define_saldo(client, auth):
    mat = _criar_material(client, auth)
    lote = _criar_lote(client, auth, mat["id"], quantidade_inicial=80)
    client.post("/api/movimentacoes/", json={"lote_id": lote["id"], "tipo": "AJUSTE", "quantidade": 12}, headers=auth)
    saldo = float(client.get(f"/api/lotes/{lote['id']}", headers=auth).json()["quantidade_atual"])
    assert saldo == 12


def test_estorno_reverte_saldo_e_preserva_original(client, auth):
    mat = _criar_material(client, auth)
    lote = _criar_lote(client, auth, mat["id"], quantidade_inicial=40)
    mov = client.post("/api/movimentacoes/", json={"lote_id": lote["id"], "tipo": "USO", "quantidade": 15}, headers=auth).json()

    saldo_apos_uso = float(client.get(f"/api/lotes/{lote['id']}", headers=auth).json()["quantidade_atual"])
    assert saldo_apos_uso == 25

    r = client.post(f"/api/movimentacoes/{mov['id']}/estornar", headers=auth)
    assert r.status_code == 201, r.text

    saldo_apos_estorno = float(client.get(f"/api/lotes/{lote['id']}", headers=auth).json()["quantidade_atual"])
    assert saldo_apos_estorno == 40  # USO revertido devolve ao estoque

    # O lançamento original continua na trilha (nunca é apagado).
    movs = client.get("/api/movimentacoes/", headers=auth).json()
    assert any(m["id"] == mov["id"] for m in movs)
    # Estorno duplicado deve ser bloqueado.
    r2 = client.post(f"/api/movimentacoes/{mov['id']}/estornar", headers=auth)
    assert r2.status_code == 400


def test_registro_publico_bloqueado(client):
    # Sem token de admin, /registrar deve ser negado (401/403).
    r = client.post("/api/auth/registrar", json={"nome": "X", "email": "x@y.com", "senha": "12345678"})
    assert r.status_code in (401, 403)
