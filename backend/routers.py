from fastapi import APIRouter, Depends, HTTPException, Header, status, Query

from sqlalchemy.orm import Session, aliased, joinedload
from sqlalchemy import join, select, or_, and_, desc

from db import get_db

from auth import get_password_hash, get_current_active_user, get_current_admin_user

from models import(User, Tag)

from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional

class UserCreate(BaseModel):
    username: str
    password: str
    email: str

class UserRead(BaseModel):
    user_id: int
    username: str
    email: str
    is_admin: bool
    
    class Config:
        from_attributes = True   # Pydantic v2: use 'from_attributes'

class TagCreate(BaseModel):
    tag_name: str

class TagRead(BaseModel):
    tag_id: int
    user_id: int
    user_name: str          # seller username
    tag_name: str

    class Config:
         from_attributes = True

class TagUpdate(BaseModel):
    tag_name: Optional[str] = Field(None, max_length=50)

    class Config:
        orm_mode = True


# ROUTERS

user_router = APIRouter(prefix="/users", tags=["Users"])

@user_router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    # Hash the password
    hashed_pw = get_password_hash(user.password)
    # Ensure email is unique
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    new_user = User(
        username=user.username,
        password=hashed_pw,
        email=user.email,
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

tag_router = APIRouter(prefix="/tags", tags=["tags"])

@tag_router.post("/", response_model=TagRead, status_code=status.HTTP_201_CREATED)
def create_tag(
    tag: TagCreate,
    db: Session = Depends(get_db),
    current_user: int = Depends(get_current_active_user)
):
    new_tag = tag(
        user_id=current_user.user_id,
        tag_name=tag.tag_name,
    )
    db.add(new_tag)
    db.commit()
    db.refresh(new_tag)

    return new_tag

@tag_router.get("/mine",response_model=List[TagRead],status_code=status.HTTP_200_OK)
def list_my_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return (
        db.query(Tag)
        .filter(Tag.user_id == current_user.user_id)
        .all()
    )