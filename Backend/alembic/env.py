"""
Alembic env.py — Configuração de Migrações
=============================================
Lê a URL do banco do .env e importa os models para autodetecção de alterações.
"""

import os
import sys
from logging.config import fileConfig

from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool
from alembic import context

# Adiciona o diretório raiz do projeto ao sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Carrega variáveis do .env
load_dotenv()

# Configuração do Alembic
config = context.config

# Interpreta o arquivo de configuração para logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# =====================================================================
# IMPORTA OS MODELS — Necessário para o autogenerate funcionar
# =====================================================================
from app.db.database import Base
from app.models.models import (
    Usuario, Fornecedor, Categoria, Material,
    Lote, MovimentacaoEstoque, Doenca, materiais_doencas
)

target_metadata = Base.metadata

# =====================================================================
# CONFIGURA A URL DO BANCO DINAMICAMENTE (do .env)
# =====================================================================
database_url = os.getenv("DATABASE_URL")
if database_url:
    config.set_main_option("sqlalchemy.url", database_url)


def run_migrations_offline() -> None:
    """Modo offline: gera SQL sem se conectar ao banco."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Modo online: se conecta ao banco e aplica migrações."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
