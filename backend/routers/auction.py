from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlmodel import Session, select
from pydantic import BaseModel

from models import AuctionConfig, AuctionStatus, get_session
from ws_manager import manager
import auction_engine as engine

router = APIRouter(tags=["auction"])


# ---------- Admin REST ----------

class BidBody(BaseModel):
    team_id: int
    amount: float


class AutopilotBody(BaseModel):
    enabled: bool


@router.post("/auction/start")
async def start_auction(session: Session = Depends(get_session)):
    cfg = session.get(AuctionConfig, 1)
    if cfg is None:
        raise HTTPException(400, "Auction not configured")
    if cfg.status not in (AuctionStatus.setup, AuctionStatus.paused):
        raise HTTPException(400, f"Auction already in state: {cfg.status}")
    await engine.start_auction()
    return {"ok": True}


@router.post("/auction/next")
async def next_player():
    await engine.admin_next_player()
    return {"ok": True}


@router.post("/auction/sold")
async def mark_sold():
    await engine.admin_mark_sold()
    return {"ok": True}


@router.post("/auction/unsold")
async def mark_unsold():
    await engine.admin_mark_unsold()
    return {"ok": True}


@router.post("/auction/autopilot")
async def set_autopilot(body: AutopilotBody):
    await engine.set_autopilot(body.enabled)
    return {"ok": True, "autopilot": body.enabled}


@router.get("/auction/state")
def get_state(session: Session = Depends(get_session)):
    from auction_engine import _full_state
    return _full_state(session)


# ---------- WebSocket ----------

@router.websocket("/ws/{team_id}")
async def websocket_endpoint(websocket: WebSocket, team_id: str):
    await manager.connect(websocket, team_id)
    try:
        # Send current state on connect
        with Session(engine.engine) as session:
            from auction_engine import _full_state
            state = _full_state(session)
            state["timer_remaining"] = engine.get_timer_remaining()
        await websocket.send_json({"event": "auction_state", "data": state})

        while True:
            data = await websocket.receive_json()
            event = data.get("event")

            if event == "place_bid":
                result = await engine.place_bid(data["team_id"], data["amount"])
                if not result["ok"]:
                    await websocket.send_json({"event": "bid_error", "data": result})

            elif event == "admin_next":
                await engine.admin_next_player()

            elif event == "admin_sold":
                await engine.admin_mark_sold()

            elif event == "admin_unsold":
                await engine.admin_mark_unsold()

            elif event == "admin_toggle_autopilot":
                await engine.set_autopilot(data.get("enabled", False))

    except WebSocketDisconnect:
        manager.disconnect(team_id)
