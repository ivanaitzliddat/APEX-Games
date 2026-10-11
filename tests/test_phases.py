import unittest

from server.game_engine.ride_the_bus.deck import Card
from server.game_engine.ride_the_bus.phases import Phase, evaluate_phase


class PhaseRulesTest(unittest.TestCase):
    def test_red_black(self):
        self.assertTrue(evaluate_phase(Phase.RED_BLACK, "red", Card("K", "hearts"), []))
        self.assertFalse(evaluate_phase(Phase.RED_BLACK, "black", Card("K", "hearts"), []))

    def test_higher_lower_excludes_equal_rank(self):
        previous = [Card("7", "clubs")]
        self.assertTrue(evaluate_phase(Phase.HIGHER_LOWER, "higher", Card("8", "hearts"), previous))
        self.assertFalse(evaluate_phase(Phase.HIGHER_LOWER, "lower", Card("7", "spades"), previous))

    def test_between_outside_and_same(self):
        previous = [Card("3", "clubs"), Card("9", "hearts")]
        self.assertTrue(evaluate_phase(Phase.IN_BETWEEN, "between", Card("6", "spades"), previous))
        self.assertTrue(evaluate_phase(Phase.IN_BETWEEN, "outside", Card("K", "spades"), previous))
        self.assertTrue(evaluate_phase(Phase.IN_BETWEEN, "same", Card("3", "diamonds"), previous))
        self.assertFalse(evaluate_phase(Phase.IN_BETWEEN, "between", Card("3", "diamonds"), previous))

    def test_guess_suit(self):
        self.assertTrue(evaluate_phase(Phase.GUESS_SUIT, "spades", Card("A", "spades"), []))
        self.assertFalse(evaluate_phase(Phase.GUESS_SUIT, "hearts", Card("A", "spades"), []))


if __name__ == "__main__":
    unittest.main()
