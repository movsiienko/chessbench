# Chessbench

Chessbench is a benchmark workspace for evaluating model chess puzzle solving.

## Datasets

The first benchmark dataset is `lichess-puzzles-v1`, built from the public
Lichess puzzle database.

- Tracked benchmark items:
  `data/benchmarks/lichess-puzzles-v1/items.jsonl`
- Benchmark manifest:
  `data/benchmarks/lichess-puzzles-v1/manifest.json`
- Raw source download, ignored by git:
  `data/raw/lichess/lichess_db_puzzle.csv.zst`

The benchmark contains 500 puzzles, sampled deterministically as 100 puzzles
from each rating band: `<1200`, `1200-1599`, `1600-1999`, `2000-2399`, and
`2400+`.

Each item also carries granular benchmark strata:

- exact Lichess rating plus a 100-point `ratingBucket`
- solution move counts in plies, player moves, and opponent replies
- full Lichess `themes`, a derived `primaryTheme`, and broad `themeGroups`

The same strata are available as JSON indexes under
`data/benchmarks/lichess-puzzles-v1/indexes`.

## Dataset Commands

```bash
bun run datasets:lichess:download
bun run datasets:lichess:prepare
```

The preparation step validates trigger and solution moves with `chess.js`,
filters unstable or low-signal rows, excludes `mateIn1` puzzles to avoid
alternate checkmate ambiguity, and writes the benchmark JSONL plus manifest.

## Scoring

Use `scoreLichessPuzzleAnswer` from
`lib/benchmarks/lichess-puzzles.ts`.

The primary metric is `solved_rate`: an answer is solved when its extracted UCI
move sequence exactly matches either the full forcing line or the player-only
move line. Secondary metrics include first move accuracy, full-line prefix
score, and player-move prefix score.

## Local Benchmark Runs

Run local model benchmarks with AI SDK Gateway model IDs:

```bash
bun run benchmark:local -- --model openai/gpt-5-nano
```

The runner requires at least one `--model`. By default it evaluates a
deterministic 10-puzzle sample spread across rating bands. Use `--limit 50` for
a larger sample, or `--all` for the full 500-puzzle benchmark.

The local runner asks for one strict UCI move at a time. On a correct move, it
reveals only the expected opponent move and asks for the next move in the same
conversation. It stops a puzzle on the first wrong move, invalid format, or
provider error.

Every invocation writes a local CSV archive under ignored
`data/results/local/lichess-puzzles-v1/`. To also write tracked canonical
per-model snapshots, pass a canonical name:

```bash
bun run benchmark:local -- --model openai/gpt-5-nano --canonical sample
```

Canonical files are written as
`data/results/canonical/lichess-puzzles-v1/<model-id>-sample.csv`.
