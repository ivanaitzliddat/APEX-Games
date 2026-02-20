import logging
from typing import Optional

from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from server.database import get_db
from server.auth import validate_init_data, get_or_create_user
from server.models.db_models import User

logger = logging.getLogger(__name__)


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Extract and authenticate the current user from request headers.

    Returns User object or None for guests.
    """
    init_data = request.headers.get("X-Telegram-InitData", "")
    session_id = request.headers.get("X-Session-Id", "")
    player_name = request.headers.get("X-Player-Name", "")

    if init_data:
        user_data = validate_init_data(init_data)
        if user_data:
            telegram_id = user_data.get("id")
            name = (
                (user_data.get("first_name", "") + " " + user_data.get("last_name", "")).strip()
                or "Unknown"
            )
            return await get_or_create_user(db, telegram_id=telegram_id, display_name=name)
    elif session_id:
        name = player_name or "Unknown"
        return await get_or_create_user(db, session_id=session_id, display_name=name)

    return None


def require_role(*roles: str):
    """FastAPI dependency factory that enforces role-based access control."""
    async def checker(user: Optional[User] = Depends(get_current_user)) -> User:
        if user is None:
            raise HTTPException(status_code=401, detail="Authentication required")
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return checker
