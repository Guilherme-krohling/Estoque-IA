from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.models import Categoria
from app.schemas.categoria_schema import CriarCategoria, CategoriaRetorno

# Cria o "mini-aplicativo" de rotas exclusivo para Categorias
router = APIRouter()

# =====================================================================
# 1. CREATE (Criar uma nova categoria)
# =====================================================================
@router.post("/", response_model=CategoriaRetorno)
def criar_categoria(categoria: CriarCategoria, db: Session = Depends(get_db)):
    # Pega os dados validados pelo schema e transforma no formato do banco (Model)
    nova_categoria = Categoria(nome=categoria.nome, descricao=categoria.descricao)
    
    # Prepara para salvar, salva de fato, e atualiza a variável para pegar o ID gerado
    db.add(nova_categoria)
    db.commit()
    db.refresh(nova_categoria)
    
    return nova_categoria

# =====================================================================
# 2. READ ALL (Listar todas as categorias)
# =====================================================================
# response_model é uma Lista (List) do nosso schema de retorno
@router.get("/", response_model=List[CategoriaRetorno])
def listar_categorias(db: Session = Depends(get_db)):
    # Faz um SELECT * FROM categorias no banco de dados
    categorias = db.query(Categoria).all()
    return categorias

# =====================================================================
# 3. READ ONE (Buscar apenas uma categoria pelo ID)
# =====================================================================
@router.get("/{categoria_id}", response_model=CategoriaRetorno)
def buscar_categoria(categoria_id: int, db: Session = Depends(get_db)):
    # Faz a busca filtrando pelo ID. O .first() pega o primeiro resultado que achar.
    categoria = db.query(Categoria).filter(Categoria.id == categoria_id).first()
    
    # Se o banco não achar nada, devolvemos um Erro 404 (Não Encontrado)
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
        
    return categoria

# =====================================================================
# 4. UPDATE (Atualizar uma categoria existente)
# =====================================================================
@router.put("/{categoria_id}", response_model=CategoriaRetorno)
def atualizar_categoria(categoria_id: int, categoria_atualizada: CriarCategoria, db: Session = Depends(get_db)):
    # 1º Passo: Tenta achar a categoria no banco
    categoria_banco = db.query(Categoria).filter(Categoria.id == categoria_id).first()
    if not categoria_banco:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    
    # 2º Passo: Substitui os valores antigos pelos novos
    categoria_banco.nome = categoria_atualizada.nome
    categoria_banco.descricao = categoria_atualizada.descricao
    
    # 3º Passo: Confirma as alterações e atualiza
    db.commit()
    db.refresh(categoria_banco)
    
    return categoria_banco

# =====================================================================
# 5. DELETE (Excluir uma categoria)
# =====================================================================
# Aqui não precisamos de response_model, vamos devolver só uma mensagem
@router.delete("/{categoria_id}")
def deletar_categoria(categoria_id: int, db: Session = Depends(get_db)):
    # Tenta achar a categoria
    categoria_banco = db.query(Categoria).filter(Categoria.id == categoria_id).first()
    if not categoria_banco:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    
    # Deleta do banco e confirma
    db.delete(categoria_banco)
    db.commit()
    
    return {"mensagem": "Categoria deletada com sucesso!"}