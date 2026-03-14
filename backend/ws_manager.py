from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # team_id (str) -> WebSocket
        self.active: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, team_id: str):
        await websocket.accept()
        self.active[team_id] = websocket
        logger.info("WS connect: %s  (total=%d)", team_id, len(self.active))

    def disconnect(self, team_id: str):
        self.active.pop(team_id, None)
        logger.info("WS disconnect: %s  (total=%d)", team_id, len(self.active))

    async def broadcast(self, event: str, payload: Any):
        dead = []
        for tid, ws in list(self.active.items()):
            try:
                await ws.send_json({"event": event, "data": payload})
            except Exception:
                dead.append(tid)
        for tid in dead:
            self.disconnect(tid)

    async def send_to(self, team_id: str, event: str, payload: Any):
        ws = self.active.get(team_id)
        if ws:
            try:
                await ws.send_json({"event": event, "data": payload})
            except Exception:
                self.disconnect(team_id)


manager = ConnectionManager()
