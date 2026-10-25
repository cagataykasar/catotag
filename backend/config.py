# config.py
import os
from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env (real environment variables take precedence)
load_dotenv(Path(__file__).with_name(".env"))

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY is not set. Copy backend/.env.example to backend/.env and fill it in."
    )

BASE_DIR = Path(__file__).resolve().parent

def normalize_database_url(url: str) -> str:
    # Hosting providers (Neon, Render, Heroku) hand out postgres:// or postgresql:// URLs;
    # SQLAlchemy needs the driver named explicitly to use psycopg 3
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    # Relative SQLite paths are resolved against backend/, not the directory uvicorn was started from
    if url.startswith("sqlite:///./"):
        return f"sqlite:///{BASE_DIR / url[len('sqlite:///./'):]}"
    return url


DATABASE_URL = normalize_database_url(os.getenv("DATABASE_URL", "sqlite:///./catotag.db"))
SQL_ECHO = os.getenv("SQL_ECHO", "false").lower() == "true"

ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

# Optional regex for extra allowed origins, e.g. phones on the local network during development
CORS_ORIGIN_REGEX = os.getenv("CORS_ORIGIN_REGEX") or None

# Interactive API docs at /docs; turn off in production
ENABLE_DOCS = os.getenv("ENABLE_DOCS", "true").lower() == "true"
