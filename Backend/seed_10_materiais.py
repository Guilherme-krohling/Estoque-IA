"""
StockIA — Seed de 10 Materiais de Teste e Lotes
=================================================
Cadastra 10 materiais de teste com seus respectivos lotes e 
movimentações de ENTRADA para popular o sistema.
"""

from datetime import date, timedelta
from decimal import Decimal
from app.db.database import SessionLocal
from app.models.models import Material, Lote, MovimentacaoEstoque, Categoria, Fornecedor, LocalArmazenamento, Usuario

db = SessionLocal()

try:
    admin = db.query(Usuario).filter(Usuario.email == "admin@stockia.com").first()
    usuario_id = admin.id if admin else 1

    fornecedor = db.query(Fornecedor).first()
    if not fornecedor:
        fornecedor = Fornecedor(nome="Bioclin Diagnósticos", cnpj="12345678000199", contato="Carlos Silva", email="contato@bioclin.com")
        db.add(fornecedor)
        db.commit()
        db.refresh(fornecedor)

    local_deposito = db.query(LocalArmazenamento).filter(LocalArmazenamento.tipo == "AMBIENTE").first()
    local_geladeira = db.query(LocalArmazenamento).filter(LocalArmazenamento.tipo == "REFRIGERADO").first()
    
    dep_id = local_deposito.id if local_deposito else 1
    gel_id = local_geladeira.id if local_geladeira else dep_id

    categorias = db.query(Categoria).all()
    cat_ids = [c.id for c in categorias] if categorias else [1]

    hoje = date.today()

    materiais_teste = [
        {"nome": "Material Teste 1 - Kit Extração RNA/DNA", "codigo": "EX-RNA-01", "un": "cx", "min": 10, "saldo": 4, "validade": hoje + timedelta(days=25), "ref": True, "cat": cat_ids[0]},
        {"nome": "Material Teste 2 - Reagente Tampão PCR 10X", "codigo": "PCR-BUF-10", "un": "ml", "min": 50, "saldo": 20, "validade": hoje + timedelta(days=180), "ref": True, "cat": cat_ids[0]},
        {"nome": "Material Teste 3 - Ponteiras 200ul com Filtro", "codigo": "PNT-200F", "un": "cx", "min": 15, "saldo": 15, "validade": hoje + timedelta(days=365), "ref": False, "cat": cat_ids[1] if len(cat_ids) > 1 else cat_ids[0]},
        {"nome": "Material Teste 4 - Microtubos Eppendorf 1.5ml", "codigo": "EPP-1500", "un": "pacote", "min": 20, "saldo": 5, "validade": hoje + timedelta(days=500), "ref": False, "cat": cat_ids[1] if len(cat_ids) > 1 else cat_ids[0]},
        {"nome": "Material Teste 5 - Agar Sabouraud Dextrose", "codigo": "AGR-SAB-05", "un": "frasco", "min": 8, "saldo": 0, "validade": hoje + timedelta(days=90), "ref": False, "cat": cat_ids[2] if len(cat_ids) > 2 else cat_ids[0]},
        {"nome": "Material Teste 6 - Caldo Nutritivo para Hemocultura", "codigo": "CLD-HEM-12", "un": "frasco", "min": 12, "saldo": 3, "validade": hoje - timedelta(days=10), "ref": False, "cat": cat_ids[2] if len(cat_ids) > 2 else cat_ids[0]}, # Vencido!
        {"nome": "Material Teste 7 - Luvas de Nitrilo Tam M", "codigo": "LUV-NIT-M", "un": "caixa", "min": 30, "saldo": 45, "validade": hoje + timedelta(days=700), "ref": False, "cat": cat_ids[3] if len(cat_ids) > 3 else cat_ids[0]},
        {"nome": "Material Teste 8 - Álcool Isopropílico 70%", "codigo": "ALC-ISO-70", "un": "litro", "min": 10, "saldo": 2, "validade": hoje + timedelta(days=400), "ref": False, "cat": cat_ids[0]},
        {"nome": "Material Teste 9 - Pipeta Sorológica 10ml", "codigo": "PIP-SOR-10", "un": "pacote", "min": 5, "saldo": 8, "validade": hoje + timedelta(days=600), "ref": False, "cat": cat_ids[4] if len(cat_ids) > 4 else cat_ids[0]},
        {"nome": "Material Teste 10 - Bequer de Vidro Borossilicato 500ml", "codigo": "BEQ-VID-500", "un": "un", "min": 4, "saldo": 6, "validade": hoje + timedelta(days=1000), "ref": False, "cat": cat_ids[4] if len(cat_ids) > 4 else cat_ids[0]},
    ]

    for idx, data in enumerate(materiais_teste, start=1):
        existente = db.query(Material).filter(Material.nome == data["nome"]).first()
        if existente:
            print(f"Material {data['nome']} já existe. Ignorando...")
            continue

        mat = Material(
            nome=data["nome"],
            codigo_catalogo=data["codigo"],
            categoria_id=data["cat"],
            fabricante="LabPharma Brasil",
            fornecedor_id=fornecedor.id,
            unidade_medida=data["un"],
            fator_conversao=Decimal("1.0"),
            estoque_minimo=Decimal(str(data["min"])),
            exige_refrigeracao=data["ref"],
            temperatura_min=Decimal("2.0") if data["ref"] else None,
            temperatura_max=Decimal("8.0") if data["ref"] else None,
        )
        db.add(mat)
        db.commit()
        db.refresh(mat)

        num_lote = f"LT-2026-{idx:03d}"
        lote = Lote(
            material_id=mat.id,
            local_id=gel_id if data["ref"] else dep_id,
            numero_lote=num_lote,
            data_fabricacao=hoje - timedelta(days=60),
            data_validade=data["validade"],
            fornecedor_id=fornecedor.id,
            quantidade_atual=Decimal(str(data["saldo"])),
        )
        db.add(lote)
        db.commit()
        db.refresh(lote)

        if data["saldo"] > 0:
            mov = MovimentacaoEstoque(
                lote_id=lote.id,
                usuario_id=usuario_id,
                tipo="ENTRADA",
                quantidade=Decimal(str(data["saldo"])),
                unidade_medida=data["un"],
                motivo="Cadastro Inicial de Estoque",
                referencia=f"NF-{1000+idx}",
            )
            db.add(mov)
            db.commit()

    print("[OK] 10 Materiais de teste com lotes e movimentacoes cadastrados com sucesso!")

except Exception as e:
    db.rollback()
    print(f"[ERRO] ao cadastrar materiais de teste: {e}")
finally:
    db.close()
