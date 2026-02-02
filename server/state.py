import json
import random
import string
import logging
from typing import Optional

from fastapi import WebSocket

from server.models.room import Room, Player
from server.models.events import EventType, make_event
from server.game_engine.registry import GameRegistry

logger = logging.getLogger(__name__)


def generate_room_code(length: int = 6) -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))


class RoomManager:
    def __init__(self):
        self.rooms: dict[str, Room] = {}
        self.connections: dict[str, dict[int, WebSocket]] = {}
        self._player_room: dict[int, str] = {}

    def create_room(self, host_id: int, host_name: str, game_id: str) -> Room:
        game_cls = GameRegistry.get(game_id)
        if game_cls is None:
            raise ValueError(f"Unknown game: {game_id}")

        code = generate_room_code()
        while code in self.rooms:
            code = generate_room_code()

        host = Player(telegram_id=host_id, name=host_name, is_host=True)
        room = Room(code=code, host_id=host_id, game_id=game_id)
        room.players[host_id] = host

        self.rooms[code] = room
        self.connections[code] = {}
        self._player_room[host_id] = code
        return room

    def join_room(self, code: str, player_id: int, player_name: str) -> Room:
        room = self.rooms.get(code)
        if room is None:
            raise ValueError("Room not found")
        if room.started:
            raise ValueError("Game already started")
        if player_id in room.players:
            raise ValueError("Already in this room")
        if player_id in self._player_room:
            raise ValueError("Already in another room")

        game_cls = GameRegistry.get(room.game_id)
        if game_cls and room.player_count >= game_cls.max_players:
            raise ValueError("Room is full")

        room.players[player_id] = Player(telegram_id=player_id, name=player_name)
        self._player_room[player_id] = code
        return room

    def leave_room(self, player_id: int) -> Optional[Room]:
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

    def get_player_room(self, player_id: int) -> Optional[Room]:
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

    def start_game(self, code: str, requester_id: int) -> Room:
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
        if room.player_count < game_cls.min_players:
            raise ValueError(
                f"Need at least {game_cls.min_players} players to start"
            )

        room.game_instance = game_cls(room)
        room.started = True
        return room

    async def connect(self, code: str, player_id: int, ws: WebSocket) -> None:
        if code not in self.connections:
            self.connections[code] = {}
        old_ws = self.connections[code].get(player_id)
        if old_ws:
            try:
                await old_ws.close()
            except Exception:
                pass
        self.connections[code][player_id] = ws

    async def disconnect(self, code: str, player_id: int) -> None:
        conns = self.connections.get(code)
        if conns:
            conns.pop(player_id, None)

    async def broadcast(
        self, code: str, event: dict, exclude: set[int] | None = None
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

    async def send_to(self, code: str, player_id: int, event: dict) -> None:
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


# Singleton instance
room_manager = RoomManager()
