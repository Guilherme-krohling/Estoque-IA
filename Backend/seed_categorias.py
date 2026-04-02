from app.db.database import engine, get_db
from app.models.models import Categoria
from sqlalchemy.orm import Session

# Iniciar sessao e injetar as 3 categorias base
db = Session(bind=engine)

categorias = [
    Categoria(nome="Reagentes Químicos", descricao="Substâncias e compostos usados em análises químicas."),
    Categoria(nome="Descartáveis", descricao="Luvas, seringas, tubos de ensaio descartáveis."),
    Categoria(nome="Meios de Cultura", descricao="Soluções e misturas para cultura microbiológica.")
]

try:
    for cat in categorias:
        # Check se ja existe, se nao add
        existente = db.query(Categoria).filter(Categoria.nome == cat.nome).first()
        if not existente:
            db.add(cat)
    db.commit()
    print("Categorias inseridas com sucesso!")
except Exception as e:
    print(f"Erro: {e}")
finally:
    db.close()
