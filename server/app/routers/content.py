"""The user's content library.

Every query filters by user_id taken from the TOKEN (never from the request body),
so a user can only ever see or delete their own items. Someone else's item -> 404,
exactly like an item that does not exist (we don't reveal that it exists).
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status

from .. import db
from ..deps import get_current_user
from ..schemas import ContentIn, youtube_video_id
from ..serialize import content_out

router = APIRouter(prefix="/api/content", tags=["content"])

NOT_FOUND = HTTPException(status.HTTP_404_NOT_FOUND, "Content item not found")


def find_own_content(content_id: str, user: dict) -> dict:
    oid = db.to_object_id(content_id)
    item = db.content.find_one({"_id": oid, "user_id": user["_id"]}) if oid else None
    if item is None:
        raise NOT_FOUND
    return item


@router.post("", status_code=status.HTTP_201_CREATED)
def add_content(body: ContentIn, user: dict = Depends(get_current_user)):
    item = {
        "user_id": user["_id"],
        "type": body.type,
        "title": body.title,
        "source": body.source,
        "created_at": datetime.now(timezone.utc),
    }
    if body.type == "youtube":
        item["video_id"] = youtube_video_id(body.source)
    item["_id"] = db.content.insert_one(item).inserted_id
    return content_out(item)


@router.get("")
def list_content(user: dict = Depends(get_current_user)):
    items = db.content.find({"user_id": user["_id"]}).sort("created_at", -1).limit(500)
    return [content_out(c) for c in items]


@router.get("/{content_id}")
def get_content(content_id: str, user: dict = Depends(get_current_user)):
    return content_out(find_own_content(content_id, user))


@router.delete("/{content_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_content(content_id: str, user: dict = Depends(get_current_user)):
    item = find_own_content(content_id, user)
    db.content.delete_one({"_id": item["_id"]})
    # Sessions keep their copy of the title, so the history still makes sense.
    return Response(status_code=status.HTTP_204_NO_CONTENT)
