"""FocusFlow API server (FastAPI).

Run locally:  uvicorn app.main:app --port 8000
Interactive docs: /api/docs
"""
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import db
from .routers import auth, content, sessions, users

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("focusflow")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        db.create_indexes()
        log.info("Connected to MongoDB, indexes are ready")
    except Exception as e:  # the site still starts; /health keeps answering
        log.error("Could not reach MongoDB at startup: %s", type(e).__name__)
    yield


app = FastAPI(
    title="FocusFlow API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)

# Normally the client and server share one domain, so CORS is not needed at all.
# CORS_ORIGINS (comma separated) is only for running them on different addresses.
origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
if origins:
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False,
                       allow_methods=["*"], allow_headers=["Authorization", "Content-Type"])


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    return response


# ---- Every error is {"detail": "<readable message>"} ----

@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request, exc: StarletteHTTPException):
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code, headers=getattr(exc, "headers", None))


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    messages = []
    for err in exc.errors():
        msg = str(err.get("msg", "Invalid value")).removeprefix("Value error, ")
        field = ".".join(str(p) for p in err.get("loc", []) if p not in ("body", "query", "path"))
        if err.get("type") == "missing":
            msg = "is required"
        messages.append(f"{field}: {msg}" if field and not msg[0].isupper() else msg)
    return JSONResponse({"detail": "; ".join(dict.fromkeys(messages)) or "Invalid input"}, status_code=422)


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception):
    log.exception("Unexpected error on %s %s", request.method, request.url.path)
    return JSONResponse({"detail": "Something went wrong on the server. Please try again"}, status_code=500)


@app.get("/health", tags=["health"])
@app.get("/api/health", include_in_schema=False)
def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(content.router)
app.include_router(sessions.router)
