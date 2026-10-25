# db.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from typing import Generator

from config import DATABASE_URL, SQL_ECHO

# SQLite needs this to be used from FastAPI's worker threads
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

# SQLAlchemy engine and session factory
engine = create_engine(DATABASE_URL, echo=SQL_ECHO, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

# Base class for ORM models
Base = declarative_base()

# Dependency for FastAPI routes
def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
