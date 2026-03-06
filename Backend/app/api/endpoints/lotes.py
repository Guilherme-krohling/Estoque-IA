from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.models import Lote
from app.schemas.lote_schema import CriarLote, LoteRetorno