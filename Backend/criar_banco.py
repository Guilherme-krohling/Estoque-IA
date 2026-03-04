from app.db.database import engine, Base
# Importando os models para o SQLAlchemy ler a estrutura deles
from app.models.models import Categoria, Material, Lote, MovimentacaoEstoque

print("⏳ Conectando ao PostgreSQL e gerando tabelas...")

try:
    # O comando mágico que cria tudo o que não existe ainda
    Base.metadata.create_all(bind=engine)
    print("✅ SUCESSO! Todas as tabelas foram criadas no banco 'stockai'.")
except Exception as e:
    print("❌ ERRO AO CRIAR TABELAS:")
    print(e)