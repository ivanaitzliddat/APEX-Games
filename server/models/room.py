from dataclasses import dataclass, field
from typing import Optional, Union

# Player ID can be either an int (Telegram user ID) or a string (session ID)
PlayerId = Union[int, str]


@dataclass
class Player:
    player_id: PlayerId  # Telegram user ID or session ID
    name: str
    is_host: bool = False
    is_playing: bool = True  # Host can choose to observe only

    # Alias for backwards compatibility
    @property
    def telegram_id(self) -> PlayerId:
        return self.player_id


@dataclass
class Room:
    code: str
    host_id: PlayerId
    game_id: str
    drinks_mode: bool = False
    started: bool = False
    players: dict[PlayerId, Player] = field(default_factory=dict)
    game_instance: Optional[object] = None

    @property
    def player_count(self) -> int:
        return len(self.players)

    def to_dict(self) -> dict:
        return {
            "code": self.code,
            "host_id": self.host_id,
            "game_id": self.game_id,
            "drinks_mode": self.drinks_mode,
            "started": self.started,
            "players": [
                {"player_id": p.player_id, "name": p.name, "is_host": p.is_host, "is_playing": p.is_playing}
                for p in self.players.values()
            ],
            "player_count": self.player_count,
        }
