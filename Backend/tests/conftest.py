"""
Fixtures de teste — usa SQLite em memória isolado (não toca no Postgres de dev).
"""
import os
import sys

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Garante que o pacote `app` seja importável (raiz = Backend/)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import Base, get_db
from app.main import app
from app.models.models import Usuario
from app.core.security import hash_senha, criar_token_acesso


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def admin(db_session):
    user = Usuario(nome="Admin Teste", email="admin@test.com", senha_hash=hash_senha("senha12345"), perfil="ADMIN")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def auth(admin):
    token = criar_token_acesso({"sub": str(admin.id), "perfil": admin.perfil})
    return {"Authorization": f"Bearer {token}"}
