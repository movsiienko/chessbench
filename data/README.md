# Data

`data/benchmarks/lichess-puzzles` is the tracked puzzle set: `items.jsonl`,
`manifest.json`, and a README on how it was built.

`data/results/canonical` keeps historical result files from runs made before
results moved to Postgres, with the `items.jsonl` of the puzzles they ran on.
The dashboard does not read them.

`data/raw` contains downloaded upstream source files and is intentionally
ignored by git. Recreate raw files with the dataset download scripts.
