from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.models import Material
from app.schemas.material_schema import CriarMaterial, MaterialRetorno

router = APIRouter()

#Create
@router.post("/", response_model=MaterialRetorno)
def criar_material(material: CriarMaterial, db: Session= Depends(get_db)):
    novo_material= Material (nome= material.nome, quantidade_estoque=material.quantidade_estoque, categoria_id=material.categoria_id)

    db.add(novo_material)
    db.commit()
    db.refresh(novo_material)

    return novo_material

#listar todos
@router.get("/", response_model=List[MaterialRetorno])
def listar_materiais(db: Session = Depends(get_db)):
    #SELECT * FROM
    materiais= db.query(Material).all()
    return materiais

#Listar só um
@router.get("/{material_id}", response_model=MaterialRetorno)
def buscar_material(material_id: int, db: Session= Depends(get_db)):
    material= db.query(Material).filter(Material.id == material_id).first()

    if not material:
        raise HTTPException(status_code= 404, detail="Material não encontrado")
    return material

#UPDATE
@router.put("/{material_id}", response_model=MaterialRetorno)
def atualizar_material(material_id: int, material_atualizado: CriarMaterial, db:Session= Depends(get_db)):

    #acha no banco
    material_banco= db.query(Material).filter(Material.id == material_id).first()
    if not material_banco:
        raise HTTPException(status_code= 404, detail="Material não encontrado")
    
    #substitui os valores. ATUALIZA DE FATO
    material_banco.nome = material_atualizado.nome
    material_banco.quantidade_estoque= material_atualizado.quantidade_estoque
    material_banco.categoria_id=material_atualizado.categoria_id

    #confirma
    db.commit()
    db.refresh(material_banco)

    return material_banco

#DELETE
@router.delete("/{material_id}")
def deletar_material(material_id: int, db: Session= Depends(get_db)):
    material_banco= db.query(Material).filter(Material.id == material_id).first()
    if not material_banco:
        raise HTTPException(status_code=404, detail="Material não encontrado")
    
    #deleta de fato
    db.delete(material_banco)
    db.commit()

    return{"mensagem":"Material deletado com sucesso !"}