from server.game_engine.base import BaseGame
from server.game_engine.ride_the_bus.deck import Deck
from server.game_engine.ride_the_bus.phases import (
    Phase,
    PHASE_NAMES,
    PHASE_OPTIONS,
    DRINK_PENALTIES,
    evaluate_phase,
)
from server.models.events import EventType, make_event


class RideTheBusGame(BaseGame):
    game_id = "ride_the_bus"
    display_name = "Ride the Bus"
    min_players = 2
    max_players = 20
    description = "4-phase card guessing game. Survive all 4 rounds to win!"

    def __init__(self, room):
        super().__init__(room)
        self.deck = Deck()
        self.phase = Phase.RED_BLACK
        self.alive_players: set[int] = set(room.players.keys())
        self.eliminated_players: set[int] = set()
        self.phase_choices: dict[int, str] = {}
        self.revealed_cards: list[dict] = []
        self.drink_totals: dict[int, int] = {pid: 0 for pid in room.players}
        self.winners: list[int] = []

    async def initialize(self) -> dict:
        return make_event(
            EventType.PHASE_START,
            phase=int(self.phase),
            phase_name=PHASE_NAMES[self.phase],
            options=PHASE_OPTIONS[self.phase],
            revealed_cards=self.revealed_cards,
            alive_players=list(self.alive_players),
            total_players=len(self.room.players),
        )

    async def handle_action(self, player_id: int, action: dict) -> list[dict]:
        choice = action.get("choice")
        if not choice:
            return [make_event(EventType.ERROR, message="No choice provided")]

        if self.phase == Phase.FINISHED:
            return [make_event(EventType.ERROR, message="Game is already over")]

        if player_id not in self.alive_players:
            return [make_event(EventType.ERROR, message="You are eliminated")]

        valid_options = PHASE_OPTIONS.get(self.phase, [])
        if choice not in valid_options:
            return [make_event(EventType.ERROR, message=f"Invalid choice: {choice}")]

        if player_id in self.phase_choices:
            return [make_event(EventType.ERROR, message="You already locked in")]

        self.phase_choices[player_id] = choice

        events = []

        # Notify host that player locked in
        events.append(
            make_event(
                EventType.PLAYER_LOCKED,
                player_id=player_id,
                player_name=self.room.players[player_id].name,
                locked_count=len(self.phase_choices),
                total_alive=len(self.alive_players),
                _host_only=True,
            )
        )

        # Check if all alive players have made their choice
        if len(self.phase_choices) >= len(self.alive_players):
            events.extend(self._resolve_phase())

        return events

    def _resolve_phase(self) -> list[dict]:
        events = []

        card = self.deck.draw()
        card_dict = card.to_dict()
        self.revealed_cards.append(card_dict)

        previous_cards_objs = []
        for c in self.revealed_cards[:-1]:
            from server.game_engine.ride_the_bus.deck import Card
            previous_cards_objs.append(Card(rank=c["rank"], suit=c["suit"]))

        results = []
        newly_eliminated = []
        phase_survivors = []

        for pid in list(self.alive_players):
            choice = self.phase_choices.get(pid, "")
            correct = evaluate_phase(self.phase, choice, card, previous_cards_objs)
            player_name = self.room.players[pid].name

            result = {
                "player_id": pid,
                "player_name": player_name,
                "choice": choice,
                "correct": correct,
            }

            if not correct:
                newly_eliminated.append(pid)
                if self.room.drinks_mode:
                    penalty = DRINK_PENALTIES.get(self.phase, 0)
                    if isinstance(penalty, int):
                        self.drink_totals[pid] = self.drink_totals.get(pid, 0) + penalty
                        result["drink_penalty"] = f"Take {penalty} sip{'s' if penalty > 1 else ''}!"
                    else:
                        result["drink_penalty"] = "Finish your drink!"
            else:
                phase_survivors.append(pid)

            results.append(result)

        events.append(
            make_event(
                EventType.CARD_REVEALED,
                card=card_dict,
                phase=int(self.phase),
                phase_name=PHASE_NAMES[self.phase],
                results=results,
                drinks_mode=self.room.drinks_mode,
            )
        )

        for pid in newly_eliminated:
            self.alive_players.discard(pid)
            self.eliminated_players.add(pid)

        if newly_eliminated:
            events.append(
                make_event(
                    EventType.ELIMINATION,
                    eliminated=[
                        {"player_id": pid, "player_name": self.room.players[pid].name}
                        for pid in newly_eliminated
                    ],
                    remaining_count=len(self.alive_players),
                )
            )

        self.phase_choices = {}

        if len(self.alive_players) == 0 or self.phase == Phase.GUESS_SUIT:
            self._end_game()
            events.append(self._game_over_event())
        else:
            self.phase = Phase(int(self.phase) + 1)
            events.append(
                make_event(
                    EventType.PHASE_START,
                    phase=int(self.phase),
                    phase_name=PHASE_NAMES[self.phase],
                    options=PHASE_OPTIONS[self.phase],
                    revealed_cards=self.revealed_cards,
                    alive_players=list(self.alive_players),
                    total_players=len(self.room.players),
                )
            )

        return events

    def _end_game(self):
        self.winners = list(self.alive_players)
        self.phase = Phase.FINISHED

    def _game_over_event(self) -> dict:
        final_standings = []
        for pid, player in self.room.players.items():
            final_standings.append(
                {
                    "player_id": pid,
                    "player_name": player.name,
                    "is_winner": pid in self.winners,
                    "drinks": self.drink_totals.get(pid, 0),
                }
            )

        return make_event(
            EventType.GAME_OVER,
            winners=[
                {"player_id": pid, "player_name": self.room.players[pid].name}
                for pid in self.winners
            ],
            final_standings=final_standings,
            drinks_mode=self.room.drinks_mode,
        )

    def get_state_for_player(self, player_id: int) -> dict:
        return {
            "phase": int(self.phase),
            "phase_name": PHASE_NAMES[self.phase],
            "options": PHASE_OPTIONS.get(self.phase, []),
            "revealed_cards": self.revealed_cards,
            "is_alive": player_id in self.alive_players,
            "has_chosen": player_id in self.phase_choices,
            "alive_count": len(self.alive_players),
            "total_players": len(self.room.players),
            "drinks_mode": self.room.drinks_mode,
            "my_drinks": self.drink_totals.get(player_id, 0),
            "is_finished": self.is_finished(),
            "winners": [
                {"player_id": pid, "player_name": self.room.players[pid].name}
                for pid in self.winners
            ] if self.is_finished() else [],
        }

    def get_state_for_observer(self) -> dict:
        players_status = []
        for pid, player in self.room.players.items():
            players_status.append(
                {
                    "player_id": pid,
                    "player_name": player.name,
                    "is_alive": pid in self.alive_players,
                    "has_chosen": pid in self.phase_choices,
                    "drinks": self.drink_totals.get(pid, 0),
                }
            )

        return {
            "phase": int(self.phase),
            "phase_name": PHASE_NAMES[self.phase],
            "options": PHASE_OPTIONS.get(self.phase, []),
            "revealed_cards": self.revealed_cards,
            "players": players_status,
            "alive_count": len(self.alive_players),
            "locked_count": len(self.phase_choices),
            "total_players": len(self.room.players),
            "drinks_mode": self.room.drinks_mode,
            "is_finished": self.is_finished(),
            "winners": [
                {"player_id": pid, "player_name": self.room.players[pid].name}
                for pid in self.winners
            ] if self.is_finished() else [],
        }

    def is_finished(self) -> bool:
        return self.phase == Phase.FINISHED
