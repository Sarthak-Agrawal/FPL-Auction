from __future__ import annotations
from datetime import datetime
from enum import Enum
from typing import Optional
from sqlmodel import Field, SQLModel, create_engine, Session

DATABASE_URL = "sqlite:///./fpl_auction.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def get_session():
    with Session(engine) as session:
        yield session


def create_db():
    SQLModel.metadata.create_all(engine)


# ---------- Enums ----------

class PlayerRole(str, Enum):
    batsman = "Batsman"
    bowler = "Bowler"
    all_rounder = "All-Rounder"
    wicket_keeper = "Wicket-Keeper"


class PlayerStatus(str, Enum):
    pending = "pending"
    sold = "sold"
    unsold = "unsold"


class AuctionStatus(str, Enum):
    setup = "setup"
    active = "active"
    paused = "paused"
    complete = "complete"


# ---------- DB Models ----------

class Team(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True)
    budget_total: float
    budget_remaining: float
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Player(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    role: PlayerRole
    base_price: float
    nationality: Optional[str] = None
    ipl_team: Optional[str] = None
    status: PlayerStatus = Field(default=PlayerStatus.pending)
    sold_to_team_id: Optional[int] = Field(default=None, foreign_key="team.id")
    sold_price: Optional[float] = None


class Bid(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    player_id: int = Field(foreign_key="player.id")
    team_id: int = Field(foreign_key="team.id")
    amount: float
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class AuctionConfig(SQLModel, table=True):
    """Singleton row — always id=1."""
    id: Optional[int] = Field(default=1, primary_key=True)
    status: AuctionStatus = Field(default=AuctionStatus.setup)
    timer_duration: int = Field(default=30)
    autopilot: bool = Field(default=False)
    current_player_id: Optional[int] = Field(default=None, foreign_key="player.id")
    current_highest_bid: Optional[float] = None
    current_highest_team_id: Optional[int] = Field(default=None, foreign_key="team.id")
    admin_password_hash: Optional[str] = None
