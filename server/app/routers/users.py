"""The logged-in user's own profile: view, rename, change password, delete account."""
from fastapi import APIRouter, Depends, HTTPException, Response, status

from .. import db
from ..deps import get_current_user
from ..schemas import ChangePasswordIn, UpdateMeIn
from ..security import hash_password, verify_password
from ..serialize import user_out

router = APIRouter(prefix="/api/users/me", tags=["users"])


@router.get("")
def get_me(user: dict = Depends(get_current_user)):
    return user_out(user)


@router.patch("")
def update_me(body: UpdateMeIn, user: dict = Depends(get_current_user)):
    db.users.update_one({"_id": user["_id"]}, {"$set": {"display_name": body.display_name}})
    user["display_name"] = body.display_name
    return user_out(user)


@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(body: ChangePasswordIn, user: dict = Depends(get_current_user)):
    if not verify_password(body.current_password, user["password_hash"]):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is wrong")
    # token_version + 1 -> every token issued before this moment stops working.
    db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": hash_password(body.new_password)}, "$inc": {"token_version": 1}},
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(user: dict = Depends(get_current_user)):
    # Delete everything that belongs to the user, then the user.
    db.sessions.delete_many({"user_id": user["_id"]})
    db.content.delete_many({"user_id": user["_id"]})
    db.users.delete_one({"_id": user["_id"]})
    return Response(status_code=status.HTTP_204_NO_CONTENT)
