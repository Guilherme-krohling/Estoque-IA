from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.models import MovimentacaoEstoque
from app.schemas.movimentacao_schema import CriarMovimentacao, MovimentacaoRetorno