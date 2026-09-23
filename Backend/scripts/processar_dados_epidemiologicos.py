"""
Script de ETL: Processamento e Consolidação de Dados Epidemiológicos
Laurus AI — Baixada Santista e Estado de São Paulo (2021 a 2026)
===================================================================
Lê os CSVs brutos do SINAN (Dengue) e SIVEP-Gripe (Influenza)
e consolida uma série temporal semanal compacta por localidade.
"""

import os
import glob
import time
from datetime import datetime, timedelta
from collections import defaultdict
import pandas as pd

# Mapeamento dos municípios da Baixada Santista (Códigos IBGE 6 dígitos)
MUNICIPIOS_BAIXADA = {
    354850: "Santos",
    355100: "São Vicente",
    351870: "Guarujá",
    354100: "Praia Grande",
    351350: "Cubatão",
    350635: "Bertioga",
    352210: "Itanhaém",
    353110: "Mongaguá",
    353760: "Peruíbe",
}

# 7 Localidades principais do dropdown da tela nova
LOCALIDADES_ALVO = [
    "Estado de São Paulo",
    "Baixada Santista",
    "Santos",
    "Cubatão",
    "Guarujá",
    "São Vicente",
    "Praia Grande",
]

def extrair_idade_em_anos(nu_idade):
    """Converte formato do DATASUS (ex: 4025 -> 25 anos)"""
    try:
        val = int(nu_idade)
        if val >= 4000:
            return val - 4000
        elif val < 4000:
            return 0  # meses, dias ou horas
    except:
        pass
    return -1

def calcular_data_inicio_semana(ano, semana):
    """Calcula a data do primeiro dia (domingo) da semana epidemiológica"""
    try:
        primeiro_dia = datetime(ano, 1, 1)
        dias_ate_domingo = (6 - primeiro_dia.weekday()) % 7
        primeiro_domingo = primeiro_dia + timedelta(days=dias_ate_domingo)
        data_se = primeiro_domingo + timedelta(weeks=semana - 1)
        return data_se.strftime("%Y-%m-%d")
    except:
        return f"{ano}-01-01"

def processar_dengue(ano, filepath, agregador):
    print(f"\n[Dengue] Processando {ano}: {os.path.basename(filepath)}...")
    t0 = time.time()
    
    usecols = ["SG_UF_NOT", "ID_MUNICIP", "SEM_NOT", "CLASSI_FIN", "CS_SEXO", "NU_IDADE_N"]
    chunks = pd.read_csv(filepath, usecols=usecols, chunksize=100000, low_memory=False)
    
    total_linhas = 0
    linhas_sp = 0
    
    for chunk in chunks:
        total_linhas += len(chunk)
        # Filtra SP (35)
        sp_mask = chunk["SG_UF_NOT"] == 35
        sp_chunk = chunk[sp_mask]
        linhas_sp += len(sp_chunk)
        
        if sp_chunk.empty:
            continue
            
        for _, row in sp_chunk.iterrows():
            sem_not = row["SEM_NOT"]
            try:
                sem_not_int = int(sem_not)
                sem_ano = sem_not_int // 100
                semana = sem_not_int % 100
                if sem_ano != ano:
                    sem_ano = ano
            except:
                sem_ano = ano
                semana = 1
                
            if semana < 1 or semana > 53:
                continue
                
            mun = row["ID_MUNICIP"]
            try:
                mun_cod = int(mun)
            except:
                mun_cod = 0
                
            # Classificação: confirmados (10=dengue, 11=sinais alarme, 12=grave)
            try:
                cf = int(row["CLASSI_FIN"])
                is_conf = 1 if cf in [10, 11, 12] else 0
            except:
                is_conf = 0
                
            # Sexo
            sexo = str(row["CS_SEXO"]).strip().upper()
            is_fem = 1 if sexo == "F" else 0
            is_masc = 1 if sexo == "M" else 0
            
            # Idade
            idade = extrair_idade_em_anos(row["NU_IDADE_N"])
            is_0_19 = 1 if 0 <= idade <= 19 else 0
            is_20_59 = 1 if 20 <= idade <= 59 else 0
            is_60 = 1 if idade >= 60 else 0
            
            # Localidades a pontuar
            locs = ["Estado de São Paulo"]
            if mun_cod in MUNICIPIOS_BAIXADA:
                locs.append("Baixada Santista")
                nome_mun = MUNICIPIOS_BAIXADA[mun_cod]
                if nome_mun in LOCALIDADES_ALVO:
                    locs.append(nome_mun)
                    
            for loc in locs:
                k = ("Dengue", loc, sem_ano, semana)
                ag = agregador[k]
                ag["notificados"] += 1
                ag["confirmados"] += is_conf
                ag["fem"] += is_fem
                ag["masc"] += is_masc
                ag["idade_0_19"] += is_0_19
                ag["idade_20_59"] += is_20_59
                ag["idade_60_mais"] += is_60

    dt = time.time() - t0
    print(f"[Dengue] {ano} concluído em {dt:.1f}s ({total_linhas:,} linhas lidas, {linhas_sp:,} de SP)")

def processar_influenza(ano, filepath, agregador):
    print(f"\n[Influenza] Processando {ano}: {os.path.basename(filepath)}...")
    t0 = time.time()
    
    usecols = ["SG_UF_NOT", "CO_MUN_NOT", "SEM_NOT", "SEM_PRI", "CLASSI_FIN", "CS_SEXO", "NU_IDADE_N", "POS_PCRFLU"]
    chunks = pd.read_csv(filepath, sep=";", usecols=usecols, chunksize=100000, low_memory=False)
    
    total_linhas = 0
    linhas_sp = 0
    
    for chunk in chunks:
        total_linhas += len(chunk)
        # Filtra SP ("SP" ou 35)
        sp_mask = chunk["SG_UF_NOT"].astype(str).str.strip().str.upper().isin(["SP", "35"])
        sp_chunk = chunk[sp_mask]
        linhas_sp += len(sp_chunk)
        
        if sp_chunk.empty:
            continue
            
        for _, row in sp_chunk.iterrows():
            try:
                semana = int(row["SEM_PRI"])
            except:
                try:
                    semana = int(row["SEM_NOT"])
                except:
                    semana = 1
                    
            if semana < 1 or semana > 53:
                continue
                
            sem_ano = ano
            
            mun = row["CO_MUN_NOT"]
            try:
                mun_cod = int(mun)
            except:
                mun_cod = 0
                
            # Classificação Influenza: CLASSI_FIN == 1 ou POS_PCRFLU == 1
            try:
                cf = int(row["CLASSI_FIN"])
                pcr_flu = int(row["POS_PCRFLU"]) if pd.notna(row["POS_PCRFLU"]) else 0
                is_conf = 1 if (cf == 1 or pcr_flu == 1) else 0
            except:
                is_conf = 0
                
            # Sexo
            sexo = str(row["CS_SEXO"]).strip().upper()
            is_fem = 1 if sexo == "F" else 0
            is_masc = 1 if sexo == "M" else 0
            
            # Idade
            idade = extrair_idade_em_anos(row["NU_IDADE_N"])
            is_0_19 = 1 if 0 <= idade <= 19 else 0
            is_20_59 = 1 if 20 <= idade <= 59 else 0
            is_60 = 1 if idade >= 60 else 0
            
            # Localidades a pontuar
            locs = ["Estado de São Paulo"]
            if mun_cod in MUNICIPIOS_BAIXADA:
                locs.append("Baixada Santista")
                nome_mun = MUNICIPIOS_BAIXADA[mun_cod]
                if nome_mun in LOCALIDADES_ALVO:
                    locs.append(nome_mun)
                    
            for loc in locs:
                k = ("Influenza", loc, sem_ano, semana)
                ag = agregador[k]
                ag["notificados"] += 1
                ag["confirmados"] += is_conf
                ag["fem"] += is_fem
                ag["masc"] += is_masc
                ag["idade_0_19"] += is_0_19
                ag["idade_20_59"] += is_20_59
                ag["idade_60_mais"] += is_60

    dt = time.time() - t0
    print(f"[Influenza] {ano} concluído em {dt:.1f}s ({total_linhas:,} linhas lidas, {linhas_sp:,} de SP)")

def main():
    root_dir = r"d:\projetos\Prj-Lab"
    agregador = defaultdict(lambda: {
        "notificados": 0,
        "confirmados": 0,
        "fem": 0,
        "masc": 0,
        "idade_0_19": 0,
        "idade_20_59": 0,
        "idade_60_mais": 0,
    })
    
    anos = range(2021, 2027)
    
    print("===================================================================")
    print("Iniciando Consolidação Epidemiológica Laurus AI (2021 a 2026)")
    print("===================================================================")
    
    for ano in anos:
        folder = os.path.join(root_dir, f"dados {ano}")
        if not os.path.isdir(folder):
            print(f"[AVISO] Pasta {folder} não encontrada. Pulando...")
            continue
            
        deng_files = glob.glob(os.path.join(folder, "DENG*.csv"))
        flu_files = glob.glob(os.path.join(folder, "INFLU*.csv"))
        
        if deng_files:
            processar_dengue(ano, deng_files[0], agregador)
            
        if flu_files:
            processar_influenza(ano, flu_files[0], agregador)
            
    print("\n[Consolidação] Gerando DataFrame final...")
    records = []
    for (doenca, localidade, ano, semana), dados in agregador.items():
        data_ini = calcular_data_inicio_semana(ano, semana)
        semana_formatada = f"{ano}{semana:02d}"
        records.append({
            "doenca": doenca,
            "localidade": localidade,
            "ano": ano,
            "semana_epidemiologica": semana,
            "semana_ano": semana_formatada,
            "data_inicio_semana": data_ini,
            "casos_notificados": dados["notificados"],
            "casos_confirmados": dados["confirmados"],
            "casos_fem": dados["fem"],
            "casos_masc": dados["masc"],
            "casos_0_19": dados["idade_0_19"],
            "casos_20_59": dados["idade_20_59"],
            "casos_60_mais": dados["idade_60_mais"],
        })
        
    df_final = pd.DataFrame(records)
    df_final.sort_values(by=["doenca", "localidade", "ano", "semana_epidemiologica"], inplace=True)
    
    # Salvar em Backend/app/data
    out_dir = os.path.join(root_dir, "Backend", "app", "data")
    os.makedirs(out_dir, exist_ok=True)
    
    out_csv = os.path.join(out_dir, "historico_epidemiologico_sp_baixada.csv")
    df_final.to_csv(out_csv, index=False, encoding="utf-8")
    
    print(f"\n===================================================================")
    print(f"Sucesso! Arquivo consolidado salvo em:")
    print(f"-> {out_csv}")
    print(f"Total de registros agregados: {len(df_final):,} semanas/localidades")
    print(f"Tamanho do arquivo: {os.path.getsize(out_csv) / 1024:.1f} KB")
    print("===================================================================")
    
    # Exibir resumo por doença e localidade
    resumo = df_final.groupby(["doenca", "localidade"])[["casos_notificados", "casos_confirmados"]].sum()
    print("\nResumo Total de Casos (2021-2026):")
    print(resumo)

if __name__ == "__main__":
    main()
