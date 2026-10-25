import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jwt import InvalidTokenError
from sqlalchemy.orm import Session

from config import ACCESS_TOKEN_EXPIRE_MINUTES, SECRET_KEY
from db import get_db
from models import User
from pydantic import BaseModel

# --- Configuration ---
ALGORITHM = "HS256"

# Login throttling: after this many failures for one IP + username, refuse for the window
MAX_FAILED_LOGINS = 5
FAILED_LOGIN_WINDOW_SECONDS = 15 * 60

# --- Password hashing ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/token")

# --- Utility functions ---
def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())
    except ValueError:
        return False

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

# Checked against when the username does not exist, so response time does not reveal valid usernames
_DUMMY_HASH = get_password_hash("catotag-dummy-password")

def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    user = db.query(User).filter(User.username == username).first()
    if not user:
        verify_password(password, _DUMMY_HASH)
        return None
    if not verify_password(password, user.password):
        return None
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# In-memory (per process) record of recent failed logins: key -> timestamps
_failed_logins: dict = {}

def _login_key(request: Request, username: str) -> str:
    host = request.client.host if request.client else "unknown"
    return f"{host}:{username.lower()}"

def _recent_failures(key: str) -> list:
    now = time.monotonic()
    recent = [t for t in _failed_logins.get(key, []) if now - t < FAILED_LOGIN_WINDOW_SECONDS]
    _failed_logins[key] = recent
    return recent


# --- Token schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

# --- Router ---
router = APIRouter(tags=["Auth"], prefix="/api")

@router.post("/token", response_model=Token)
async def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    key = _login_key(request, form_data.username)
    if len(_recent_failures(key)) >= MAX_FAILED_LOGINS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Try again in 15 minutes.",
        )
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        _failed_logins[key].append(time.monotonic())
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    _failed_logins.pop(key, None)
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

# --- Dependencies ---
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except InvalidTokenError:
        raise credentials_exception
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    # Add extra checks (e.g., is_active flag) here if needed
    return current_user


def get_current_admin_user(current_user: User = Depends(get_current_active_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admins only")
    return current_user
