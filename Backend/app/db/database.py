"""
StockIA — Configuração do Banco de Dados
==========================================
Conecta ao PostgreSQL via SQLAlchemy.
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

db_url = os.getenv("DATABASE_URL")

if not db_url:
    raise ValueError("ERRO CRÍTICO: Variável DATABASE_URL não encontrada no arquivo .env!")
else:
    print(f"✅ Conexão com o Banco de Dados configurada ({db_url.split('@')[-1] if '@' in db_url else 'local'})")

# Cria o motor de conexão (pool de conexões com o PostgreSQL)
engine = create_engine(db_url)

# Fábrica de sessões para transações no banco
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base ORM — todos os modelos herdam desta classe
Base = declarative_base()


def get_db():
    """Dependency do FastAPI que gerencia o ciclo de vida da sessão do banco."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
