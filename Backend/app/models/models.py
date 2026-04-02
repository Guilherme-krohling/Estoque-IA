from sqlalchemy import Column, ForeignKey, Integer, String, Float, Date, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base

class Categoria(Base):
    __tablename__ = 'categorias'

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False, unique=True) #nullable=False Significa que o banco NÃO aceita esse campo vazio/nulo
    descricao = Column(String, nullable=True) #nullable=True Significa que o banco aceita esse campo vazio/nulo
    materiais= relationship('Material', back_populates='categoria') #se relaciona com a outra classe, e com a variavel categoria que tem relationship
    

class Material(Base):
    __tablename__ = 'materiais'

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False, unique=True)
    quantidade_estoque= Column(Integer,  nullable= False, default=0)
    estoque_minimo = Column(Integer, nullable=False, default=0)
    localizacao = Column(String, nullable=True)
    observacoes = Column(String, nullable=True)
    categoria_id= Column(Integer, ForeignKey('categorias.id')) #pega o tablename e a coluna que quero, no caso id
    categoria= relationship('Categoria', back_populates='materiais') #se relaciona com a outra classe, e com a variavel materiais que tem relationship
    lotes= relationship('Lote', back_populates='material')

class Lote(Base):
    __tablename__= 'lotes'

    id= Column(Integer, primary_key=True, index=True)
    numero_lote= Column(String, nullable=False)
    data_validade= Column(Date, nullable=False)
    quantidade_atual= Column(Float, default=0.0)
    material_id= Column(Integer, ForeignKey('materiais.id'))
    material= relationship('Material', back_populates='lotes')
    criado_em=Column(DateTime, default=func.now())
    movimentacoes= relationship('MovimentacaoEstoque', back_populates='lote')

class MovimentacaoEstoque(Base):
    __tablename__ = 'movimentacoes_estoque'

    id= Column(Integer, primary_key=True, index=True)
    tipo= Column(String, nullable=False) #aqui vai ser tipo ENTRADA/SAIDA
    quantidade=Column(Float, nullable=False)
    motivo= Column(String, nullable=False) #EX: USO DIARIO/DESCARTE POR VENCIMENTO
    lote_id= Column(Integer, ForeignKey('lotes.id'))
    criado_em= Column(DateTime, default=func.now())
    lote= relationship('Lote', back_populates='movimentacoes')