"""Turn MongoDB documents into JSON for the client.

Only the fields listed here are ever returned, so the password hash can never leak.
Dates are returned as ISO 8601 in UTC.
"""
from datetime import datetime, timezone


def iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def user_out(u: dict) -> dict:
    return {
        "id": str(u["_id"]),
        "email": u["email"],
        "display_name": u["display_name"],
        "created_at": iso(u["created_at"]),
    }


def content_out(c: dict) -> dict:
    out = {
        "id": str(c["_id"]),
        "type": c["type"],
        "title": c["title"],
        "source": c["source"],
        "created_at": iso(c["created_at"]),
    }
    if c.get("video_id"):
        out["video_id"] = c["video_id"]
    return out


def average(readings: list[dict]) -> float | None:
    if not readings:
        return None
    return round(sum(r["score"] for r in readings) / len(readings), 4)


def reading_out(r: dict) -> dict:
    out = {"position": r["position"], "score": r["score"], "created_at": iso(r["created_at"])}
    if r.get("level") is not None:
        out["level"] = r["level"]
    return out


def session_summary(s: dict) -> dict:
    readings = s.get("readings", [])
    return {
        "id": str(s["_id"]),
        "content_id": str(s["content_id"]),
        "content_title": s.get("content_title"),
        "content_type": s.get("content_type"),
        "started_at": iso(s["started_at"]),
        "ended_at": iso(s.get("ended_at")),
        "reading_count": len(readings),
        "average_score": average(readings),
    }


def session_full(s: dict) -> dict:
    out = session_summary(s)
    out["readings"] = [reading_out(r) for r in s.get("readings", [])]
    return out
