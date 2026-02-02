import logging

from telegram.ext import Application, CommandHandler

from server.config import BOT_TOKEN
from bot.handlers.game_commands import (
    start_cmd,
    help_cmd,
    newgame_cmd,
    join_cmd,
    start_game_cmd,
    leave_cmd,
    drinks_cmd,
    status_cmd,
)

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


def create_bot_app() -> Application:
    app = Application.builder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start_cmd))
    app.add_handler(CommandHandler("help", help_cmd))
    app.add_handler(CommandHandler("newgame", newgame_cmd))
    app.add_handler(CommandHandler("join", join_cmd))
    app.add_handler(CommandHandler("startgame", start_game_cmd))
    app.add_handler(CommandHandler("leave", leave_cmd))
    app.add_handler(CommandHandler("drinks", drinks_cmd))
    app.add_handler(CommandHandler("status", status_cmd))

    return app
