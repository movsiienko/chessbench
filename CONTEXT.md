# ChessBench

ChessBench compares model chess puzzle solving through reproducible benchmark runs and their recorded evidence.

## Language

**Item**: A benchmark puzzle with an initial position, expected forcing line, and source metadata.

**Attempt**: One model's sequence of turns on one item, stopping at the first wrong move, invalid answer, or provider error.

**Turn**: One request for the player's next move and the model's recorded answer and outcome; a correct turn can reveal the expected opponent reply.

**Solved**: An attempt in which every expected player move is correct and no turn fails.
_Avoid_: First-move accuracy (which measures only the first player move).

**Benchmark run**: One invocation evaluating the selected models on the selected items under one run identity and generation configuration.

**Canonical run**: A named, archived collection of real attempt records eligible to supply the published benchmark.
