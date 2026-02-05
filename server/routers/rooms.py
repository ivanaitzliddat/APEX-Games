import logging
from typing import Union

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from server.state import room_manager, SERVER_INSTANCE_ID, SERVER_START_TIME
from server.game_engine.registry import GameRegistry

logger = logging.getLogger(__name__)

import time
router = APIRouter()

# Player ID can be int (Telegram) or str (session)
PlayerId = Union[int, str]


class CreateRoomRequest(BaseModel):
    host_id: PlayerId
    host_name: str
    game_id: str


class JoinRoomRequest(BaseModel):
    player_id: PlayerId
    player_name: str


class StartGameRequest(BaseModel):
    requester_id: PlayerId


class SettingsRequest(BaseModel):
    requester_id: PlayerId
    drinks_mode: bool | None = None


@router.get("/games")
async def list_games():
    return {"games": GameRegistry.list_games()}


@router.get("/debug/rooms")
async def debug_rooms():
    """Debug endpoint to check current room state."""
    rooms_info = {}
    for code, room in room_manager.rooms.items():
        rooms_info[code] = {
            "host_id": room.host_id,
            "player_count": len(room.players),
            "players": list(room.players.keys()),
            "started": room.started,
            "game_id": room.game_id,
        }
    return {
        "server_instance_id": SERVER_INSTANCE_ID,
        "server_uptime_seconds": int(time.time() - SERVER_START_TIME),
        "room_count": len(room_manager.rooms),
        "rooms": rooms_info,
        "player_room_map": dict(room_manager._player_room),
    }


@router.post("/rooms")
async def create_room(req: CreateRoomRequest):
    logger.info(f"=== CREATE ROOM REQUEST === [instance: {SERVER_INSTANCE_ID}]")
    logger.info(f"  host_id={req.host_id} (type={type(req.host_id).__name__})")
    logger.info(f"  host_name={req.host_name}")
    logger.info(f"  game_id={req.game_id}")
    logger.info(f"  Current rooms BEFORE: {list(room_manager.rooms.keys())}")
    logger.info(f"  Player-room map BEFORE: {dict(room_manager._player_room)}")
    try:
        room = room_manager.create_room(req.host_id, req.host_name, req.game_id)
        logger.info(f"  Room created: code={room.code}")
        logger.info(f"  Current rooms AFTER: {list(room_manager.rooms.keys())}")
        logger.info(f"  Verify room exists: {room_manager.get_room(room.code) is not None}")
        response = {"room": room.to_dict()}
        logger.info(f"  Returning: {response}")
        return response
    except ValueError as e:
        logger.error(f"  Failed to create room: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/rooms/{code}")
async def get_room(code: str):
    room = room_manager.get_room(code.upper())
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    return {"room": room.to_dict()}


@router.post("/rooms/{code}/join")
async def join_room(code: str, req: JoinRoomRequest):
    try:
        room = room_manager.join_room(code.upper(), req.player_id, req.player_name)
        return {"room": room.to_dict()}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/rooms/{code}/start")
async def start_game(code: str, req: StartGameRequest):
    try:
        room = room_manager.start_game(code.upper(), req.requester_id)
        return {"room": room.to_dict()}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/rooms/{code}/settings")
async def update_settings(code: str, req: SettingsRequest):
    room = room_manager.get_room(code.upper())
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.host_id != req.requester_id:
        raise HTTPException(status_code=403, detail="Only host can change settings")
    if room.started:
        raise HTTPException(status_code=400, detail="Cannot change settings after game started")

    if req.drinks_mode is not None:
        room.drinks_mode = req.drinks_mode

    return {"room": room.to_dict()}
