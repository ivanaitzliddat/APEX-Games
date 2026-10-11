# APEX Games

A browser and Telegram-connected multiplayer card-game prototype. A FastAPI server manages rooms and WebSocket game events; a small browser frontend shows players, cards, and results. The implemented game is **Ride the Bus**, a four-phase card guessing game.

## Status

The source demonstrates room state, observer/player views, and a Telegram bot bridge. It is a prototype, not a hosted production game. Browser room actions currently use client-supplied player identifiers, so deploy only for a trusted group until stronger room authentication and rate limits are added. The optional database stores users and feedback; the core room state is in memory and is lost when the server restarts.

## Run locally

Requires Python 3.11 or newer. Create a virtual environment, install `requirements.txt`, and start the API:

```sh
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python run_server.py
```

Open `http://127.0.0.1:8000`. Without PostgreSQL, database-backed features are unavailable. For Telegram integration, copy `.env.example` to `.env`, set a bot token and public Mini App URL, and run `python run_all.py`. Never commit a real token.

## Verify the game rules

```sh
python -m unittest discover -s tests
```

The tests cover the four phase decisions and equal-rank boundaries. Live multi-device WebSocket and Telegram behavior needs a separate integration test.

## Code map

- `server/game_engine/` — game registry and Ride the Bus rules
- `server/routers/` — rooms, WebSockets, users, feedback
- `frontend/` — browser experience
- `bot/` — Telegram commands
