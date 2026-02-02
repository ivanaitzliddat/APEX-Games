from server.game_engine.base import BaseGame


class GameRegistry:
    _games: dict[str, type[BaseGame]] = {}

    @classmethod
    def register(cls, game_cls: type[BaseGame]):
        cls._games[game_cls.game_id] = game_cls

    @classmethod
    def get(cls, game_id: str) -> type[BaseGame] | None:
        return cls._games.get(game_id)

    @classmethod
    def list_games(cls) -> list[dict]:
        return [
            {
                "id": gid,
                "name": gcls.display_name,
                "description": gcls.description,
                "min_players": gcls.min_players,
                "max_players": gcls.max_players,
            }
            for gid, gcls in cls._games.items()
        ]
