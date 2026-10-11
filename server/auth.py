import hashlib
import hmac
import json
import logging
from datetime import datetime
from urllib.parse import parse_qs

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.config import BOT_TOKEN

logger = logging.getLogger(__name__)


def validate_init_data(init_data: str) -> dict | None:
    """Validate Telegram Mini App initData using HMAC-SHA256.

    Returns parsed user data dict or None if validation fails.
    """
    if not init_data or not BOT_TOKEN:
        return None

    try:
        parsed = parse_qs(init_data)
        if any(len(values) != 1 for values in parsed.values()):
            return None
        received_hash = parsed.pop("hash", [None])[0]
        if not received_hash:
            return None

        data_check_pairs = sorted(
            f"{k}={v[0]}" for k, v in parsed.items()
        )
        data_check_string = "\n".join(data_check_pairs)

        secret_key = hmac.new(
            b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256
        ).digest()
        computed_hash = hmac.new(
            secret_key, data_check_string.encode(), hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(computed_hash, received_hash):
            return None

        raw_auth_date = parsed.get("auth_date", [""])[0]
        if not raw_auth_date.isdecimal():
            return None
        age_seconds = datetime.now().timestamp() - int(raw_auth_date)
        if age_seconds > 86400 or age_seconds < -300:
            return None

        user_str = parsed.get("user", [None])[0]
        if user_str:
            return json.loads(user_str)
        return None
    except Exception:
        return None


async def get_or_create_user(
    db: AsyncSession,
    telegram_id: int | None = None,
    session_id: str | None = None,
    display_name: str = "Unknown",
) -> "User":
    """Look up a user by telegram_id or session_id, creating one if not found."""
    from server.models.db_models import User

    user = None

    if telegram_id is not None:
        result = await db.execute(select(User).where(User.telegram_id == telegram_id))
        user = result.scalar_one_or_none()
        if user:
            if user.display_name != display_name and display_name != "Unknown":
                user.display_name = display_name
                user.updated_at = datetime.utcnow()
                await db.commit()
            return user
    elif session_id:
        result = await db.execute(select(User).where(User.session_id == session_id))
        user = result.scalar_one_or_none()
        if user:
            if user.display_name != display_name and display_name != "Unknown":
                user.display_name = display_name
                user.updated_at = datetime.utcnow()
                await db.commit()
            return user

    # Create new user
    user = User(
        telegram_id=telegram_id,
        session_id=session_id if telegram_id is None else None,
        display_name=display_name,
        role="user",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info(f"Created new user: id={user.id}, telegram_id={telegram_id}, session_id={session_id}, name={display_name}")
    return user
