"""
StockIA — Modelos ORM (SQLAlchemy)
====================================
7 tabelas principais + 1 tabela associativa (Many-to-Many):
  1. Usuario
  2. Fornecedor
  3. Categoria
  4. Material
  5. Lote
  6. MovimentacaoEstoque
  7. Doenca
  +  materiais_doencas (associativa)
"""

from sqlalchemy import (
    Column, ForeignKey, Integer, String, Float, Boolean,
    Date, DateTime, Numeric, Table, Text
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base


# =====================================================================
# TABELA ASSOCIATIVA — Many-to-Many (Material <-> Doenca)
# =====================================================================
materiais_doencas = Table(
    "materiais_doencas",
    Base.metadata,
    Column("material_id", Integer, ForeignKey("materiais.id", ondelete="CASCADE"), primary_key=True),
    Column("doenca_id", Integer, ForeignKey("doencas.id", ondelete="CASCADE"), primary_key=True),
)


# =====================================================================
# 1. USUARIOS
# =====================================================================
class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    senha_hash = Column(String(255), nullable=False)  # Hash bcrypt
    perfil = Column(String(50), nullable=False, default="PESQUISADOR")  # ADMIN | PESQUISADOR | GESTOR
    ativo = Column(Boolean, default=True)
    criado_em = Column(DateTime, default=func.now())

    # Relacionamentos
    movimentacoes = relationship("MovimentacaoEstoque", back_populates="usuario")


# =====================================================================
# 2. FORNECEDORES
# =====================================================================
class Fornecedor(Base):
    __tablename__ = "fornecedores"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(150), nullable=False)
    cnpj = Column(String(18), unique=True, nullable=True)  # Formato: 00.000.000/0000-00
    contato = Column(String(100), nullable=True)
    email = Column(String(150), nullable=True)
    ativo = Column(Boolean, default=True)

    # Relacionamentos
    materiais = relationship("Material", back_populates="fornecedor")
    lotes = relationship("Lote", back_populates="fornecedor")


# =====================================================================
# 3. CATEGORIAS
# =====================================================================
class Categoria(Base):
    __tablename__ = "categorias"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False, unique=True)
    descricao = Column(Text, nullable=True)

    # Relacionamentos
    materiais = relationship("Material", back_populates="categoria")


# =====================================================================
# 3b. LOCAIS DE ARMAZENAMENTO (depósitos, geladeiras, freezers)
# =====================================================================
class LocalArmazenamento(Base):
    __tablename__ = "locais_armazenamento"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False)  # 'Geladeira 2 - Sala B'
    tipo = Column(String(50), nullable=False)  # REFRIGERADO | CONGELADO | AMBIENTE | INFLAMAVEIS
    temperatura_atual = Column(Numeric(5, 2), nullable=True)  # leitura de sensor (futuro)
    descricao = Column(Text, nullable=True)
    ativo = Column(Boolean, default=True)
    criado_em = Column(DateTime, default=func.now())

    # Relacionamentos
    lotes = relationship("Lote", back_populates="local")


# =====================================================================
# 4. MATERIAIS (O Catálogo)
# =====================================================================
class Material(Base):
    __tablename__ = "materiais"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(150), nullable=False)
    descricao = Column(Text, nullable=True)
    categoria_id = Column(Integer, ForeignKey("categorias.id"), nullable=True)
    fabricante = Column(String(100), nullable=True)
    fornecedor_id = Column(Integer, ForeignKey("fornecedores.id"), nullable=True)
    codigo_catalogo = Column(String(50), nullable=True)
    classe_risco = Column(String(50), nullable=True)  # Ex: 'Biológico', 'Inflamável'
    exige_refrigeracao = Column(Boolean, default=False)
    temperatura_min = Column(Numeric(5, 2), nullable=True)  # Ex: 2.50
    temperatura_max = Column(Numeric(5, 2), nullable=True)  # Ex: 8.00
    unidade_medida = Column(String(20), nullable=False, default="un")  # unidade canônica: ml, un, g
    fator_conversao = Column(Numeric(10, 4), default=1.0)  # ex: 1 caixa = 50 un → 50
    estoque_minimo = Column(Numeric(10, 2), default=0)  # gatilho de alerta de ressuprimento
    estoque_maximo = Column(Numeric(10, 2), nullable=True)  # teto opcional
    ativo = Column(Boolean, default=True)
    criado_em = Column(DateTime, default=func.now())

    # Relacionamentos
    categoria = relationship("Categoria", back_populates="materiais")
    fornecedor = relationship("Fornecedor", back_populates="materiais")
    lotes = relationship("Lote", back_populates="material", cascade="all, delete-orphan")
    doencas = relationship("Doenca", secondary=materiais_doencas, back_populates="materiais")


# =====================================================================
# 5. LOTES (Estoque Físico e Validade — FEFO)
# =====================================================================
class Lote(Base):
    __tablename__ = "lotes"

    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("materiais.id"), nullable=False)
    local_id = Column(Integer, ForeignKey("locais_armazenamento.id"), nullable=True)
    numero_lote = Column(String(50), nullable=False)
    data_fabricacao = Column(Date, nullable=True)
    data_validade = Column(Date, nullable=False)
    certificado_analise = Column(String(255), nullable=True)  # Link S3 ou Hash (Fase 3)
    fornecedor_id = Column(Integer, ForeignKey("fornecedores.id"), nullable=True)
    quantidade_atual = Column(Numeric(10, 2), default=0)
    criado_em = Column(DateTime, default=func.now())

    # Relacionamentos
    material = relationship("Material", back_populates="lotes")
    local = relationship("LocalArmazenamento", back_populates="lotes")
    fornecedor = relationship("Fornecedor", back_populates="lotes")
    movimentacoes = relationship("MovimentacaoEstoque", back_populates="lote", cascade="all, delete-orphan")


# =====================================================================
# 6. MOVIMENTACOES_ESTOQUE (Fonte da Verdade para a IA / Auditoria)
# =====================================================================
class MovimentacaoEstoque(Base):
    __tablename__ = "movimentacoes_estoque"

    id = Column(Integer, primary_key=True, index=True)
    lote_id = Column(Integer, ForeignKey("lotes.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    tipo = Column(String(20), nullable=False)  # ENTRADA | USO | DESCARTE | AJUSTE | TRANSFERENCIA
    quantidade = Column(Numeric(10, 2), nullable=False)
    unidade_medida = Column(String(20), nullable=True)  # un, ml, caixa
    local_origem_id = Column(Integer, ForeignKey("locais_armazenamento.id"), nullable=True)
    local_destino_id = Column(Integer, ForeignKey("locais_armazenamento.id"), nullable=True)
    estorno_de_id = Column(Integer, ForeignKey("movimentacoes_estoque.id"), nullable=True)
    motivo = Column(String(255), nullable=True)
    referencia = Column(String(100), nullable=True)  # NF ou Pedido
    criado_em = Column(DateTime, default=func.now())

    # Relacionamentos
    lote = relationship("Lote", back_populates="movimentacoes")
    usuario = relationship("Usuario", back_populates="movimentacoes")
    local_origem = relationship("LocalArmazenamento", foreign_keys=[local_origem_id])
    local_destino = relationship("LocalArmazenamento", foreign_keys=[local_destino_id])
    estorno_de = relationship("MovimentacaoEstoque", remote_side=[id])


# =====================================================================
# 7. DOENCAS
# =====================================================================
class Doenca(Base):
    __tablename__ = "doencas"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(150), nullable=False, unique=True)
    descricao = Column(Text, nullable=True)
    cid_codigo = Column(String(10), nullable=True)  # Código CID-10 (ex: A90 = Dengue)
    ativo = Column(Boolean, default=True)
    criado_em = Column(DateTime, default=func.now())

    # Relacionamento Many-to-Many com Materiais
    materiais = relationship("Material", secondary=materiais_doencas, back_populates="doencas")