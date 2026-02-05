import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from server.auth import validate_init_data
from server.state import room_manager, SERVER_INSTANCE_ID
from server.models.events import EventType, make_event

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/{room_code}")
async def websocket_endpoint(websocket: WebSocket, room_code: str):
    room_code = room_code.upper()

    # Accept first, then validate (WebSocket protocol requires accept before send)
    await websocket.accept()

    # Get auth params
    init_data = websocket.query_params.get("initData", "")
    session_id = websocket.query_params.get("session_id", "")
    player_name = websocket.query_params.get("player_name", "")
    dev_user_id = websocket.query_params.get("dev_user_id", "")
    dev_user_name = websocket.query_params.get("dev_user_name", "Dev User")

    # Validate auth - priority: Telegram > Session > Dev
    user_data = validate_init_data(init_data) if init_data else None
    player_id = None
    user_name = None

    if user_data:
        # Telegram auth - use Telegram user ID
        player_id = user_data.get("id")
        user_name = (
            user_data.get("first_name", "")
            + " "
            + user_data.get("last_name", "")
        ).strip() or "Unknown"
        logger.info(f"Telegram auth: user_id={player_id}, name={user_name}")
    elif session_id and player_name:
        # Session auth - use session ID as player ID
        player_id = session_id
        user_name = player_name
        logger.info(f"Session auth: session_id={session_id}, name={player_name}")
    elif dev_user_id:
        # Dev mode fallback
        player_id = int(dev_user_id)
        user_name = dev_user_name
        logger.info(f"Dev auth: dev_user_id={dev_user_id}, name={dev_user_name}")
    else:
        logger.warning(f"No valid auth for room {room_code}")
        await websocket.send_text(
            json.dumps(make_event(EventType.ERROR, message="Please enter your name to join"))
        )
        await websocket.close(code=4001, reason="No auth")
        return

    logger.info(f"=== WEBSOCKET CONNECT === [instance: {SERVER_INSTANCE_ID}]")
    logger.info(f"  room_code={room_code}")
    logger.info(f"  player_id={player_id} (type={type(player_id).__name__})")
    logger.info(f"  user_name={user_name}")
    logger.info(f"  Available rooms: {list(room_manager.rooms.keys())}")
    logger.info(f"  Player-room map: {dict(room_manager._player_room)}")

    room = room_manager.get_room(room_code)
    if not room:
        logger.warning(f"  ROOM NOT FOUND: {room_code}")
        logger.warning(f"  Available rooms at this moment: {list(room_manager.rooms.keys())}")
        await websocket.send_text(
            json.dumps(make_event(EventType.ERROR, message="Room not found"))
        )
        await websocket.close(code=4004, reason="Room not found")
        return

    # Auto-join: if user is not in the room yet and game hasn't started, join them
    is_new_join = player_id not in room.players
    if is_new_join:
        if room.started:
            logger.warning(f"User {player_id} tried to join started game {room_code}")
            await websocket.send_text(
                json.dumps(make_event(EventType.ERROR, message="Game already started"))
            )
            await websocket.close(code=4003, reason="Game already started")
            return

        # Auto-join the room
        try:
            room_manager.join_room(room_code, player_id, user_name)
            logger.info(f"Auto-joined user {player_id} ({user_name}) to room {room_code}")
            room = room_manager.get_room(room_code)  # Refresh room reference
        except ValueError as e:
            logger.warning(f"Failed to auto-join user {player_id} to room {room_code}: {e}")
            await websocket.send_text(
                json.dumps(make_event(EventType.ERROR, message=str(e)))
            )
            await websocket.close(code=4003, reason=str(e))
            return

    # Register connection
    await room_manager.connect(room_code, player_id, websocket)

    # Determine role
    if player_id == room.host_id:
        role = "host"
    elif room.game_instance and player_id not in room.game_instance.alive_players:
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
            player = room.players.get(player_id)
            # Host who is NOT playing gets observer state
            if role == "host" and (not player or not player.is_playing):
                state = room.game_instance.get_state_for_observer()
            else:
                state = room.game_instance.get_state_for_player(player_id)
            await websocket.send_text(
                json.dumps(make_event(EventType.GAME_STATE, **state))
            )
        else:
            # Game hasn't started yet, send lobby state
            logger.info(f"Sending lobby_update to {player_id}")
            lobby_data = make_event(
                EventType.LOBBY_UPDATE,
                players=[
                    {"player_id": p.player_id, "name": p.name, "is_host": p.is_host, "is_playing": getattr(p, 'is_playing', True)}
                    for p in room.players.values()
                ],
                room_code=room_code,
                game_id=room.game_id,
                drinks_mode=room.drinks_mode,
                started=room.started,
            )
            logger.info(f"Lobby data: {lobby_data}")

            # Always send lobby_update directly to the connecting player first
            await websocket.send_text(json.dumps(lobby_data))
            logger.info(f"Sent lobby_update to {player_id}")

            # If this is a new player joining, also notify other players
            if is_new_join:
                try:
                    await room_manager.broadcast(room_code, lobby_data, exclude={player_id})
                    logger.info(f"Broadcast lobby_update to other players in room {room_code}")
                except Exception as e:
                    # Don't fail the join if broadcast to others fails
                    logger.warning(f"Failed to broadcast lobby_update to others: {e}")
    except Exception as e:
        logger.error(f"Error sending initial state to {player_id}: {e}")
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
                events = await room.game_instance.handle_action(player_id, msg)
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

            elif msg_type == "toggle_playing" and player_id == room.host_id:
                if not room.started:
                    host_player = room.players.get(player_id)
                    if host_player:
                        host_player.is_playing = not host_player.is_playing
                        # Broadcast updated lobby state
                        await room_manager.broadcast(
                            room_code,
                            make_event(
                                EventType.LOBBY_UPDATE,
                                players=[
                                    {"player_id": p.player_id, "name": p.name, "is_host": p.is_host, "is_playing": getattr(p, 'is_playing', True)}
                                    for p in room.players.values()
                                ],
                                room_code=room_code,
                                game_id=room.game_id,
                                drinks_mode=room.drinks_mode,
                                started=room.started,
                            ),
                        )

            elif msg_type == "start_game" and player_id == room.host_id:
                if not room.started and room.game_instance is None:
                    try:
                        room_manager.start_game(room_code, player_id)
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

            elif msg_type == "reset_game" and player_id == room.host_id:
                # Host wants to play again with the same players
                if room.started:
                    try:
                        room_manager.reset_room(room_code, player_id)
                        logger.info(f"Room {room_code} reset by host {player_id}")

                        # Broadcast lobby_update to all players to return to lobby
                        lobby_data = make_event(
                            EventType.LOBBY_UPDATE,
                            players=[
                                {"player_id": p.player_id, "name": p.name, "is_host": p.is_host, "is_playing": getattr(p, 'is_playing', True)}
                                for p in room.players.values()
                            ],
                            room_code=room_code,
                            game_id=room.game_id,
                            drinks_mode=room.drinks_mode,
                            started=False,
                        )
                        await room_manager.broadcast(room_code, lobby_data)
                    except ValueError as e:
                        await websocket.send_text(
                            json.dumps(make_event(EventType.ERROR, message=str(e)))
                        )

    except WebSocketDisconnect:
        logger.info(f"Player {player_id} disconnected from room {room_code}")
    except Exception as e:
        logger.error(f"WebSocket error for player {player_id}: {e}")
    finally:
        await room_manager.disconnect(room_code, player_id)

        # Handle player leaving - notify others and update game state
        room = room_manager.get_room(room_code)
        if room:
            player = room.players.get(player_id)
            disconnected_name = player.name if player else user_name

            if not room.started:
                # Game hasn't started - remove player from room
                updated_room = room_manager.leave_room(player_id)
                if updated_room:
                    # Room still exists, broadcast updated lobby
                    lobby_data = make_event(
                        EventType.LOBBY_UPDATE,
                        players=[
                            {"player_id": p.player_id, "name": p.name, "is_host": p.is_host, "is_playing": getattr(p, 'is_playing', True)}
                            for p in updated_room.players.values()
                        ],
                        room_code=room_code,
                        game_id=updated_room.game_id,
                        drinks_mode=updated_room.drinks_mode,
                        started=updated_room.started,
                    )
                    await room_manager.broadcast(room_code, lobby_data)
                    # Also send player_left notification
                    await room_manager.broadcast(
                        room_code,
                        make_event(EventType.PLAYER_LEFT, player_id=player_id, player_name=disconnected_name, reason="left")
                    )
                    logger.info(f"Player {player_id} ({disconnected_name}) left room {room_code}, notified remaining players")
                else:
                    logger.info(f"Room {room_code} destroyed after last player {player_id} left")
            else:
                # Game in progress - handle disconnection
                if room.game_instance and hasattr(room.game_instance, 'handle_disconnect'):
                    if player_id in room.game_instance.alive_players:
                        # Auto-eliminate the disconnected player
                        events = await room.game_instance.handle_disconnect(player_id)
                        for event in events:
                            await room_manager.broadcast(room_code, event)
                        logger.info(f"Player {player_id} ({disconnected_name}) disconnected mid-game, eliminated")
                    else:
                        # Player was already eliminated, just notify others
                        await room_manager.broadcast(
                            room_code,
                            make_event(EventType.PLAYER_LEFT, player_id=player_id, player_name=disconnected_name, reason="disconnected")
                        )
                        logger.info(f"Eliminated player {player_id} ({disconnected_name}) disconnected from room {room_code}")
