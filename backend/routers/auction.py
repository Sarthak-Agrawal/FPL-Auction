from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlmodel import Session
from pydantic import BaseModel

from auth import require_admin, verify_admin_token
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
async def start_auction(
    session: Session = Depends(get_session),
    _: bool = Depends(require_admin),
):
    cfg = session.get(AuctionConfig, 1)
    if cfg is None:
        raise HTTPException(400, "Auction not configured")
    if cfg.status not in (AuctionStatus.setup, AuctionStatus.paused):
        raise HTTPException(400, f"Auction already in state: {cfg.status}")
    await engine.start_auction()
    return {"ok": True}


@router.post("/auction/next")
async def next_player(_: bool = Depends(require_admin)):
    await engine.admin_next_player()
    return {"ok": True}


@router.post("/auction/sold")
async def mark_sold(_: bool = Depends(require_admin)):
    await engine.admin_mark_sold()
    return {"ok": True}


@router.post("/auction/unsold")
async def mark_unsold(_: bool = Depends(require_admin)):
    await engine.admin_mark_unsold()
    return {"ok": True}


@router.post("/auction/autopilot")
async def set_autopilot(body: AutopilotBody, _: bool = Depends(require_admin)):
    await engine.set_autopilot(body.enabled)
    return {"ok": True, "autopilot": body.enabled}


@router.post("/auction/timer/disable")
async def disable_timer_for_current_player(_: bool = Depends(require_admin)):
    result = await engine.admin_disable_timer_for_current_player()
    if not result.get("ok"):
        raise HTTPException(400, result.get("error", "Could not disable timer"))
    return result


@router.post("/auction/timer/enable")
async def enable_timer_for_current_player(_: bool = Depends(require_admin)):
    result = await engine.admin_enable_timer_for_current_player()
    if not result.get("ok"):
        raise HTTPException(400, result.get("error", "Could not enable timer"))
    return result


@router.get("/auction/state")
def get_state(session: Session = Depends(get_session)):
    from auction_engine import _full_state
    return _full_state(session)


# ---------- WebSocket ----------

@router.websocket("/ws/{team_id}")
async def websocket_endpoint(websocket: WebSocket, team_id: str):
    token = websocket.query_params.get("token")
    is_admin = verify_admin_token(token) if token else False

    await manager.connect(websocket, team_id)
    try:
        # Send current state on connect
        with Session(engine.engine) as session:
            from auction_engine import _full_state
            state = _full_state(session)
        await websocket.send_json({"event": "auction_state", "data": state})

        while True:
            data = await websocket.receive_json()
            event = data.get("event")

            if event == "place_bid":
                if not team_id.isdigit():
                    await websocket.send_json(
                        {"event": "bid_error", "data": {"ok": False, "error": "Invalid bidder identity"}}
                    )
                    continue

                try:
                    amount = float(data["amount"])
                except (KeyError, TypeError, ValueError):
                    await websocket.send_json(
                        {"event": "bid_error", "data": {"ok": False, "error": "Invalid bid amount"}}
                    )
                    continue

                result = await engine.place_bid(int(team_id), amount)
                if not result["ok"]:
                    await websocket.send_json({"event": "bid_error", "data": result})

            elif event in {
                "admin_next",
                "admin_sold",
                "admin_unsold",
                "admin_toggle_autopilot",
                "admin_disable_timer",
                "admin_enable_timer",
            }:
                if not is_admin:
                    await websocket.send_json(
                        {"event": "auth_error", "data": {"ok": False, "error": "Admin authentication required"}}
                    )
                    continue

                if event == "admin_next":
                    await engine.admin_next_player()
                elif event == "admin_sold":
                    await engine.admin_mark_sold()
                elif event == "admin_unsold":
                    await engine.admin_mark_unsold()
                elif event == "admin_toggle_autopilot":
                    await engine.set_autopilot(bool(data.get("enabled", False)))
                elif event == "admin_disable_timer":
                    result = await engine.admin_disable_timer_for_current_player()
                    if not result.get("ok"):
                        await websocket.send_json({"event": "error", "data": result})
                elif event == "admin_enable_timer":
                    result = await engine.admin_enable_timer_for_current_player()
                    if not result.get("ok"):
                        await websocket.send_json({"event": "error", "data": result})

            else:
                await websocket.send_json(
                    {"event": "error", "data": {"ok": False, "error": f"Unknown event '{event}'"}}
                )

    except WebSocketDisconnect:
        manager.disconnect(team_id)
