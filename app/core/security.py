from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import settings


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def _create_token(subject: str, token_type: str, expire_minutes: int) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)
    payload = {"sub": subject, "type": token_type, "exp": expires_at}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(subject: str) -> str:
    return _create_token(subject, "access", settings.jwt_expire_minutes)


def create_refresh_token(subject: str) -> str:
    return _create_token(subject, "refresh", settings.jwt_refresh_expire_minutes)


def decode_access_token(token: str) -> dict:
    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("Not an access token")
    return payload


def decode_refresh_token(token: str) -> dict:
    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    if payload.get("type") != "refresh":
        raise jwt.InvalidTokenError("Not a refresh token")
    return payload
