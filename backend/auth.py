from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time

from fastapi import Depends, Header, HTTPException
from sqlmodel import Session

from models import AuctionConfig, get_session

JWT_SECRET = os.getenv("FPL_JWT_SECRET", "change-me-in-production")
TOKEN_EXPIRE_HOURS = int(os.getenv("FPL_ADMIN_TOKEN_HOURS", "12"))
PASSWORD_ITERATIONS = int(os.getenv("FPL_PASSWORD_ITERATIONS", "200000"))


def _b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")


def _b64decode(raw: str) -> bytes:
    padding = "=" * (-len(raw) % 4)
    return base64.urlsafe_b64decode((raw + padding).encode("utf-8"))


def create_admin_token() -> str:
    payload = {"role": "admin", "exp": int(time.time()) + (TOKEN_EXPIRE_HOURS * 3600)}
    payload_part = _b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = hmac.new(
        JWT_SECRET.encode("utf-8"),
        payload_part.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return f"{payload_part}.{_b64encode(signature)}"


def hash_admin_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PASSWORD_ITERATIONS,
    )
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${salt}${_b64encode(digest)}"


def verify_admin_password(password: str, encoded_password: str) -> bool:
    try:
        algorithm, iterations_raw, salt, digest = encoded_password.split("$", 3)
        iterations = int(iterations_raw)
    except ValueError:
        return False

    if algorithm != "pbkdf2_sha256" or iterations <= 0:
        return False

    calculated = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations,
    )
    return hmac.compare_digest(digest, _b64encode(calculated))


def verify_admin_token(token: str) -> bool:
    if not token:
        return False

    try:
        payload_part, signature_part = token.split(".", 1)
    except ValueError:
        return False

    expected_signature = _b64encode(
        hmac.new(
            JWT_SECRET.encode("utf-8"),
            payload_part.encode("utf-8"),
            hashlib.sha256,
        ).digest()
    )
    if not hmac.compare_digest(signature_part, expected_signature):
        return False

    try:
        payload = json.loads(_b64decode(payload_part).decode("utf-8"))
        exp = int(payload.get("exp", 0))
    except (ValueError, json.JSONDecodeError, TypeError):
        return False

    if payload.get("role") != "admin":
        return False
    return exp > int(time.time())


def require_admin(
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
) -> bool:
    cfg = session.get(AuctionConfig, 1)
    if cfg is None or cfg.admin_password_hash is None:
        raise HTTPException(status_code=400, detail="Auction is not configured")

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing admin bearer token")

    token = authorization.split(" ", 1)[1].strip()
    if not verify_admin_token(token):
        raise HTTPException(status_code=403, detail="Invalid or expired admin token")

    return True
