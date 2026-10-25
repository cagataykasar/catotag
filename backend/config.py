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

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./catotag.db")
SQL_ECHO = os.getenv("SQL_ECHO", "false").lower() == "true"

ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]
