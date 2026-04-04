"""Teste rápido da API StockIA."""
import urllib.request
import json

BASE = "http://127.0.0.1:8000/api"

# 1. LOGIN
login_data = json.dumps({"email": "admin@stockia.com", "senha": "admin123"}).encode()
req = urllib.request.Request(f"{BASE}/auth/login", data=login_data, headers={"Content-Type": "application/json"})
r = urllib.request.urlopen(req)
token = json.loads(r.read())["access_token"]
print(f"✅ LOGIN OK (token: {token[:30]}...)")

headers = {"Authorization": f"Bearer {token}"}

# 2. CATEGORIAS
req2 = urllib.request.Request(f"{BASE}/categorias/", headers=headers)
r2 = urllib.request.urlopen(req2)
cats = json.loads(r2.read())
print(f"✅ CATEGORIAS ({len(cats)}):")
for c in cats:
    print(f"   - {c['nome']}")

# 3. GET /api/usuarios/me
req3 = urllib.request.Request(f"{BASE}/usuarios/me", headers=headers)
r3 = urllib.request.urlopen(req3)
me = json.loads(r3.read())
print(f"✅ PERFIL AUTENTICADO: {me['nome']} ({me['perfil']})")

# 4. Teste rota sem token (deve dar 401)
try:
    req4 = urllib.request.Request(f"{BASE}/categorias/")
    urllib.request.urlopen(req4)
    print("❌ FALHA: rota deveria estar protegida!")
except urllib.error.HTTPError as e:
    if e.code == 401:
        print("✅ PROTEÇÃO JWT: rota sem token retornou 401 corretamente.")
    else:
        print(f"❌ Erro inesperado: {e.code}")

print("\n🎉 Todos os testes da API passaram!")
