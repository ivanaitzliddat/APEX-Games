import random
from dataclasses import dataclass

SUITS = ["hearts", "diamonds", "clubs", "spades"]
RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]
RANK_VALUES = {r: i for i, r in enumerate(RANKS, start=2)}

SUIT_EMOJI = {
    "hearts": "\u2665",
    "diamonds": "\u2666",
    "clubs": "\u2663",
    "spades": "\u2660",
}

RED_SUITS = {"hearts", "diamonds"}
BLACK_SUITS = {"clubs", "spades"}


@dataclass
class Card:
    rank: str
    suit: str

    @property
    def value(self) -> int:
        return RANK_VALUES[self.rank]

    @property
    def color(self) -> str:
        return "red" if self.suit in RED_SUITS else "black"

    def to_dict(self) -> dict:
        return {
            "rank": self.rank,
            "suit": self.suit,
            "color": self.color,
            "value": self.value,
            "display": f"{self.rank}{SUIT_EMOJI[self.suit]}",
        }


class Deck:
    def __init__(self):
        self.cards: list[Card] = [
            Card(rank=r, suit=s) for s in SUITS for r in RANKS
        ]
        random.shuffle(self.cards)

    def draw(self) -> Card:
        return self.cards.pop()

    @property
    def remaining(self) -> int:
        return len(self.cards)
