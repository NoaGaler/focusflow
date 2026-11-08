"""get_current_user: runs before every protected route and finds the user from the token."""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from . import db
from .security import decode_token

bearer = HTTPBearer(auto_error=False)

NOT_LOGGED_IN = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="You are not logged in, or your login has expired",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_token_payload(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    if creds is None or creds.scheme.lower() != "bearer":
        raise NOT_LOGGED_IN
    payload = decode_token(creds.credentials)
    if payload is None:
        raise NOT_LOGGED_IN
    if db.revoked_tokens.find_one({"_id": payload["jti"]}):  # logged out
        raise NOT_LOGGED_IN
    return payload


def get_current_user(payload: dict = Depends(get_token_payload)) -> dict:
    user_id = db.to_object_id(payload["sub"])
    user = db.users.find_one({"_id": user_id}) if user_id else None
    # The user was deleted, or changed the password after this token was issued.
    if user is None or user.get("token_version", 0) != payload["ver"]:
        raise NOT_LOGGED_IN
    return user
