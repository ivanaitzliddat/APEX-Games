"""Runs both bot and server concurrently."""

import asyncio
import logging
import os

import uvicorn

from bot.main import create_bot_app

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)


async def main():
    port = int(os.environ.get("PORT", 8000))
    config = uvicorn.Config("server.main:app", host="0.0.0.0", port=port, log_level="info")
    server = uvicorn.Server(config)

    bot_token = os.environ.get("BOT_TOKEN", "")
    if not bot_token:
        logger.warning("BOT_TOKEN not set - running server only without Telegram bot")
        await server.serve()
        return

    # Run both bot and server concurrently
    bot_app = create_bot_app()
    async with bot_app:
        await bot_app.start()
        try:
            await server.serve()
        finally:
            await bot_app.stop()


if __name__ == "__main__":
    asyncio.run(main())
