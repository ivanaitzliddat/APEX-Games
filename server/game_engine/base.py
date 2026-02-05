from abc import ABC, abstractmethod


class BaseGame(ABC):
    """Abstract base class that all game plugins must implement."""

    game_id: str = ""
    display_name: str = ""
    min_players: int = 1
    max_players: int = 100
    description: str = ""

    def __init__(self, room):
        self.room = room

    @abstractmethod
    async def initialize(self) -> dict:
        """Set up initial game state. Return state dict to broadcast."""
        ...

    @abstractmethod
    async def handle_action(self, player_id: int, action: dict) -> list[dict]:
        """Process a player action. Return list of events to broadcast."""
        ...

    @abstractmethod
    def get_state_for_player(self, player_id: int) -> dict:
        """Return the game state visible to a specific player."""
        ...

    @abstractmethod
    def get_state_for_observer(self) -> dict:
        """Return the full game state for the host observer."""
        ...

    @abstractmethod
    def is_finished(self) -> bool:
        """Whether the game has concluded."""
        ...

    async def handle_disconnect(self, player_id: int) -> list[dict]:
        """Handle a player disconnecting mid-game. Return list of events to broadcast.

        Default implementation does nothing. Games should override this to handle
        disconnections appropriately (e.g., auto-eliminate the player).
        """
        return []
