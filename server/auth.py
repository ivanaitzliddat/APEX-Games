import hashlib
import hmac
import json
from urllib.parse import parse_qs

from server.config import BOT_TOKEN


def validate_init_data(init_data: str) -> dict | None:
    """Validate Telegram Mini App initData using HMAC-SHA256.

    Returns parsed user data dict or None if validation fails.
    """
    if not init_data or not BOT_TOKEN:
        return None

    try:
        parsed = parse_qs(init_data)
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

        user_str = parsed.get("user", [None])[0]
        if user_str:
            return json.loads(user_str)
        return None
    except Exception:
        return None
