from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ContextTypes

from server.config import WEBAPP_URL
from server.state import room_manager
from server.game_engine.registry import GameRegistry


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

    # Get available games from registry directly
    games = GameRegistry.list_games()

    if not games:
        await update.message.reply_text("No games available.")
        return

    if len(games) == 1:
        # Only one game, create room directly
        game = games[0]
        try:
            room = room_manager.create_room(user_id, user_name, game["id"])
        except ValueError as e:
            await update.message.reply_text(f"Error: {e}")
            return

        # Create WebApp button for the host to open the game
        webapp_url = f"{WEBAPP_URL}?room={room.code}"
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("Open Game", web_app=WebAppInfo(url=webapp_url))]
        ])

        await update.message.reply_text(
            f"Game room created!\n\n"
            f"Game: {game['name']}\n"
            f"Room Code: {room.code}\n\n"
            f"Share this code with friends!\n"
            f"They can click the button below or use /join {room.code}\n"
            f"Use /drinks {room.code} to toggle drink penalties\n"
            f"Use /startgame {room.code} when everyone is ready",
            reply_markup=keyboard,
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

    try:
        room = room_manager.join_room(code, user_id, user_name)
    except ValueError as e:
        await update.message.reply_text(f"Error: {e}")
        return

    player_names = [p.name for p in room.players.values()]

    # Create WebApp button
    webapp_url = f"{WEBAPP_URL}?room={room.code}"
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("Open Game", web_app=WebAppInfo(url=webapp_url))]
    ])

    await update.message.reply_text(
        f"Joined room {code}!\n\n"
        f"Game: {room.game_id}\n"
        f"Players ({room.player_count}): {', '.join(player_names)}\n"
        f"Drinks mode: {'ON' if room.drinks_mode else 'OFF'}",
        reply_markup=keyboard,
    )


async def drinks_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id, _ = _get_user_info(update)

    if not context.args:
        await update.message.reply_text(
            "Usage: /drinks <room_code>\n"
            "Toggles drink penalties on/off for the room."
        )
        return

    code = context.args[0].upper()
    room = room_manager.get_room(code)

    if not room:
        await update.message.reply_text("Error: Room not found")
        return

    if room.host_id != user_id:
        await update.message.reply_text("Error: Only the host can change settings")
        return

    if room.started:
        await update.message.reply_text("Error: Cannot change settings after game started")
        return

    room.drinks_mode = not room.drinks_mode
    mode_text = "ON" if room.drinks_mode else "OFF"
    await update.message.reply_text(f"Drinks mode: {mode_text}")


async def start_game_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id, _ = _get_user_info(update)

    if not context.args:
        await update.message.reply_text("Usage: /startgame <room_code>")
        return

    code = context.args[0].upper()

    try:
        room = room_manager.start_game(code, user_id)
    except ValueError as e:
        await update.message.reply_text(f"Error: {e}")
        return

    webapp_url = f"{WEBAPP_URL}?room={code}"

    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("Open Game", web_app=WebAppInfo(url=webapp_url))]
    ])

    player_names = [p.name for p in room.players.values()]
    await update.message.reply_text(
        f"Game started! Room: {code}\n\n"
        f"Players: {', '.join(player_names)}\n"
        f"Drinks mode: {'ON' if room.drinks_mode else 'OFF'}\n\n"
        f"Click below to open the game!",
        reply_markup=keyboard,
    )


async def leave_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id, _ = _get_user_info(update)

    room = room_manager.leave_room(user_id)
    if room:
        await update.message.reply_text(f"You left the room. New host: {room.players[room.host_id].name}")
    else:
        await update.message.reply_text("You left the room (or weren't in one).")


async def status_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text("Usage: /status <room_code>")
        return

    code = context.args[0].upper()
    room = room_manager.get_room(code)

    if not room:
        await update.message.reply_text("Error: Room not found")
        return

    player_names = [p.name for p in room.players.values()]
    status = "In Progress" if room.started else "Waiting"

    await update.message.reply_text(
        f"Room: {room.code}\n"
        f"Game: {room.game_id}\n"
        f"Status: {status}\n"
        f"Players ({room.player_count}): {', '.join(player_names)}\n"
        f"Drinks mode: {'ON' if room.drinks_mode else 'OFF'}"
    )
