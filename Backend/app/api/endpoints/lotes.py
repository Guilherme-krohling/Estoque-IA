from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.models import Lote
from app.schemas.lote_schema import CriarLote, LoteRetorno

router = APIRouter()

#Create
#Para criar um Lote amanhã, você vai precisar passar o material_id. Ou seja, o lote só existe se o material existir no banco!
@router.post("/", response_model=LoteRetorno)
def criar_lote(lote: CriarLote, db:Session= Depends(get_db)):
    novo_lote= Lote (numero_lote= lote.numero_lote, data_validade= lote.data_validade, quantidade_atual=lote.quantidade_atual,material_id= lote.material_id)
    db.add(novo_lote)
    db.commit()
    db.refresh(novo_lote)

    return novo_lote

#listar todos
@router.get("/", response_model=List[LoteRetorno])
def listar_lotes(db: Session= Depends(get_db)):
    lotes= db.query(Lote).all()
    return lotes

#listar um
@router.get("/{lote_id}", response_model=LoteRetorno)
def buscar_lote(lote_id: int, db: Session= Depends(get_db)):
    lote= db.query(Lote).filter(Lote.id == lote_id).first()

    if not lote:
        raise HTTPException(status_code= 404, detail="Lote não encontrado !")
    return lote

#update
@router.put("/{lote_id}", response_model=LoteRetorno)
def atualizar_lote(lote_id: int, lote_atualizado: CriarLote, db: Session= Depends(get_db)):

    lote_banco=db.query(Lote).filter(Lote.id == lote_id).first()
    if not lote_banco:
        raise HTTPException(status_code= 404, detail="Lote não encontrado !")
    
    lote_banco.numero_lote=lote_atualizado.numero_lote
    lote_banco.data_validade=lote_atualizado.data_validade
    lote_banco.quantidade_atual=lote_atualizado.quantidade_atual
    lote_banco.material_id=lote_atualizado.material_id

    db.commit()
    db.refresh(lote_banco)

    return lote_banco


#delete
@router.delete("/{lote_id}")
def deletar_lote(lote_id:int, db:Session=Depends(get_db)):
    lote_banco=db.query(Lote).filter(Lote.id == lote_id).first()
    if not lote_banco:
        raise HTTPException(status_code= 404, detail="Lote não encontrado !")
    
    db.delete(lote_banco)
    db.commit()

    return {"mensagem":"Lote deletado com sucesso !"}