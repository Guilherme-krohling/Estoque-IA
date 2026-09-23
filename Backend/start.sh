#!/bin/bash
echo "Inicializando banco de dados no Render..."

# 1. Cria o banco de dados e as tabelas, além de carregar categorias
python init_sqlite.py

# 2. Insere os materiais, lotes e histórico da IA
python seed_demo_ia.py

# 3. Insere os dados epidemiológicos da Dengue e Influenza (2021 a 2026)
python seed_santos_epidemiologico.py

echo "Dados de demonstração carregados com sucesso! Iniciando o servidor..."

# 4. Inicia a API
uvicorn app.main:app --host 0.0.0.0 --port $PORT
