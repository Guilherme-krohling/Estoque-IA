"""
Laurus AI — Configuração do Banco de Dados
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

# Se for SQLite relativo, resolve para o diretório Backend de forma absoluta
if "sqlite" in db_url and ("./" in db_url or not os.path.isabs(db_url.replace("sqlite:///", ""))):
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    db_file = os.path.join(backend_dir, "stockai.db").replace("\\", "/")
    db_url = f"sqlite:///{db_file}"

print(f"Conexao com o Banco de Dados configurada ({db_url.split('@')[-1] if '@' in db_url else db_url})")

# Cria o motor de conexão (suporta SQLite local e PostgreSQL)
connect_args = {"check_same_thread": False} if "sqlite" in db_url else {}

# Pool de conexões: limita conexões simultâneas e protege o banco de sobrecarga
_pool_kwargs = {}
if "sqlite" not in db_url:
    # PostgreSQL suporta pool completo; SQLite usa StaticPool internamente (1 conexão)
    _pool_kwargs = {
        "pool_size": 5,        # Máximo 5 conexões mantidas no pool
        "max_overflow": 10,    # Até 10 conexões extras em pico
        "pool_timeout": 30,    # Timeout (segundos) para obter conexão do pool
    }

engine = create_engine(
    db_url,
    connect_args=connect_args,
    pool_pre_ping=True,        # Verifica saúde da conexão antes de usar
    **_pool_kwargs,
)

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
