from sqlalchemy import (
    Column, Integer, String, Text, Numeric,
    Boolean, ForeignKey, DateTime
)
from sqlalchemy.orm import relationship
from datetime import datetime

from db import Base

class User(Base):
    __tablename__ = 'users'
    user_id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    password = Column(String(128), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    is_admin   = Column(Boolean, nullable=False, default=False)

    tags = relationship(
    'Tag', back_populates='owner', cascade='all, delete-orphan'
)
    
class Tag(Base):
    __tablename__ = 'items'
    tag_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.user_id'), nullable=False)
    tag_name = Column(String(100), nullable=False)

    owner = relationship('User', back_populates='tags')