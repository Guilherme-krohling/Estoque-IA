"""fase2: locais, estoque_minimo/unidade no material, transferencia e estorno

Revision ID: b2f1a9c4d7e3
Revises: 257f2087c97b
Create Date: 2026-05-28

Onda 2 do controle de estoque:
  - materiais: unidade_medida, fator_conversao, estoque_minimo, estoque_maximo
  - nova tabela locais_armazenamento (+ seed "Depósito Principal")
  - lotes.local_id (backfill para o Depósito Principal)
  - movimentacoes: local_origem_id, local_destino_id, estorno_de_id
  - índices FEFO e de tipo/data
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2f1a9c4d7e3"
down_revision: Union[str, Sequence[str], None] = "257f2087c97b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- materiais: unidade canônica + limites de estoque ---
    op.add_column("materiais", sa.Column("unidade_medida", sa.String(length=20), nullable=False, server_default="un"))
    op.add_column("materiais", sa.Column("fator_conversao", sa.Numeric(precision=10, scale=4), nullable=True, server_default="1.0"))
    op.add_column("materiais", sa.Column("estoque_minimo", sa.Numeric(precision=10, scale=2), nullable=True, server_default="0"))
    op.add_column("materiais", sa.Column("estoque_maximo", sa.Numeric(precision=10, scale=2), nullable=True))

    # --- nova tabela locais_armazenamento ---
    op.create_table(
        "locais_armazenamento",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nome", sa.String(length=100), nullable=False),
        sa.Column("tipo", sa.String(length=50), nullable=False),
        sa.Column("temperatura_atual", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=True),
        sa.Column("criado_em", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_locais_armazenamento_id"), "locais_armazenamento", ["id"], unique=False)

    # --- lotes.local_id ---
    op.add_column("lotes", sa.Column("local_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_lotes_local", "lotes", "locais_armazenamento", ["local_id"], ["id"])

    # --- movimentacoes: transferência + estorno ---
    op.add_column("movimentacoes_estoque", sa.Column("local_origem_id", sa.Integer(), nullable=True))
    op.add_column("movimentacoes_estoque", sa.Column("local_destino_id", sa.Integer(), nullable=True))
    op.add_column("movimentacoes_estoque", sa.Column("estorno_de_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_mov_local_origem", "movimentacoes_estoque", "locais_armazenamento", ["local_origem_id"], ["id"])
    op.create_foreign_key("fk_mov_local_destino", "movimentacoes_estoque", "locais_armazenamento", ["local_destino_id"], ["id"])
    op.create_foreign_key("fk_mov_estorno", "movimentacoes_estoque", "movimentacoes_estoque", ["estorno_de_id"], ["id"])

    # --- índices ---
    op.create_index("idx_lotes_material_validade", "lotes", ["material_id", "data_validade"], unique=False)
    op.create_index("idx_movimentacoes_tipo_data", "movimentacoes_estoque", ["tipo", "criado_em"], unique=False)

    # --- seed do local padrão + backfill dos lotes existentes ---
    op.execute(
        "INSERT INTO locais_armazenamento (nome, tipo, descricao, ativo, criado_em) "
        "VALUES ('Depósito Principal', 'AMBIENTE', 'Local padrão criado na migração da Fase 2', TRUE, CURRENT_TIMESTAMP)"
    )
    op.execute(
        "UPDATE lotes SET local_id = (SELECT id FROM locais_armazenamento ORDER BY id LIMIT 1) WHERE local_id IS NULL"
    )


def downgrade() -> None:
    op.drop_index("idx_movimentacoes_tipo_data", table_name="movimentacoes_estoque")
    op.drop_index("idx_lotes_material_validade", table_name="lotes")

    op.drop_constraint("fk_mov_estorno", "movimentacoes_estoque", type_="foreignkey")
    op.drop_constraint("fk_mov_local_destino", "movimentacoes_estoque", type_="foreignkey")
    op.drop_constraint("fk_mov_local_origem", "movimentacoes_estoque", type_="foreignkey")
    op.drop_column("movimentacoes_estoque", "estorno_de_id")
    op.drop_column("movimentacoes_estoque", "local_destino_id")
    op.drop_column("movimentacoes_estoque", "local_origem_id")

    op.drop_constraint("fk_lotes_local", "lotes", type_="foreignkey")
    op.drop_column("lotes", "local_id")

    op.drop_index(op.f("ix_locais_armazenamento_id"), table_name="locais_armazenamento")
    op.drop_table("locais_armazenamento")

    op.drop_column("materiais", "estoque_maximo")
    op.drop_column("materiais", "estoque_minimo")
    op.drop_column("materiais", "fator_conversao")
    op.drop_column("materiais", "unidade_medida")
