import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models import create_db
from routers import setup, auction, dashboard

app = FastAPI(title="FPL Auction API", version="1.0.0")

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]
allow_credentials = "*" not in allowed_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_credentials,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    create_db()


@app.on_event("shutdown")
def on_shutdown():
    from auction_engine import _cancel_timer

    _cancel_timer()


app.include_router(setup.router)
app.include_router(auction.router)
app.include_router(dashboard.router)


@app.get("/health")
def health():
    return {"status": "ok"}
