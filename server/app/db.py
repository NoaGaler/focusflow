"""MongoDB connection and indexes."""
import logging
import re

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import ASCENDING, DESCENDING, MongoClient

from . import config

log = logging.getLogger("focusflow")

def _redact(text: str) -> str:
    """Hide the user and password of a MongoDB address before writing it to a log."""
    return re.sub(r"//[^@/\s]*@", "//***:***@", text)


try:
    client = MongoClient(config.MONGODB_URI, serverSelectionTimeoutMS=5000, tz_aware=True)
except Exception as e:  # e.g. a malformed MONGODB_URI, or its DNS name cannot be resolved
    # Do not crash: the server still starts (so /health answers and the logs explain the problem).
    log.error("MONGODB_URI cannot be used (%s: %s). Check the secret's value.", type(e).__name__, _redact(str(e)))
    client = MongoClient("mongodb://mongodb-uri-is-invalid:27017", serverSelectionTimeoutMS=2000,
                         connect=False, tz_aware=True)
db = client[config.DB_NAME]

users = db["users"]
content = db["content"]
sessions = db["sessions"]
revoked_tokens = db["revoked_tokens"]   # logged-out tokens (until they expire)
login_failures = db["login_failures"]   # wrong-password attempts (brute-force protection)


def create_indexes() -> None:
    users.create_index("email", unique=True)
    content.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    sessions.create_index([("user_id", ASCENDING), ("started_at", DESCENDING)])
    # TTL indexes: MongoDB deletes these documents by itself when "expires_at" passes.
    revoked_tokens.create_index("expires_at", expireAfterSeconds=0)
    login_failures.create_index("expires_at", expireAfterSeconds=0)
    login_failures.create_index("email")


def to_object_id(value: str) -> ObjectId | None:
    """Turn an id from the URL into an ObjectId. A bad id returns None (-> 404)."""
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        return None
