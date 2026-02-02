from enum import IntEnum
from server.game_engine.ride_the_bus.deck import Card


class Phase(IntEnum):
    RED_BLACK = 1
    HIGHER_LOWER = 2
    IN_BETWEEN = 3
    GUESS_SUIT = 4
    FINISHED = 5


PHASE_NAMES = {
    Phase.RED_BLACK: "Red or Black",
    Phase.HIGHER_LOWER: "Higher or Lower",
    Phase.IN_BETWEEN: "In Between or Outside",
    Phase.GUESS_SUIT: "Guess the Suit",
    Phase.FINISHED: "Finished",
}

PHASE_OPTIONS = {
    Phase.RED_BLACK: ["red", "black"],
    Phase.HIGHER_LOWER: ["higher", "lower"],
    Phase.IN_BETWEEN: ["between", "outside", "same"],
    Phase.GUESS_SUIT: ["hearts", "diamonds", "clubs", "spades"],
}

DRINK_PENALTIES = {
    Phase.RED_BLACK: 1,
    Phase.HIGHER_LOWER: 2,
    Phase.IN_BETWEEN: 3,
    Phase.GUESS_SUIT: "finish your drink",
}


def evaluate_phase(phase: Phase, choice: str, drawn_card: Card, previous_cards: list[Card]) -> bool:
    """Evaluate whether a player's choice is correct for the given phase."""
    if phase == Phase.RED_BLACK:
        return drawn_card.color == choice

    elif phase == Phase.HIGHER_LOWER:
        prev_value = previous_cards[0].value
        if choice == "higher":
            return drawn_card.value > prev_value
        else:
            return drawn_card.value < prev_value

    elif phase == Phase.IN_BETWEEN:
        v1 = previous_cards[0].value
        v2 = previous_cards[1].value
        lo, hi = min(v1, v2), max(v1, v2)
        card_val = drawn_card.value

        if choice == "between":
            return lo < card_val < hi
        elif choice == "outside":
            return card_val < lo or card_val > hi
        else:  # same
            return card_val == lo or card_val == hi

    elif phase == Phase.GUESS_SUIT:
        return drawn_card.suit == choice

    return False
