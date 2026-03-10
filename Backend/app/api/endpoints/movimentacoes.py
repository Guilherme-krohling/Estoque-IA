from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.models import MovimentacaoEstoque, Lote, Material
from app.schemas.movimentacao_schema import CriarMovimentacao, MovimentacaoRetorno

router= APIRouter()

def dar_entrada_estoque(lote: Lote, material: Material, quantidade_movimentada: int):
    lote.quantidade_atual += quantidade_movimentada
    material.quantidade_estoque += quantidade_movimentada

def dar_baixa_estoque(lote: Lote, material: Material, quantidade_movimentada: int):
    if lote.quantidade_atual < quantidade_movimentada:
        raise HTTPException(status_code=400, detail="Estoque insuficiente neste lote!")
    lote.quantidade_atual -= quantidade_movimentada
    material.quantidade_estoque -= quantidade_movimentada

#create
#A Movimentação vai exigir um lote_id. É a ponta final da nossa teia de relacionamentos (Categoria -> Material -> Lote -> Movimentação).
@router.post("/",response_model=MovimentacaoRetorno)
def criar_movimentacao(movimentacao: CriarMovimentacao, db: Session=Depends(get_db)):

    #Busca o lote usando ID
    lote_banco=db.query(Lote).filter(Lote.id == movimentacao.lote_id).first()
    if not lote_banco:
        raise HTTPException(status_code=404, detail="Lote não encontrado!")
    
    #Buscca o Material dono daquele Lote
    material_banco= db.query(Material).filter(Material.id == lote_banco.material_id).first()
    if not material_banco:
        raise HTTPException(status_code=404, detail="Material não encontrado!")
    
    # DECIDE qual função chamar
    if movimentacao.tipo == "Entrada":
        dar_entrada_estoque(lote=lote_banco, material=material_banco, quantidade_movimentada=movimentacao.quantidade)
    elif movimentacao.tipo == "Saida":
        dar_baixa_estoque(lote=lote_banco, material=material_banco, quantidade_movimentada=movimentacao.quantidade)
    else:
        raise HTTPException(status_code=400, detail="Tipo de movimentação inválido! Use 'Entrada' ou 'Saida'.")


    nova_movimentacao= MovimentacaoEstoque(
        tipo= movimentacao.tipo, 
        quantidade= movimentacao.quantidade, 
        motivo=movimentacao.motivo,
        lote_id=movimentacao.lote_id
    )

    db.add(nova_movimentacao)

    # Salva a Movimentação, o Lote (alterado) e o Material (alterado) TUDO DE UMA VEZ!
    db.commit()
    db.refresh(nova_movimentacao)

    return nova_movimentacao

#listar tudo
@router.get("/", response_model=List[MovimentacaoRetorno])
def listar_movimentacoes(db: Session= Depends(get_db)):
    movimentacoes= db.query(MovimentacaoEstoque).all()
    return movimentacoes

#listar um
@router.get("/{movimentacao_id}", response_model=MovimentacaoRetorno)
def buscar_movimentacao(movimentacao_id: int, db: Session= Depends(get_db)):
    movimentacao= db.query(MovimentacaoEstoque).filter(MovimentacaoEstoque.id == movimentacao_id).first()

    if not movimentacao:
        raise HTTPException(status_code= 404, detail="Movimentacao não encontrada no estoque !")
    
    return movimentacao

#update
@router.put("/{movimentacao_id}", response_model= MovimentacaoRetorno)
def atualizar_movimentacao(movimentacao_id: int, movimentacao_atualizada:CriarMovimentacao, db: Session= Depends(get_db)):

    movimentacao_banco= db.query(MovimentacaoEstoque).filter(MovimentacaoEstoque.id == movimentacao_id).first()

    if not movimentacao_banco:
        raise HTTPException(status_code= 404, detail="Movimentacao não encontrada no estoque !")
    
    movimentacao_banco.tipo=movimentacao_atualizada.tipo
    movimentacao_banco.quantidade=movimentacao_atualizada.quantidade
    movimentacao_banco.motivo=movimentacao_atualizada.motivo
    movimentacao_banco.lote_id=movimentacao_atualizada.lote_id

    db.commit()
    db.refresh(movimentacao_banco)

    return movimentacao_banco

#delete
@router.delete("/{movimentacao_id}")
def deletar_movimentacao(movimentacao_id: int, db: Session= Depends(get_db)):
    movimentacao_banco= db.query(MovimentacaoEstoque).filter(MovimentacaoEstoque.id == movimentacao_id).first()

    if not movimentacao_banco:
        raise HTTPException(status_code= 404, detail="Movimentacao não encontrada no estoque !")

    db.delete(movimentacao_banco)
    db.commit()

    return {"mensagem":"Movimentação deletado com sucesso !"}