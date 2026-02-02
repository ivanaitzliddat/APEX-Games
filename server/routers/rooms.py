from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from server.state import room_manager
from server.game_engine.registry import GameRegistry

router = APIRouter()


class CreateRoomRequest(BaseModel):
    host_id: int
    host_name: str
    game_id: str


class JoinRoomRequest(BaseModel):
    player_id: int
    player_name: str


class StartGameRequest(BaseModel):
    requester_id: int


class SettingsRequest(BaseModel):
    requester_id: int
    drinks_mode: bool | None = None


@router.get("/games")
async def list_games():
    return {"games": GameRegistry.list_games()}


@router.post("/rooms")
async def create_room(req: CreateRoomRequest):
    try:
        room = room_manager.create_room(req.host_id, req.host_name, req.game_id)
        return {"room": room.to_dict()}
    except ValueError as e:
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
