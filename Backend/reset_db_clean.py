"""
StockIA — Recriar Banco SQLite do Zero com Schema Completo
===========================================================
"""

import os
from app.db.database import engine, Base
from app.models.models import (
    Usuario, Fornecedor, Categoria, LocalArmazenamento,
    Material, Lote, MovimentacaoEstoque, Doenca, materiais_doencas
)

db_path = "stockai.db"
if os.path.exists(db_path):
    os.remove(db_path)
    print("Database stockai.db antigo removido.")

Base.metadata.create_all(bind=engine)
print("Todas as tabelas recriadas do zero com schema completo da Fase 2!")
