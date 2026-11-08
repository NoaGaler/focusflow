"""Register, login, logout."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pymongo.errors import DuplicateKeyError

from .. import config, db
from ..deps import get_token_payload
from ..schemas import LoginIn, RegisterIn
from ..security import DUMMY_HASH, create_token, hash_password, verify_password
from ..serialize import user_out

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn):
    user = {
        "email": body.email.lower(),          # emails are unique regardless of case
        "password_hash": hash_password(body.password),
        "display_name": body.display_name,
        "token_version": 0,
        "created_at": datetime.now(timezone.utc),
    }
    try:
        result = db.users.insert_one(user)
    except DuplicateKeyError:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    user["_id"] = result.inserted_id
    return user_out(user)


@router.post("/login")
def login(body: LoginIn):
    email = body.email.lower()
    now = datetime.now(timezone.utc)

    failures = db.login_failures.count_documents({"email": email, "expires_at": {"$gt": now}})
    if failures >= config.LOGIN_MAX_FAILURES:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Too many wrong attempts. Please wait {config.LOGIN_LOCK_MINUTES} minutes and try again",
        )

    user = db.users.find_one({"email": email})
    # Always run bcrypt, even when the email does not exist (same timing either way).
    ok = verify_password(body.password, user["password_hash"] if user else DUMMY_HASH)
    if not user or not ok:
        db.login_failures.insert_one(
            {"email": email, "expires_at": now + timedelta(minutes=config.LOGIN_LOCK_MINUTES)}
        )
        # Same message for "no such email" and "wrong password".
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong email or password")

    db.login_failures.delete_many({"email": email})
    token, expires_in = create_token(str(user["_id"]), user.get("token_version", 0))
    return {"access_token": token, "token_type": "bearer", "expires_in": expires_in}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(payload: dict = Depends(get_token_payload)):
    # Remember this token as revoked until it would have expired anyway.
    expires_at = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    db.revoked_tokens.update_one(
        {"_id": payload["jti"]}, {"$set": {"expires_at": expires_at}}, upsert=True
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
