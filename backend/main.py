from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

import models  # noqa: F401  (registers tables on Base.metadata)
from auth import router as auth_router
from config import CORS_ORIGIN_REGEX, CORS_ORIGINS, ENABLE_DOCS
from db import Base, engine
from routers import user_router
from sync import router as sync_router

# Create missing tables on startup (no migrations yet)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="catotag API",
    description="Accounts and cloud backup for catotag",
    version="1.1.0",
    docs_url="/docs" if ENABLE_DOCS else None,
    redoc_url=None,
    openapi_url="/openapi.json" if ENABLE_DOCS else None,
)

# Bearer tokens, not cookies: no credentials needed for CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "DENY"
    # Responses carry private data: never cache them
    response.headers["Cache-Control"] = "no-store"
    return response

app.include_router(auth_router)
app.include_router(user_router)
app.include_router(sync_router)

@app.get("/")
def read_root():
    return {"message": "catotag API is running"}
