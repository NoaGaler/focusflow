"""All settings come from environment variables (never hard-coded secrets).

Locally they come from the .env file through docker compose.
In the cloud they come from Cloud Run, and the secret ones from Secret Manager.
"""
import logging
import os
import secrets

log = logging.getLogger("focusflow")

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "focusflow")

# Secret used to sign login tokens (JWT).
# If it is missing we generate a random one, so the site still works locally,
# but then every restart logs everyone out, and two server instances would not
# accept each other's tokens. In the cloud JWT_SECRET MUST be set.
JWT_SECRET = os.getenv("JWT_SECRET") or ""
if len(JWT_SECRET) < 32:
    if JWT_SECRET:
        log.warning("JWT_SECRET is shorter than 32 characters - using a random one instead")
    else:
        log.warning("JWT_SECRET is not set - using a random secret (fine for local runs only)")
    JWT_SECRET = secrets.token_urlsafe(48)

JWT_ALGORITHM = "HS256"
TOKEN_MINUTES = int(os.getenv("TOKEN_MINUTES", "60"))

# Brute-force protection: after this many wrong passwords for one email,
# login is blocked for LOGIN_LOCK_MINUTES.
LOGIN_MAX_FAILURES = 5
LOGIN_LOCK_MINUTES = 15
