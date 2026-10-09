# ChessBench

ChessBench compares model chess puzzle solving through reproducible benchmark runs and their recorded evidence.

## Language

**Item**: A benchmark puzzle with an initial position, expected forcing line, and source metadata.

**Attempt**: One model's sequence of turns on one item under one protocol and reasoning level, stopping at the first wrong move, invalid answer, exceeded move time limit, or provider error.

**Turn**: One request for the player's next move and the model's recorded answer and outcome; a correct turn can reveal the expected opponent reply.

**Solved**: An attempt in which every expected player move is correct and no turn fails.
_Avoid_: First-move accuracy (which measures only the first player move).

**Model**: A specific Gateway model, such as `anthropic/claude-opus-4.8`, identified by its Gateway ID.
_Avoid_: Short IDs such as `claude45`

**Protocol**: The benchmark-wide rules every attempt follows: prompt template, answer parsing and scoring, max output tokens, and move time limit. Changing any of them, including fixing a scoring bug, starts a fresh result set, and only current-protocol results are published.
_Avoid_: Configuration, settings

**Reasoning level**: The reasoning setting the provider actually receives, in that provider's terms (such as `low`, `max`, or `model-thinking`). Requested levels that reach the provider as the same setting are the same reasoning level.
_Avoid_: Requested effort

**Move time limit**: The protocol's longest time a model may take to answer one turn. Exceeding it fails the turn like a wrong move.

**Pending attempt**: An attempt that ended in a provider error. It is not a result: scores exclude it and later benchmark runs retry it.

**Benchmark run**: One request to evaluate selected models on selected items at a requested reasoning level under the current protocol. It runs only the items each model has no finished attempt for on the same dataset, protocol, and reasoning level.

**Entry**: One model at one reasoning level on the scoreboard, scored on every item it has a finished attempt for under the current protocol. Each item contributes a single attempt. Entries may cover different item sets and show their item count.
_Avoid_: Canonical run

**Attempt evidence**: The recorded turns, outcomes, reasoning, usage, and provenance of an attempt, shared by its summary, transcript, and download. A later failed turn does not make an earlier correct move wrong.

**Seeded sample**: The items with the lowest SHA-256 hashes of `seed:PuzzleId` in each rating band, after quality filters and complete line legality checks. The sampler owns membership and output order; changing source order does not change the selected items. Legality checks run only for competitive candidates, so build and illegal-rejection counts describe work performed in source order.
