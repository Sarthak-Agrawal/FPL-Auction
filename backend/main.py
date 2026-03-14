from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models import create_db
from routers import setup, auction, dashboard

app = FastAPI(title="FPL Auction API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    create_db()


app.include_router(setup.router)
app.include_router(auction.router)
app.include_router(dashboard.router)


@app.get("/health")
def health():
    return {"status": "ok"}
