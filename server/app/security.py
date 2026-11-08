"""Passwords (bcrypt) and login tokens (JWT)."""
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from . import config


def hash_password(password: str) -> str:
    # bcrypt creates a new random salt for every password and stores it inside the hash.
    # cost 12 = 2^12 rounds, slow on purpose so guessing is expensive.
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


# Used when the email does not exist, so a wrong email takes as long as a wrong
# password and an attacker cannot tell which emails are registered.
DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


def create_token(user_id: str, token_version: int) -> tuple[str, int]:
    now = datetime.now(timezone.utc)
    expires_in = config.TOKEN_MINUTES * 60
    payload = {
        "sub": user_id,                 # who the token belongs to
        "ver": token_version,           # changes on password change -> old tokens die
        "jti": secrets.token_hex(16),   # unique id, so one token can be revoked on logout
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM), expires_in


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(
            token,
            config.JWT_SECRET,
            algorithms=[config.JWT_ALGORITHM],
            options={"require": ["sub", "exp", "jti", "ver"]},
        )
    except jwt.PyJWTError:
        return None
