"""
StockIA — Script de Inicialização Completa do Banco SQLite
============================================================
Cria todas as tabelas atualizadas da Fase 2 (Locais, Materiais com 
estoque mínimo/unidade, Lotes com local_id, Movimentações com estorno/transferência)
e insere os dados iniciais (Admin, Categorias, Locais e Doenças).
"""

import os
import sqlite3
from app.db.database import engine, Base
from app.models.models import (
    Usuario, Fornecedor, Categoria, LocalArmazenamento,
    Material, Lote, MovimentacaoEstoque, Doenca, materiais_doencas
)
from app.core.security import hash_senha
from sqlalchemy.orm import Session

db_file = "stockai.db"

# 1. Garante a criação de todas as tabelas
print("[+] Gerando tabelas atualizadas no SQLite...")
Base.metadata.create_all(bind=engine)

session = Session(bind=engine)

try:
    # 2. Usuário Admin
    admin_email = "admin@stockia.com"
    if not session.query(Usuario).filter(Usuario.email == admin_email).first():
        admin = Usuario(
            nome="Administrador",
            email=admin_email,
            senha_hash=hash_senha("admin123"),
            perfil="ADMIN",
        )
        session.add(admin)
        print("  [OK] Usuario ADMIN criado: admin@stockia.com / admin123")

    # 3. Locais de Armazenamento
    if not session.query(LocalArmazenamento).first():
        locais = [
            LocalArmazenamento(nome="Depósito Principal", tipo="AMBIENTE", descricao="Armazenamento geral em temperatura ambiente"),
            LocalArmazenamento(nome="Geladeira de Reagentes 2-8°C", tipo="REFRIGERADO", temperatura_atual=4.0, descricao="Cadeia de frio para reagentes enzimáticos"),
            LocalArmazenamento(nome="Freezer -20°C", tipo="CONGELADO", temperatura_atual=-20.0, descricao="Conservação de amostras e PCR"),
        ]
        session.add_all(locais)
        print("  [OK] Locais de Armazenamento padrão inseridos!")

    # 4. Categorias Padrão
    if not session.query(Categoria).first():
        cats = [
            Categoria(nome="Reagentes Químicos", descricao="Substâncias e compostos usados em análises laboratoriais."),
            Categoria(nome="Descartáveis", descricao="Luvas, ponteiras, tubos Falcon e microtubos."),
            Categoria(nome="Meios de Cultura", descricao="Soluções para microbiologia e bacteriologia."),
            Categoria(nome="Equipamentos de Proteção (EPI)", descricao="EPIs para biossegurança laboratorial."),
            Categoria(nome="Vidraria", descricao="Béqueres, provetas, pipetas graduadas e erlenmeyers."),
        ]
        session.add_all(cats)
        print("  [OK] Categorias de laboratório inseridas!")

    # 5. Doenças Epidemiológicas Padrão
    if not session.query(Doenca).first():
        doencas = [
            Doenca(nome="Dengue", cid_codigo="A90", descricao="Febre hemorrágica viral por Aedes aegypti"),
            Doenca(nome="Influenza A/B", cid_codigo="J10", descricao="Gripe sazonal respiratória"),
            Doenca(nome="Chikungunya", cid_codigo="A92.0", descricao="Arbovirose com dor articular grave"),
        ]
        session.add_all(doencas)
        print("  [OK] Doenças epidemiológicas iniciais inseridas!")

    session.commit()

    # 6. Atualizar versão no Alembic
    conn = sqlite3.connect("stockai.db")
    c = conn.cursor()
    c.execute("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL, PRIMARY KEY (version_num))")
    c.execute("DELETE FROM alembic_version")
    c.execute("INSERT INTO alembic_version VALUES ('b2f1a9c4d7e3')")
    conn.commit()
    conn.close()
    print("  [OK] Versão do esquema Alembic registrada: b2f1a9c4d7e3")

    print("\nBANCO DE DADOS INICIALIZADO COM SUCESSO E PRONTO PARA USO!")

except Exception as e:
    session.rollback()
    print(f"[ERRO] ao inicializar banco: {e}")
finally:
    session.close()
