from fastapi import APIRouter, Depends, HTTPException, Response, status

from sqlalchemy.orm import Session

from db import get_db

from auth import get_password_hash, get_current_active_user, verify_password

from models import User

from pydantic import BaseModel, ConfigDict, Field


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_.-]+$")
    # bcrypt only uses the first 72 bytes of a password
    password: str = Field(min_length=8, max_length=72)
    email: str = Field(max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

class UserRead(BaseModel):
    user_id: int
    username: str
    email: str
    is_admin: bool

    model_config = ConfigDict(from_attributes=True)

class PasswordConfirm(BaseModel):
    password: str = Field(max_length=72)


# ROUTERS

user_router = APIRouter(prefix="/users", tags=["Users"])

@user_router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    email = user.email.strip().lower()
    # Ensure email and username are unique
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).filter(User.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    new_user = User(
        username=user.username,
        password=get_password_hash(user.password),
        email=email,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@user_router.get("/me", response_model=UserRead)
def read_current_user(
    current_user: User = Depends(get_current_active_user)
):
    return current_user

@user_router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_current_user(
    body: PasswordConfirm,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Permanently delete the account with all its settings and matches."""
    if not verify_password(body.password, current_user.password):
        raise HTTPException(status_code=403, detail="Incorrect password")
    db.delete(current_user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
