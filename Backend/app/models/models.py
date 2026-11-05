"""
Laurus AI — Modelos ORM (SQLAlchemy)
====================================
9 tabelas principais + 1 tabela associativa (Many-to-Many):
  1. Usuario
  2. Fornecedor
  3. Categoria
  3b. LocalArmazenamento
  4. Material
  5. Lote
  6. MovimentacaoEstoque
  7. Doenca
  8. DadoEpidemiologico
  9. PrevisaoSalva
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
    Column("quantidade_por_exame", Float, default=1.0, nullable=False),
    Column("unidade_por_exame", String(20), default="un", nullable=True),
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


# =====================================================================
# 8. DADOS EPIDEMIOLOGICOS (Séries Temporais SINAN / DATASUS)
# =====================================================================
class DadoEpidemiologico(Base):
    __tablename__ = "dados_epidemiologicos"

    id = Column(Integer, primary_key=True, index=True)
    doenca_id = Column(Integer, ForeignKey("doencas.id"), nullable=True, index=True)
    doenca_nome = Column(String(50), nullable=False, index=True)  # "Dengue" | "Influenza"
    localidade = Column(String(100), nullable=False, index=True)  # "Santos", "Baixada Santista", "Estado de São Paulo", etc.
    ano = Column(Integer, nullable=False, index=True)
    semana_epidemiologica = Column(Integer, nullable=False, index=True)
    semana_ano = Column(String(10), nullable=False, index=True)   # ex: "202410"
    data_inicio_semana = Column(Date, nullable=False, index=True) # Data do primeiro dia da semana
    casos_notificados = Column(Integer, default=0, nullable=False)
    casos_confirmados = Column(Integer, default=0, nullable=False)
    casos_fem = Column(Integer, default=0, nullable=False)
    casos_masc = Column(Integer, default=0, nullable=False)
    casos_0_19 = Column(Integer, default=0, nullable=False)
    casos_20_59 = Column(Integer, default=0, nullable=False)
    casos_60_mais = Column(Integer, default=0, nullable=False)
    fonte = Column(String(50), default="SINAN", nullable=False)
    criado_em = Column(DateTime, default=func.now())

    # Relacionamento
    doenca = relationship("Doenca")


# =====================================================================
# 9. PREVISOES SALVAS (Snapshot Completo do Gráfico + Filtros Epidemiológicos)
# =====================================================================
class PrevisaoSalva(Base):
    __tablename__ = "previsoes_salvas"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(200), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)

    # Filtros aplicados no momento do salvamento
    doenca = Column(String(50), nullable=False, index=True)          # "Dengue" | "Influenza" | "Ambas"
    localidades = Column(String(500), nullable=False)               # ex: "Santos, São Vicente"
    data_inicio = Column(String(20), nullable=True)                 # ex: "2024-01"
    data_fim = Column(String(20), nullable=True)                    # ex: "2026-09"
    horizonte_semanas = Column(Integer, nullable=False, default=8)
    periodo_historico_meses = Column(Integer, nullable=False, default=24)
    modo = Column(String(30), nullable=False, default="ampliado")
    faixa_etaria = Column(String(30), nullable=False, default="todas")
    sexo = Column(String(20), nullable=False, default="todos")
    fonte = Column(String(50), nullable=False, default="SINAN")
    grau_confianca = Column(Float, nullable=False, default=80.0)    # Intervalo de confiança Prophet (80%)

    # Indicadores consolidados para consulta rápida na tela de Alertas
    casos_recentes_str = Column(String(50), nullable=True)
    casos_previstos_total = Column(Integer, nullable=False, default=0)
    casos_dengue_previstos = Column(Integer, nullable=False, default=0)
    casos_influenza_previstos = Column(Integer, nullable=False, default=0)
    mudanca_esperada_pct = Column(Float, nullable=False, default=0.0)
    pico_semana = Column(String(20), nullable=True)
    pico_data = Column(String(20), nullable=True)
    pico_casos = Column(Integer, nullable=False, default=0)
    tendencia = Column(String(50), nullable=True)

    # Payload completo do gráfico e séries (JSON serializado)
    dados_completos_json = Column(Text, nullable=False)
    criado_em = Column(DateTime, default=func.now())


# =====================================================================
# 10. PEDIDOS DE REPOSICAO (Fase 4.1 — Suprimentos e Entregas Parciais)
# =====================================================================
class PedidoReposicao(Base):
    __tablename__ = "pedidos_reposicao"

    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("materiais.id"), nullable=False, index=True)
    fornecedor_id = Column(Integer, ForeignKey("fornecedores.id"), nullable=True, index=True)
    empresa_fornecedora = Column(String(150), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    data_pedido = Column(Date, nullable=False)
    quantidade_solicitada = Column(Numeric(10, 2), nullable=False)
    quantidade_recebida = Column(Numeric(10, 2), nullable=False, default=0)
    status = Column(String(30), nullable=False, default="PENDENTE")  # PENDENTE | PARCIAL | CONCLUIDO | CANCELADO
    observacoes = Column(Text, nullable=True)
    criado_em = Column(DateTime, default=func.now())

    # Relacionamentos
    material = relationship("Material")
    fornecedor = relationship("Fornecedor")
    usuario = relationship("Usuario")
    entregas = relationship(
        "EntregaPedido",
        back_populates="pedido",
        cascade="all, delete-orphan",
        order_by="EntregaPedido.data_recebimento.asc()",
    )


# =====================================================================
# 11. ENTREGAS DE PEDIDOS / NOTAS FISCAIS (Fase 4.1)
# =====================================================================
class EntregaPedido(Base):
    __tablename__ = "entregas_pedidos"

    id = Column(Integer, primary_key=True, index=True)
    pedido_id = Column(Integer, ForeignKey("pedidos_reposicao.id", ondelete="CASCADE"), nullable=False, index=True)
    lote_id = Column(Integer, ForeignKey("lotes.id"), nullable=True)
    movimentacao_id = Column(Integer, ForeignKey("movimentacoes_estoque.id"), nullable=True)
    numero_nf = Column(String(60), nullable=False)
    data_recebimento = Column(Date, nullable=False)
    quantidade_entregue = Column(Numeric(10, 2), nullable=False)
    numero_lote_recebido = Column(String(50), nullable=True)
    data_validade_lote = Column(Date, nullable=True)
    observacoes = Column(String(255), nullable=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    criado_em = Column(DateTime, default=func.now())

    # Relacionamentos
    pedido = relationship("PedidoReposicao", back_populates="entregas")
    lote = relationship("Lote")
    movimentacao = relationship("MovimentacaoEstoque")
    usuario = relationship("Usuario")


# =====================================================================
# 12. ATENDIMENTOS DE PACIENTES (Fase 4.2 — Rastreabilidade Clínica)
# =====================================================================
class AtendimentoPaciente(Base):
    __tablename__ = "atendimentos_pacientes"

    id = Column(Integer, primary_key=True, index=True)
    codigo_atendimento = Column(String(50), nullable=False, index=True)
    paciente_nome = Column(String(150), nullable=False, index=True)
    paciente_documento = Column(String(50), nullable=True)
    convenio = Column(String(100), nullable=False, index=True)
    exames_json = Column(Text, nullable=False, default="[]")  # JSON list de exames realizados
    data_atendimento = Column(DateTime, default=func.now(), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    observacoes = Column(Text, nullable=True)
    criado_em = Column(DateTime, default=func.now())

    # Relacionamentos
    usuario = relationship("Usuario")
    consumos = relationship(
        "ConsumoMaterialPaciente",
        back_populates="atendimento",
        cascade="all, delete-orphan",
    )


# =====================================================================
# 13. CONSUMO DE MATERIAL POR PACIENTE (Fase 4.2)
# =====================================================================
class ConsumoMaterialPaciente(Base):
    __tablename__ = "consumos_materiais_pacientes"

    id = Column(Integer, primary_key=True, index=True)
    atendimento_id = Column(Integer, ForeignKey("atendimentos_pacientes.id", ondelete="CASCADE"), nullable=False, index=True)
    material_id = Column(Integer, ForeignKey("materiais.id"), nullable=False, index=True)
    lote_id = Column(Integer, ForeignKey("lotes.id"), nullable=False, index=True)
    movimentacao_id = Column(Integer, ForeignKey("movimentacoes_estoque.id"), nullable=True)
    quantidade_utilizada = Column(Numeric(10, 2), nullable=False)
    unidade_medida = Column(String(20), nullable=False, default="un")
    exame_especifico = Column(String(150), nullable=True)
    criado_em = Column(DateTime, default=func.now())

    # Relacionamentos
    atendimento = relationship("AtendimentoPaciente", back_populates="consumos")
    material = relationship("Material")
    lote = relationship("Lote")
    movimentacao = relationship("MovimentacaoEstoque")


# =====================================================================
# 14. CADASTRO DE CONVÊNIOS (Configurações Globais)
# =====================================================================
class Convenio(Base):
    __tablename__ = "convenios"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(120), nullable=False, index=True)
    plano = Column(String(120), nullable=False)
    carencia = Column(String(100), nullable=False)
    ativo = Column(Boolean, default=True)
    criado_em = Column(DateTime, default=func.now())

    # Relacionamentos
    pacientes = relationship("Paciente", back_populates="convenio_rel")


# =====================================================================
# 15. CADASTRO DE PACIENTES (Configurações Globais)
# =====================================================================
class Paciente(Base):
    __tablename__ = "pacientes"

    id = Column(Integer, primary_key=True, index=True)
    nome_completo = Column(String(150), nullable=False, index=True)
    convenio_id = Column(Integer, ForeignKey("convenios.id"), nullable=True, index=True)
    convenio = Column(String(150), nullable=False)
    numero_carteirinha = Column(String(60), nullable=False)
    data_nascimento = Column(Date, nullable=False)
    codigo_atendimento = Column(String(60), nullable=False, index=True)
    endereco = Column(String(255), nullable=True)  # Opcional
    cpf = Column(String(20), nullable=False, index=True)
    rg = Column(String(25), nullable=False)
    telefone = Column(String(30), nullable=False)
    ativo = Column(Boolean, default=True)
    criado_em = Column(DateTime, default=func.now())

    # Relacionamentos
    convenio_rel = relationship("Convenio", back_populates="pacientes")


