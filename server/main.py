from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from server.routers import rooms, ws

app = FastAPI(title="APEX Games")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


app.include_router(rooms.router, prefix="/api")
app.include_router(ws.router)

# Serve frontend static files (must be last - catches all unmatched routes)
frontend_path = Path(__file__).parent.parent / "frontend"
app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")
