"""
Authentication and User Management Endpoints.
"""

import logging
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.core.config import settings
from backend.app.core.security import verify_password, get_password_hash, create_access_token
from backend.app.core.auth import get_current_user, get_optional_current_user
from backend.app.models.database import get_db, User
from backend.app.schemas.auth import LoginRequest, TokenResponse, UserCreate, UserResponse
from backend.app.services.audit.logger import audit_logger, AuditAction, AuditResourceType

logger = logging.getLogger("app.api.auth")
auth_router = APIRouter(prefix="/auth", tags=["Authentication & Access Control"])


@auth_router.post("/login", response_model=TokenResponse)
async def login(
    req: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticates an investigator or supervisor with username and password.
    Returns a JWT access token and records an immutable audit log entry.
    """
    stmt = select(User).where(User.username == req.username)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    ip_addr = request.client.host if request.client else None

    if not user or not verify_password(req.password, user.hashed_password):
        # Log failed attempt
        await audit_logger.log_event(
            action=AuditAction.AUTH_LOGIN,
            resource_type=AuditResourceType.AUTH,
            username=req.username,
            details={"status": "failed", "reason": "invalid_credentials"},
            ip_address=ip_addr,
            db=db
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    # Issue token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token = create_access_token(
        data={"sub": user.username, "role": user.role, "user_id": user.id},
        expires_delta=access_token_expires
    )

    # Log successful login
    await audit_logger.log_event(
        action=AuditAction.AUTH_LOGIN,
        resource_type=AuditResourceType.AUTH,
        user_id=user.id,
        username=user.username,
        details={"status": "success", "role": user.role},
        ip_address=ip_addr,
        db=db
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        user=UserResponse.model_validate(user)
    )


@auth_router.post("/register", response_model=UserResponse)
async def register_user(
    req: UserCreate,
    request: Request,
    current_user: User = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Registers a new investigator account.
    If registering a 'supervisor', caller must already be a supervisor.
    """
    # Verify username uniqueness
    stmt = select(User).where(User.username == req.username)
    existing_user = (await db.execute(stmt)).scalar_one_or_none()
    if existing_user:
        raise HTTPException(status_code=400, detail=f"Username '{req.username}' is already taken.")

    # Verify email uniqueness
    stmt_email = select(User).where(User.email == req.email)
    existing_email = (await db.execute(stmt_email)).scalar_one_or_none()
    if existing_email:
        raise HTTPException(status_code=400, detail=f"Email '{req.email}' is already registered.")

    # Only supervisors can create other supervisors
    assigned_role = req.role.lower()
    if assigned_role not in ["investigator", "supervisor"]:
        assigned_role = "investigator"

    if assigned_role == "supervisor":
        if not current_user or current_user.role != "supervisor":
            # If no users exist yet in DB, allow initial supervisor bootstrap
            from sqlalchemy import func
            total_users = await db.scalar(select(func.count(User.id))) or 0
            if total_users > 0:
                raise HTTPException(
                    status_code=403,
                    detail="Only existing supervisors can provision new supervisor accounts."
                )

    new_user = User(
        username=req.username,
        email=req.email,
        hashed_password=get_password_hash(req.password),
        full_name=req.full_name,
        role=assigned_role,
        is_active=True
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    ip_addr = request.client.host if request.client else None
    await audit_logger.log_event(
        action=AuditAction.USER_CREATE,
        resource_type=AuditResourceType.USER,
        resource_id=str(new_user.id),
        user_id=current_user.id if current_user else new_user.id,
        username=current_user.username if current_user else new_user.username,
        details={"created_username": new_user.username, "role": new_user.role},
        ip_address=ip_addr,
        db=db
    )

    return UserResponse.model_validate(new_user)


@auth_router.get("/me", response_model=UserResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user)
):
    """Returns the authenticated investigator/supervisor user profile."""
    return UserResponse.model_validate(current_user)
