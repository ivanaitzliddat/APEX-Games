from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.database import get_db
from server.dependencies import get_current_user, require_role
from server.models.db_models import User

router = APIRouter()


class UserResponse(BaseModel):
    id: int
    display_name: str
    role: str
    telegram_id: Optional[int] = None

    class Config:
        from_attributes = True


class UpdateRoleRequest(BaseModel):
    role: str


@router.get("/me")
async def get_me(user: Optional[User] = Depends(get_current_user)):
    """Get the current authenticated user's info."""
    if user is None:
        return {"user": None}
    return {
        "user": {
            "id": user.id,
            "display_name": user.display_name,
            "role": user.role,
            "telegram_id": user.telegram_id,
        }
    }


@router.get("/users")
async def list_users(
    user: User = Depends(require_role("owner")),
    db: AsyncSession = Depends(get_db),
):
    """List all users (owner only)."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return {
        "users": [
            {
                "id": u.id,
                "display_name": u.display_name,
                "role": u.role,
                "telegram_id": u.telegram_id,
                "session_id": u.session_id,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ]
    }


@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: int,
    req: UpdateRoleRequest,
    user: User = Depends(require_role("owner")),
    db: AsyncSession = Depends(get_db),
):
    """Update a user's role (owner only)."""
    valid_roles = {"guest", "user", "admin", "owner"}
    if req.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}")

    result = await db.execute(select(User).where(User.id == user_id))
    target_user = result.scalar_one_or_none()
    if target_user is None:
        raise HTTPException(status_code=404, detail="User not found")

    target_user.role = req.role
    await db.commit()

    return {
        "user": {
            "id": target_user.id,
            "display_name": target_user.display_name,
            "role": target_user.role,
        }
    }
