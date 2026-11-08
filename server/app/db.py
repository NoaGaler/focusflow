"""MongoDB connection and indexes."""
from bson import ObjectId
from bson.errors import InvalidId
from pymongo import ASCENDING, DESCENDING, MongoClient

from . import config

client = MongoClient(config.MONGODB_URI, serverSelectionTimeoutMS=5000, tz_aware=True)
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
