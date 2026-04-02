import os 
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Carrega as variáveis do arquivo .env para o ambiente
load_dotenv()

# Coleta a URL de conexão do banco de dados
db_url = os.getenv('DATABASE_URL')

# Valida se a URL existe para evitar que a aplicação rode sem banco
if not db_url:
    raise ValueError("ERRO CRÍTICO: Variável DATABASE_URL não encontrada no arquivo .env!")
else:
    print("Sucesso: Conexão com o Banco de Dados configurada.")

# Cria o motor que gerencia a comunicação e o pool de conexões com o PostgreSQL / SQLite
if db_url.startswith("sqlite"):
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
else:
    engine = create_engine(db_url)

# Cria a fábrica de sessões para as transações no banco (operações de leitura/escrita)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Cria a classe base. Todos os modelos ORM (tabelas) vão herdar dela para serem mapeados pelo SQLAlchemy
Base = declarative_base()

# FUNÇÃO NOVA:
def get_db():
    # Abre uma nova "janela" de conversa com o banco de dados
    db = SessionLocal()
    try:
        # "Pausa" a função e empresta essa conexão para a rota que pediu
        yield db
    finally:
        # Quando a rota termina o que tinha que fazer, essa linha roda obrigatoriamente
        # Fechando a conexão para não travar o servidor por excesso de tráfego.
        db.close()
