"""
StockIA — Script de Carga de Dados Epidemiológicos e Alinhamento de Escopo
==========================================================================
1. Atualiza schema do banco SQLite (cria dados_epidemiologicos e colunas de multiplicador).
2. Limpa doenças fora do escopo (remove VSR, Chikungunya, Zika e duplicatas).
3. Vincula materiais a Dengue e Influenza com os multiplicadores por exame.
4. Carrega os 3.624 registros do CSV consolidado para a tabela dados_epidemiologicos.
"""

import os
import sys
from datetime import datetime
import pandas as pd
from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import engine, SessionLocal, Base
from app.models.models import Material, Doenca, DadoEpidemiologico

def main():
    print("=== 1. Atualizando Schema do Banco de Dados ===")
    Base.metadata.create_all(bind=engine)
    
    with engine.connect() as conn:
        for col_def in [
            "quantidade_por_exame REAL DEFAULT 1.0",
            "unidade_por_exame TEXT DEFAULT 'un'"
        ]:
            try:
                conn.execute(text(f"ALTER TABLE materiais_doencas ADD COLUMN {col_def};"))
                conn.commit()
            except Exception:
                pass

    db = SessionLocal()
    
    print("\n=== 2. Alinhando Escopo de Doenças (Apenas Dengue e Influenza) ===")
    db.execute(text("DELETE FROM materiais_doencas;"))
    db.commit()
    
    db.execute(text("DELETE FROM doencas;"))
    db.commit()
    
    dengue = Doenca(
        id=1,
        nome="Dengue",
        cid_codigo="A90",
        descricao="Dengue (Sorotipos 1, 2, 3 e 4) - Infecção viral transmitida pelo Aedes aegypti",
        ativo=True,
    )
    influenza = Doenca(
        id=2,
        nome="Influenza",
        cid_codigo="J10",
        descricao="Influenza A e B (Gripe Sazonal) - Infecção viral do trato respiratório",
        ativo=True,
    )
    db.add(dengue)
    db.add(influenza)
    db.commit()
    print(f"-> Doenças canônicas criadas: Dengue (ID {dengue.id}), Influenza (ID {influenza.id})")

    print("\n=== 3. Vinculando Materiais com Multiplicadores ===")
    # Mapeamento com IDs explícitos dos insumos de teste / diagnóstico
    # ID 11: Tampão PCR 10X
    # ID 12: Kit RT-PCR Influenza A/B
    # ID 13: Kit NS1 Dengue
    # ID 14: Meio de Transporte Viral (VTM)
    # ID 15: Kit Extração RNA Viral QIAamp
    # ID 16: Ponteiras com Filtro 200uL
    # ID 17: Swab Nasofaríngeo Flocado
    # ID 18: Kit RT-PCR Dengue
    
    vinculos_exatos = [
        # Dengue (ID 1)
        (13, 1, 1.0, "un"),      # Kit NS1
        (18, 1, 1.0, "teste"),   # Kit RT-PCR Dengue
        (15, 1, 1.0, "un"),      # Kit Extração RNA
        (16, 1, 4.0, "un"),      # Ponteiras com Filtro
        (11, 1, 0.5, "ml"),      # Tampão PCR 10X
        
        # Influenza (ID 2)
        (17, 2, 1.0, "un"),      # Swab Nasofaríngeo
        (14, 2, 1.0, "un"),      # VTM
        (12, 2, 1.0, "teste"),   # Kit RT-PCR Influenza A/B
        (15, 2, 1.0, "un"),      # Kit Extração RNA
        (16, 2, 4.0, "un"),      # Ponteiras com Filtro
        (11, 2, 0.5, "ml"),      # Tampão PCR 10X
    ]
    
    for mat_id, doe_id, qtd, unidade in vinculos_exatos:
        stmt = text("""
            INSERT INTO materiais_doencas (material_id, doenca_id, quantidade_por_exame, unidade_por_exame)
            VALUES (:mat_id, :doe_id, :qtd, :uni);
        """)
        db.execute(stmt, {
            "mat_id": mat_id,
            "doe_id": doe_id,
            "qtd": qtd,
            "uni": unidade,
        })
    
    db.commit()
    total_vinculos = db.execute(text("SELECT COUNT(*) FROM materiais_doencas;")).scalar()
    print(f"Total de vínculos com multiplicador registrados: {total_vinculos}")

    print("\n=== 4. Carregando Histórico Epidemiológico Consolidado ===")
    csv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app", "data", "historico_epidemiologico_sp_baixada.csv")
    df = pd.read_csv(csv_path)
    print(f"Lendo {len(df)} registros de {csv_path}...")
    
    db.query(DadoEpidemiologico).delete()
    db.commit()
    
    mapa_doenca_id = {
        "Dengue": 1,
        "Influenza": 2,
    }
    
    registros = []
    for _, row in df.iterrows():
        doe_nome = str(row["doenca"])
        doe_id = mapa_doenca_id.get(doe_nome, 1)
        data_ini = datetime.strptime(str(row["data_inicio_semana"]), "%Y-%m-%d").date()
        
        reg = DadoEpidemiologico(
            doenca_id=doe_id,
            doenca_nome=doe_nome,
            localidade=str(row["localidade"]),
            ano=int(row["ano"]),
            semana_epidemiologica=int(row["semana_epidemiologica"]),
            semana_ano=str(row["semana_ano"]),
            data_inicio_semana=data_ini,
            casos_notificados=int(row["casos_notificados"]),
            casos_confirmados=int(row["casos_confirmados"]),
            casos_fem=int(row["casos_fem"]),
            casos_masc=int(row["casos_masc"]),
            casos_0_19=int(row["casos_0_19"]),
            casos_20_59=int(row["casos_20_59"]),
            casos_60_mais=int(row["casos_60_mais"]),
            fonte="DATASUS",
        )
        registros.append(reg)
        
    db.bulk_save_objects(registros)
    db.commit()
    
    total_db = db.query(DadoEpidemiologico).count()
    print(f"Sucesso! {total_db} semanas epidemiológicas salvas na tabela dados_epidemiologicos.")
    
    db.close()
    print("\n=== Passo 2 concluído com êxito! ===")

if __name__ == "__main__":
    main()
