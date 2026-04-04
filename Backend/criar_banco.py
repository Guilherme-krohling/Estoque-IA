"""
StockIA — Script para criar as tabelas no PostgreSQL (sem Alembic)
===================================================================
Use apenas como fallback. O Alembic é o método recomendado.
"""

from app.db.database import engine, Base
from app.models.models import (
    Usuario, Fornecedor, Categoria, Material,
    Lote, MovimentacaoEstoque, Doenca, materiais_doencas
)

print("⏳ Conectando ao PostgreSQL e gerando tabelas...")

try:
    Base.metadata.create_all(bind=engine)
    print("✅ SUCESSO! Todas as 7 tabelas + tabela associativa foram criadas no banco 'stockai'.")
except Exception as e:
    print("❌ ERRO AO CRIAR TABELAS:")
    print(e)