import json
import random
import string
import logging
import time
import uuid
from typing import Optional, Union

from fastapi import WebSocket

from server.models.room import Room, Player, PlayerId
from server.models.events import EventType, make_event
from server.game_engine.registry import GameRegistry

logger = logging.getLogger(__name__)

# Unique ID for this server instance - helps detect if multiple instances are running
SERVER_INSTANCE_ID = str(uuid.uuid4())[:8]
SERVER_START_TIME = time.time()
logger.info(f"=== SERVER INSTANCE STARTED: {SERVER_INSTANCE_ID} ===")


def generate_room_code(length: int = 6) -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))


class RoomManager:
    def __init__(self):
        self.rooms: dict[str, Room] = {}
        self.connections: dict[str, dict[PlayerId, WebSocket]] = {}
        self._player_room: dict[PlayerId, str] = {}

    def create_room(self, host_id: PlayerId, host_name: str, game_id: str) -> Room:
        game_cls = GameRegistry.get(game_id)
        if game_cls is None:
            raise ValueError(f"Unknown game: {game_id}")

        # Auto-leave any existing room first
        if host_id in self._player_room:
            self.leave_room(host_id)

        code = generate_room_code()
        while code in self.rooms:
            code = generate_room_code()

        host = Player(player_id=host_id, name=host_name, is_host=True)
        room = Room(code=code, host_id=host_id, game_id=game_id)
        room.players[host_id] = host

        self.rooms[code] = room
        self.connections[code] = {}
        self._player_room[host_id] = code
        return room

    def join_room(self, code: str, player_id: PlayerId, player_name: str) -> Room:
        room = self.rooms.get(code)
        if room is None:
            raise ValueError("Room not found")
        if room.started:
            raise ValueError("Game already started")
        if player_id in room.players:
            # Already in this room - just return it (idempotent join)
            return room
        if player_id in self._player_room:
            # Player is in another room - leave it first
            self.leave_room(player_id)

        game_cls = GameRegistry.get(room.game_id)
        if game_cls and room.player_count >= game_cls.max_players:
            raise ValueError("Room is full")

        room.players[player_id] = Player(player_id=player_id, name=player_name)
        self._player_room[player_id] = code
        return room

    def leave_room(self, player_id: PlayerId) -> Optional[Room]:
        code = self._player_room.pop(player_id, None)
        if code is None:
            return None
        room = self.rooms.get(code)
        if room is None:
            return None

        room.players.pop(player_id, None)

        if len(room.players) == 0:
            self.destroy_room(code)
            return None

        if player_id == room.host_id:
            new_host_id = next(iter(room.players))
            room.host_id = new_host_id
            room.players[new_host_id].is_host = True

        return room

    def get_room(self, code: str) -> Optional[Room]:
        return self.rooms.get(code)

    def get_player_room(self, player_id: PlayerId) -> Optional[Room]:
        code = self._player_room.get(player_id)
        if code:
            return self.rooms.get(code)
        return None

    def destroy_room(self, code: str) -> None:
        room = self.rooms.pop(code, None)
        if room:
            for pid in room.players:
                self._player_room.pop(pid, None)
        self.connections.pop(code, None)

    def reset_room(self, code: str, requester_id: PlayerId) -> Room:
        """Reset a room after a game ends to allow playing again."""
        room = self.rooms.get(code)
        if room is None:
            raise ValueError("Room not found")
        if room.host_id != requester_id:
            raise ValueError("Only the host can reset the game")
        if not room.started:
            raise ValueError("Game hasn't started yet")

        # Reset game state
        room.game_instance = None
        room.started = False

        # Remove players who are no longer connected
        connected_players = set(self.connections.get(code, {}).keys())
        disconnected_players = [pid for pid in room.players if pid not in connected_players]
        for pid in disconnected_players:
            room.players.pop(pid, None)
            self._player_room.pop(pid, None)
            logger.info(f"Removed disconnected player {pid} from room {code} during reset")

        # If host disconnected (shouldn't happen since they're resetting), assign new host
        if room.host_id not in room.players and room.players:
            new_host_id = next(iter(room.players))
            room.host_id = new_host_id
            room.players[new_host_id].is_host = True
            logger.info(f"Assigned new host {new_host_id} in room {code}")

        # Reset all remaining players to playing state
        for player in room.players.values():
            player.is_playing = True

        logger.info(f"Room {code} reset by host {requester_id}, {len(room.players)} players remaining")
        return room

    def start_game(self, code: str, requester_id: PlayerId) -> Room:
        room = self.rooms.get(code)
        if room is None:
            raise ValueError("Room not found")
        if room.host_id != requester_id:
            raise ValueError("Only the host can start the game")
        if room.started:
            raise ValueError("Game already started")

        game_cls = GameRegistry.get(room.game_id)
        if game_cls is None:
            raise ValueError(f"Unknown game: {room.game_id}")
        # Count only players who are playing (not observe-only)
        playing_count = sum(1 for p in room.players.values() if p.is_playing)
        if playing_count < game_cls.min_players:
            raise ValueError(
                f"Need at least {game_cls.min_players} players to start"
            )

        room.game_instance = game_cls(room)
        room.started = True
        return room

    async def connect(self, code: str, player_id: PlayerId, ws: WebSocket) -> None:
        if code not in self.connections:
            self.connections[code] = {}
        old_ws = self.connections[code].get(player_id)
        if old_ws:
            try:
                await old_ws.close()
            except Exception:
                pass
        self.connections[code][player_id] = ws

    async def disconnect(self, code: str, player_id: PlayerId) -> None:
        conns = self.connections.get(code)
        if conns:
            conns.pop(player_id, None)

    async def broadcast(
        self, code: str, event: dict, exclude: set[PlayerId] | None = None
    ) -> None:
        conns = self.connections.get(code, {})
        msg = json.dumps(event)
        for pid, ws in list(conns.items()):
            if exclude and pid in exclude:
                continue
            try:
                await ws.send_text(msg)
            except Exception:
                logger.warning(f"Failed to send to player {pid} in room {code}")

    async def send_to(self, code: str, player_id: PlayerId, event: dict) -> None:
        conns = self.connections.get(code, {})
        ws = conns.get(player_id)
        if ws:
            try:
                await ws.send_text(json.dumps(event))
            except Exception:
                logger.warning(f"Failed to send to player {player_id}")

    async def send_to_host(self, code: str, event: dict) -> None:
        room = self.rooms.get(code)
        if room:
            await self.send_to(code, room.host_id, event)

    def get_connections(self, code: str) -> dict[PlayerId, WebSocket]:
        return self.connections.get(code, {})


# Singleton instance
room_manager = RoomManager()
