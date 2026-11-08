"""Watching/reading sessions and their attention readings.

The attention model runs in the browser. The client only sends the result
(position + score) every few seconds; the face landmarks never leave the browser.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from .. import db
from ..deps import get_current_user
from ..schemas import ReadingIn, SessionIn
from ..serialize import reading_out, session_full, session_summary
from .content import find_own_content

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

MAX_READINGS = 3000  # ~8 hours at one reading every 10 seconds

NOT_FOUND = HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")


def find_own_session(session_id: str, user: dict, with_readings: bool = True) -> dict:
    oid = db.to_object_id(session_id)
    projection = None if with_readings else {"readings": 0}
    s = db.sessions.find_one({"_id": oid, "user_id": user["_id"]}, projection) if oid else None
    if s is None:
        raise NOT_FOUND
    return s


@router.post("", status_code=status.HTTP_201_CREATED)
def start_session(body: SessionIn, user: dict = Depends(get_current_user)):
    item = find_own_content(body.content_id, user)  # 404 if not the user's content
    s = {
        "user_id": user["_id"],
        "content_id": item["_id"],
        "content_title": item["title"],
        "content_type": item["type"],
        "started_at": datetime.now(timezone.utc),
        "ended_at": None,
        "readings": [],
    }
    s["_id"] = db.sessions.insert_one(s).inserted_id
    return {"id": str(s["_id"]), "content_id": str(item["_id"]), "started_at": session_summary(s)["started_at"]}


@router.post("/{session_id}/readings", status_code=status.HTTP_201_CREATED)
def add_reading(session_id: str, body: ReadingIn, user: dict = Depends(get_current_user)):
    s = find_own_session(session_id, user, with_readings=False)
    if s.get("ended_at"):
        raise HTTPException(status.HTTP_409_CONFLICT, "This session has already ended")

    reading = {"position": round(body.position, 2), "score": round(body.score, 4),
               "created_at": datetime.now(timezone.utc)}
    if body.level is not None:
        reading["level"] = body.level
    if body.raw_score is not None:
        reading["raw_score"] = round(body.raw_score, 4)

    # Atomic: only adds the reading if the session is still open and not full.
    result = db.sessions.update_one(
        {"_id": s["_id"], "ended_at": None, f"readings.{MAX_READINGS - 1}": {"$exists": False}},
        {"$push": {"readings": reading}},
    )
    if result.modified_count == 0:
        raise HTTPException(status.HTTP_409_CONFLICT, "This session is closed or full")
    return reading_out(reading)


@router.post("/{session_id}/end")
def end_session(session_id: str, user: dict = Depends(get_current_user)):
    s = find_own_session(session_id, user)
    if not s.get("ended_at"):  # ending twice is harmless
        s["ended_at"] = datetime.now(timezone.utc)
        db.sessions.update_one({"_id": s["_id"], "ended_at": None}, {"$set": {"ended_at": s["ended_at"]}})
    return session_summary(s)


@router.get("")
def list_sessions(user: dict = Depends(get_current_user)):
    found = db.sessions.find({"user_id": user["_id"]}).sort("started_at", -1).limit(200)
    return [session_summary(s) for s in found]


@router.get("/{session_id}")
def get_session(session_id: str, user: dict = Depends(get_current_user)):
    return session_full(find_own_session(session_id, user))
