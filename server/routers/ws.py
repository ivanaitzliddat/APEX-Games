import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from server.auth import validate_init_data
from server.state import room_manager
from server.models.events import EventType, make_event

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/{room_code}")
async def websocket_endpoint(websocket: WebSocket, room_code: str):
    room_code = room_code.upper()

    # Accept first, then validate (WebSocket protocol requires accept before send)
    await websocket.accept()

    # Get initData from query params
    init_data = websocket.query_params.get("initData", "")
    user_data = validate_init_data(init_data)

    # For development: allow a dev_user_id param when no valid initData
    dev_user_id = websocket.query_params.get("dev_user_id")
    dev_user_name = websocket.query_params.get("dev_user_name", "Dev User")

    if user_data:
        telegram_id = user_data.get("id")
        user_name = (
            user_data.get("first_name", "")
            + " "
            + user_data.get("last_name", "")
        ).strip() or "Unknown"
    elif dev_user_id:
        # Development mode fallback
        telegram_id = int(dev_user_id)
        user_name = dev_user_name
    else:
        await websocket.send_text(
            json.dumps(make_event(EventType.ERROR, message="Invalid authentication"))
        )
        await websocket.close(code=4001, reason="Invalid auth")
        return

    room = room_manager.get_room(room_code)
    if not room:
        await websocket.send_text(
            json.dumps(make_event(EventType.ERROR, message="Room not found"))
        )
        await websocket.close(code=4004, reason="Room not found")
        return

    if telegram_id not in room.players:
        await websocket.send_text(
            json.dumps(make_event(EventType.ERROR, message="You are not in this room"))
        )
        await websocket.close(code=4003, reason="Not in room")
        return

    # Register connection
    await room_manager.connect(room_code, telegram_id, websocket)

    # Determine role
    if telegram_id == room.host_id:
        role = "host"
    elif room.game_instance and telegram_id not in room.game_instance.alive_players:
        role = "spectator"
    else:
        role = "player"

    # Send role assignment
    await websocket.send_text(
        json.dumps(make_event(EventType.ROLE, role=role))
    )

    # Send current game state
    try:
        if room.game_instance:
            player = room.players.get(telegram_id)
            # Host who is NOT playing gets observer state
            if role == "host" and (not player or not player.is_playing):
                state = room.game_instance.get_state_for_observer()
            else:
                state = room.game_instance.get_state_for_player(telegram_id)
            await websocket.send_text(
                json.dumps(make_event(EventType.GAME_STATE, **state))
            )
        else:
            # Game hasn't started yet, send lobby state
            logger.info(f"Sending lobby_update to {telegram_id}")
            lobby_data = make_event(
                EventType.LOBBY_UPDATE,
                players=[
                    {"player_id": p.telegram_id, "name": p.name, "is_host": p.is_host, "is_playing": getattr(p, 'is_playing', True)}
                    for p in room.players.values()
                ],
                room_code=room_code,
                game_id=room.game_id,
                drinks_mode=room.drinks_mode,
                started=room.started,
            )
            logger.info(f"Lobby data: {lobby_data}")
            await websocket.send_text(json.dumps(lobby_data))
            logger.info(f"Sent lobby_update to {telegram_id}")
    except Exception as e:
        logger.error(f"Error sending initial state to {telegram_id}: {e}")
        await websocket.close()
        return

    # Message receive loop
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type")

            if msg_type == "action" and room.game_instance:
                events = await room.game_instance.handle_action(telegram_id, msg)
                for event in events:
                    if event.get("_host_only"):
                        event.pop("_host_only")
                        await room_manager.send_to_host(room_code, event)
                    else:
                        await room_manager.broadcast(room_code, event)

                # Check if game ended
                if room.game_instance.is_finished():
                    # Keep room alive briefly for results viewing
                    pass

            elif msg_type == "toggle_playing" and telegram_id == room.host_id:
                if not room.started:
                    host_player = room.players.get(telegram_id)
                    if host_player:
                        host_player.is_playing = not host_player.is_playing
                        # Broadcast updated lobby state
                        await room_manager.broadcast(
                            room_code,
                            make_event(
                                EventType.LOBBY_UPDATE,
                                players=[
                                    {"player_id": p.telegram_id, "name": p.name, "is_host": p.is_host, "is_playing": getattr(p, 'is_playing', True)}
                                    for p in room.players.values()
                                ],
                                room_code=room_code,
                                game_id=room.game_id,
                                drinks_mode=room.drinks_mode,
                                started=room.started,
                            ),
                        )

            elif msg_type == "start_game" and telegram_id == room.host_id:
                if not room.started and room.game_instance is None:
                    try:
                        room_manager.start_game(room_code, telegram_id)
                        init_event = await room.game_instance.initialize()
                        await room_manager.broadcast(
                            room_code,
                            make_event(EventType.GAME_START, game_id=room.game_id),
                        )

                        # Send game_state to each player (so they transition from lobby to game view)
                        for pid, ws_conn in room_manager.get_connections(room_code).items():
                            player = room.players.get(pid)
                            # Host who is NOT playing gets observer state
                            # Host who IS playing gets player state (like other players)
                            if pid == room.host_id and (not player or not player.is_playing):
                                state = room.game_instance.get_state_for_observer()
                            else:
                                state = room.game_instance.get_state_for_player(pid)
                            await ws_conn.send_text(
                                json.dumps(make_event(EventType.GAME_STATE, **state))
                            )
                    except ValueError as e:
                        await websocket.send_text(
                            json.dumps(make_event(EventType.ERROR, message=str(e)))
                        )

    except WebSocketDisconnect:
        logger.info(f"Player {telegram_id} disconnected from room {room_code}")
    except Exception as e:
        logger.error(f"WebSocket error for player {telegram_id}: {e}")
    finally:
        await room_manager.disconnect(room_code, telegram_id)
