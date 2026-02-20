import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN: str = os.environ.get("BOT_TOKEN", "")
WEBAPP_URL: str = os.environ.get("WEBAPP_URL", "http://localhost:8000")
SERVER_URL: str = os.environ.get("SERVER_URL", "http://localhost:8000")
_raw_db_url: str = os.environ.get("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/apex_games")
# Fly.io provides postgres:// but SQLAlchemy asyncpg requires postgresql+asyncpg://
DATABASE_URL: str = _raw_db_url.replace("postgres://", "postgresql+asyncpg://", 1)
