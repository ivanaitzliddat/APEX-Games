import httpx
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ContextTypes

from server.config import SERVER_URL, WEBAPP_URL

API_BASE = SERVER_URL + "/api"


async def _api_get(path: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{API_BASE}{path}")
        return resp.json()


async def _api_post(path: str, data: dict) -> tuple[dict, int]:
    async with httpx.AsyncClient() as client:
        resp = await client.post(f"{API_BASE}{path}", json=data)
        return resp.json(), resp.status_code


async def _api_patch(path: str, data: dict) -> tuple[dict, int]:
    async with httpx.AsyncClient() as client:
        resp = await client.patch(f"{API_BASE}{path}", json=data)
        return resp.json(), resp.status_code


def _get_user_info(update: Update) -> tuple[int, str]:
    user = update.effective_user
    name = user.first_name or ""
    if user.last_name:
        name += f" {user.last_name}"
    return user.id, name.strip() or "Unknown"


async def start_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Welcome to APEX Games!\n\n"
        "Use /newgame to create a game room\n"
        "Use /join <code> to join a room\n"
        "Use /help to see all commands"
    )


async def help_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "APEX Games - Commands:\n\n"
        "/newgame - Create a new game room\n"
        "/join <code> - Join a room with code\n"
        "/drinks - Toggle drinks mode (host only)\n"
        "/startgame - Start the game (host only)\n"
        "/leave - Leave current room\n"
        "/status - Show current room info\n"
        "/help - Show this help message"
    )


async def newgame_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id, user_name = _get_user_info(update)

    # Get available games
    games_resp = await _api_get("/games")
    games = games_resp.get("games", [])

    if not games:
        await update.message.reply_text("No games available.")
        return

    if len(games) == 1:
        # Only one game, create room directly
        game = games[0]
        data, status = await _api_post(
            "/rooms",
            {"host_id": user_id, "host_name": user_name, "game_id": game["id"]},
        )
        if status != 200:
            await update.message.reply_text(f"Error: {data.get('detail', 'Unknown error')}")
            return

        room = data["room"]
        await update.message.reply_text(
            f"Game room created!\n\n"
            f"Game: {game['name']}\n"
            f"Room Code: {room['code']}\n\n"
            f"Share this code with friends!\n"
            f"Use /join {room['code']} to join\n"
            f"Use /drinks to toggle drink penalties\n"
            f"Use /startgame when everyone is ready"
        )
    else:
        # Show game selection (for future when multiple games exist)
        text = "Choose a game:\n\n"
        for g in games:
            text += f"• {g['name']} - {g['description']}\n"
            text += f"  Players: {g['min_players']}-{g['max_players']}\n\n"
        text += "Use /newgame <game_id> to create a room"
        await update.message.reply_text(text)


async def join_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id, user_name = _get_user_info(update)

    if not context.args:
        await update.message.reply_text("Usage: /join <room_code>")
        return

    code = context.args[0].upper()
    data, status = await _api_post(
        f"/rooms/{code}/join",
        {"player_id": user_id, "player_name": user_name},
    )

    if status != 200:
        await update.message.reply_text(f"Error: {data.get('detail', 'Unknown error')}")
        return

    room = data["room"]
    player_names = [p["name"] for p in room["players"]]
    await update.message.reply_text(
        f"Joined room {code}!\n\n"
        f"Game: {room['game_id']}\n"
        f"Players ({room['player_count']}): {', '.join(player_names)}\n"
        f"Drinks mode: {'ON' if room['drinks_mode'] else 'OFF'}"
    )


async def drinks_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id, _ = _get_user_info(update)

    # Find the user's room
    # We need to check all rooms - for simplicity, try to get from args or find it
    if context.args:
        code = context.args[0].upper()
    else:
        await update.message.reply_text(
            "Usage: /drinks <room_code>\n"
            "Toggles drink penalties on/off for the room."
        )
        return

    # Get current room state first
    room_resp = await _api_get(f"/rooms/{code}")
    if "detail" in room_resp:
        await update.message.reply_text(f"Error: {room_resp['detail']}")
        return

    current = room_resp["room"]["drinks_mode"]
    new_mode = not current

    data, status = await _api_patch(
        f"/rooms/{code}/settings",
        {"requester_id": user_id, "drinks_mode": new_mode},
    )

    if status != 200:
        await update.message.reply_text(f"Error: {data.get('detail', 'Unknown error')}")
        return

    mode_text = "ON" if new_mode else "OFF"
    await update.message.reply_text(f"Drinks mode: {mode_text}")


async def start_game_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id, _ = _get_user_info(update)

    if not context.args:
        await update.message.reply_text("Usage: /startgame <room_code>")
        return

    code = context.args[0].upper()
    data, status = await _api_post(
        f"/rooms/{code}/start",
        {"requester_id": user_id},
    )

    if status != 200:
        await update.message.reply_text(f"Error: {data.get('detail', 'Unknown error')}")
        return

    room = data["room"]
    webapp_url = f"{WEBAPP_URL}?room={code}"

    keyboard = InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "Open Game",
                    web_app=WebAppInfo(url=webapp_url),
                )
            ]
        ]
    )

    player_names = [p["name"] for p in room["players"]]
    await update.message.reply_text(
        f"Game started! Room: {code}\n\n"
        f"Players: {', '.join(player_names)}\n"
        f"Drinks mode: {'ON' if room['drinks_mode'] else 'OFF'}\n\n"
        f"Click below to open the game!",
        reply_markup=keyboard,
    )


async def leave_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "To leave, close the Mini App and the room will clean up automatically.\n"
        "If you need to leave before the game starts, ask the host."
    )


async def status_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text("Usage: /status <room_code>")
        return

    code = context.args[0].upper()
    data = await _api_get(f"/rooms/{code}")

    if "detail" in data:
        await update.message.reply_text(f"Error: {data['detail']}")
        return

    room = data["room"]
    player_names = [p["name"] for p in room["players"]]
    status = "In Progress" if room["started"] else "Waiting"

    await update.message.reply_text(
        f"Room: {room['code']}\n"
        f"Game: {room['game_id']}\n"
        f"Status: {status}\n"
        f"Players ({room['player_count']}): {', '.join(player_names)}\n"
        f"Drinks mode: {'ON' if room['drinks_mode'] else 'OFF'}"
    )
