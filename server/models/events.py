"""WebSocket event type constants and helper for building event dicts."""


class EventType:
    ROLE = "role"
    GAME_STATE = "game_state"
    LOBBY_UPDATE = "lobby_update"
    GAME_START = "game_start"
    PHASE_START = "phase_start"
    ACTION = "action"
    PLAYER_LOCKED = "player_locked"
    CARD_REVEALED = "card_revealed"
    ELIMINATION = "elimination"
    GAME_OVER = "game_over"
    ERROR = "error"
    PLAYER_LEFT = "player_left"  # Player disconnected/left the game


def make_event(event_type: str, **kwargs) -> dict:
    return {"type": event_type, **kwargs}
