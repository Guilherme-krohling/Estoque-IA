from fastapi import FastAPI, APIRouter

app = FastAPI()

#testando outra forma de fazer rotas
router = APIRouter()

# @app.get("/")
# def read_root():
#     return {"Hello": "Word"}

@app.router.get('/')
def first():
    return 'Hello world!'

app.include_router(prefix='first')