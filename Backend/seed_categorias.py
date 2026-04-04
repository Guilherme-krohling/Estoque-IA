"""
StockIA — Seed de dados iniciais
===================================
Cria um usuário ADMIN padrão e categorias base para iniciar o sistema.
"""

from app.db.database import engine
from app.models.models import Categoria, Usuario
from app.core.security import hash_senha
from sqlalchemy.orm import Session

db = Session(bind=engine)

# =====================================================================
# 1. USUÁRIO ADMIN PADRÃO
# =====================================================================
admin_email = "admin@stockia.com"
admin_existente = db.query(Usuario).filter(Usuario.email == admin_email).first()

if not admin_existente:
    admin = Usuario(
        nome="Administrador",
        email=admin_email,
        senha_hash=hash_senha("admin123"),
        perfil="ADMIN",
    )
    db.add(admin)
    print("✅ Usuário ADMIN criado: admin@stockia.com / admin123")
else:
    print("ℹ️  Usuário ADMIN já existe, pulando...")

# =====================================================================
# 2. CATEGORIAS PADRÃO DE LABORATÓRIO
# =====================================================================
categorias = [
    Categoria(nome="Reagentes Químicos", descricao="Substâncias e compostos usados em análises químicas."),
    Categoria(nome="Descartáveis", descricao="Luvas, seringas, tubos de ensaio descartáveis."),
    Categoria(nome="Meios de Cultura", descricao="Soluções e misturas para cultura microbiológica."),
    Categoria(nome="Equipamentos de Proteção", descricao="EPIs para segurança laboratorial."),
    Categoria(nome="Vidraria", descricao="Béqueres, balões, pipetas e provetas."),
]

try:
    for cat in categorias:
        existente = db.query(Categoria).filter(Categoria.nome == cat.nome).first()
        if not existente:
            db.add(cat)
    db.commit()
    print("✅ Categorias de laboratório inseridas com sucesso!")
except Exception as e:
    db.rollback()
    print(f"❌ Erro ao inserir seed: {e}")
finally:
    db.close()
