"""
Pydantic schemas for authentication and user management.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class LoginRequest(BaseModel):
    username: str = Field(..., description="Username or email")
    password: str = Field(..., description="Plaintext password")


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr = Field(...)
    full_name: str = Field(..., min_length=1, max_length=100)
    role: str = Field(default="investigator", description="Role: 'investigator' or 'supervisor'")


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, description="Password (min 6 characters)")


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int
    user: UserResponse
