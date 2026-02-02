from bot.main import create_bot_app

if __name__ == "__main__":
    app = create_bot_app()
    app.run_polling()
