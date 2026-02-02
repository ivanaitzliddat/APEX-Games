import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN: str = os.environ.get("BOT_TOKEN", "")
WEBAPP_URL: str = os.environ.get("WEBAPP_URL", "http://localhost:8000")
SERVER_URL: str = os.environ.get("SERVER_URL", "http://localhost:8000")
