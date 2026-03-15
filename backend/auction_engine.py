"""
Core auction state machine.
All mutations happen here; the engine broadcasts via ws_manager.
"""
from __future__ import annotations

import asyncio
import logging
import math
from typing import Optional

from sqlmodel import Session, select

from models import AuctionConfig, AuctionStatus, Bid, Player, PlayerStatus, Team, engine
from ws_manager import manager

logger = logging.getLogger(__name__)


# ---------- helpers ----------

def _get_config(session: Session) -> AuctionConfig:
    cfg = session.get(AuctionConfig, 1)
    if cfg is None:
        cfg = AuctionConfig(id=1)
        session.add(cfg)
        session.commit()
        session.refresh(cfg)
    return cfg


def _player_dict(p: Player) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "role": p.role,
        "base_price": p.base_price,
        "nationality": p.nationality,
        "ipl_team": p.ipl_team,
        "status": p.status,
        "sold_to_team_id": p.sold_to_team_id,
        "sold_price": p.sold_price,
    }


def _team_dict(t: Team) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "budget_total": t.budget_total,
        "budget_remaining": t.budget_remaining,
    }


def _full_state(session: Session) -> dict:
    cfg = _get_config(session)
    current_player = session.get(Player, cfg.current_player_id) if cfg.current_player_id else None
    current_team = session.get(Team, cfg.current_highest_team_id) if cfg.current_highest_team_id else None
    teams = session.exec(select(Team)).all()
    pending_count = session.exec(select(Player).where(Player.status == PlayerStatus.pending)).all()
    return {
        "status": cfg.status,
        "autopilot": cfg.autopilot,
        "timer_duration": cfg.timer_duration,
        "current_player": _player_dict(current_player) if current_player else None,
        "current_highest_bid": cfg.current_highest_bid,
        "current_highest_team": _team_dict(current_team) if current_team else None,
        "teams": [_team_dict(t) for t in teams],
        "pending_players": len(pending_count),
    }


# ---------- timer ----------

_timer_task: Optional[asyncio.Task] = None
_timer_remaining: int = 0
_auction_lock = asyncio.Lock()


async def _run_timer(duration: int):
    global _timer_remaining
    _timer_remaining = max(int(duration), 0)
    try:
        while _timer_remaining > 0:
            await manager.broadcast("timer_tick", {"seconds_remaining": _timer_remaining})
            await asyncio.sleep(1)
            _timer_remaining -= 1
        await _auto_sell()
    except asyncio.CancelledError:
        return


def _cancel_timer():
    global _timer_task, _timer_remaining
    if _timer_task and not _timer_task.done():
        _timer_task.cancel()
    _timer_task = None
    _timer_remaining = 0


def _start_timer(duration: int):
    global _timer_task
    _cancel_timer()
    _timer_task = asyncio.create_task(_run_timer(max(int(duration), 0)))


# ---------- engine actions ----------

async def start_auction():
    async with _auction_lock:
        with Session(engine) as session:
            cfg = _get_config(session)
            cfg.status = AuctionStatus.active
            session.add(cfg)
            session.commit()
    await _load_next_player()


async def _load_next_player():
    next_player_payload = None
    state_payload = None
    is_complete = False
    timer_duration = 0

    async with _auction_lock:
        with Session(engine) as session:
            cfg = _get_config(session)
            next_player = session.exec(
                select(Player)
                .where(Player.status == PlayerStatus.pending)
                .order_by(Player.role, Player.id)
            ).first()

            if next_player is None:
                cfg.status = AuctionStatus.complete
                cfg.current_player_id = None
                cfg.current_highest_bid = None
                cfg.current_highest_team_id = None
                session.add(cfg)
                session.commit()
                _cancel_timer()
                is_complete = True
            else:
                cfg.current_player_id = next_player.id
                cfg.current_highest_bid = None
                cfg.current_highest_team_id = None
                session.add(cfg)
                session.commit()
                session.refresh(next_player)
                state_payload = _full_state(session)
                next_player_payload = _player_dict(next_player)
                timer_duration = state_payload["timer_duration"]

    if is_complete:
        await manager.broadcast("auction_complete", {"message": "All players have been auctioned!"})
        return

    await manager.broadcast("next_player", next_player_payload)
    await manager.broadcast("auction_state", state_payload)
    _start_timer(timer_duration)


async def place_bid(team_id: int, amount: float) -> dict:
    if not math.isfinite(amount) or amount <= 0:
        return {"ok": False, "error": "Bid amount must be a positive number"}

    async with _auction_lock:
        with Session(engine) as session:
            cfg = _get_config(session)

            if cfg.status != AuctionStatus.active or cfg.current_player_id is None:
                return {"ok": False, "error": "No active auction"}

            player = session.get(Player, cfg.current_player_id)
            team = session.get(Team, team_id)

            if player is None:
                return {"ok": False, "error": "Current player not found"}
            if team is None:
                return {"ok": False, "error": "Team not found"}

            if cfg.current_highest_bid is None:
                if amount < player.base_price:
                    return {"ok": False, "error": f"Bid must be at least {player.base_price}"}
            elif amount <= cfg.current_highest_bid:
                return {
                    "ok": False,
                    "error": f"Bid must be greater than {cfg.current_highest_bid}",
                }

            if amount > team.budget_remaining:
                return {"ok": False, "error": "Insufficient budget"}

            if cfg.current_highest_team_id == team_id and cfg.current_highest_bid is not None:
                return {"ok": False, "error": "You already hold the highest bid"}

            cfg.current_highest_bid = amount
            cfg.current_highest_team_id = team_id
            session.add(cfg)

            bid = Bid(player_id=cfg.current_player_id, team_id=team_id, amount=amount)
            session.add(bid)
            session.commit()

            state_payload = _full_state(session)

    _start_timer(state_payload["timer_duration"])
    await manager.broadcast(
        "bid_placed",
        {
            "team": state_payload["current_highest_team"],
            "amount": amount,
            "timer_reset": True,
        },
    )
    await manager.broadcast("auction_state", state_payload)
    return {"ok": True}


async def _auto_sell():
    event_name = None
    event_payload = None
    autopilot = False
    state_payload = None

    async with _auction_lock:
        with Session(engine) as session:
            cfg = _get_config(session)
            if cfg.current_player_id is None:
                return

            player = session.get(Player, cfg.current_player_id)
            if player is None:
                return

            if cfg.current_highest_team_id is None or cfg.current_highest_bid is None:
                player.status = PlayerStatus.unsold
                session.add(player)
                event_name = "player_unsold"
                event_payload = _player_dict(player)
            else:
                team = session.get(Team, cfg.current_highest_team_id)
                if team is None or team.budget_remaining < cfg.current_highest_bid:
                    player.status = PlayerStatus.unsold
                    session.add(player)
                    event_name = "player_unsold"
                    event_payload = _player_dict(player)
                else:
                    player.status = PlayerStatus.sold
                    player.sold_to_team_id = cfg.current_highest_team_id
                    player.sold_price = cfg.current_highest_bid
                    team.budget_remaining -= cfg.current_highest_bid
                    session.add(player)
                    session.add(team)
                    event_name = "player_sold"
                    event_payload = {
                        "player": _player_dict(player),
                        "team": _team_dict(team),
                        "price": cfg.current_highest_bid,
                    }

            session.commit()
            autopilot = bool(cfg.autopilot)
            state_payload = _full_state(session)

    if event_name is not None and event_payload is not None:
        await manager.broadcast(event_name, event_payload)
    if state_payload is not None:
        await manager.broadcast("auction_state", state_payload)

    if autopilot:
        await asyncio.sleep(3)
        await _load_next_player()


async def admin_mark_sold():
    _cancel_timer()
    await _auto_sell()


async def admin_mark_unsold():
    _cancel_timer()
    autopilot = False
    state_payload = None
    payload = None

    async with _auction_lock:
        with Session(engine) as session:
            cfg = _get_config(session)
            if cfg.current_player_id is None:
                return
            player = session.get(Player, cfg.current_player_id)
            if player is None:
                return
            player.status = PlayerStatus.unsold
            session.add(player)
            session.commit()

            payload = _player_dict(player)
            autopilot = bool(cfg.autopilot)
            state_payload = _full_state(session)

    if payload is not None:
        await manager.broadcast("player_unsold", payload)
    if state_payload is not None:
        await manager.broadcast("auction_state", state_payload)

    if autopilot:
        await asyncio.sleep(2)
        await _load_next_player()


async def admin_next_player():
    _cancel_timer()
    await _load_next_player()


async def set_autopilot(enabled: bool):
    async with _auction_lock:
        with Session(engine) as session:
            cfg = _get_config(session)
            cfg.autopilot = enabled
            session.add(cfg)
            session.commit()
    await manager.broadcast("autopilot_changed", {"autopilot": enabled})


def get_timer_remaining() -> int:
    return _timer_remaining
