import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from server.database import init_db
from server.routers import rooms, ws
from server.routers import users
from server.routers import feedback

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database tables on startup."""
    try:
        await init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        logger.warning("Server starting without database - DB features will be unavailable")
    logger.info("APEX Games server started")
    yield


app = FastAPI(title="APEX Games", lifespan=lifespan)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


app.include_router(rooms.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(feedback.router, prefix="/api")
app.include_router(ws.router)

# Serve frontend static files (must be last - catches all unmatched routes)
frontend_path = Path(__file__).parent.parent / "frontend"
app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")
