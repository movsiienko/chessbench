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

## Dataset Commands

```bash
bun run datasets:lichess:download
bun run datasets:lichess:prepare
```

The preparation step validates trigger and solution moves with `chess.js`,
filters unstable or low-signal rows, excludes `mateIn1` puzzles to avoid
alternate checkmate ambiguity, and writes the benchmark JSONL plus manifest.

## Scoring

Scoring lives in `runLichessPuzzleAttempt` in `lib/benchmarks/local-runner.ts`
and runs as part of `bun run benchmark:local`.

The primary metric is `solved_rate`: a puzzle is solved when the model plays
every player move of the solution line correctly, one move per turn. The
attempt stops at the first wrong move, invalid format, or provider error, and
only a completed line counts as solved. Secondary metrics include first move
accuracy and player-move prefix score.

## Local Benchmark Runs

Run local model benchmarks with AI SDK Gateway model IDs:

```bash
bun run benchmark:local -- --model openai/gpt-5-nano
```

The runner requires at least one `--model`. By default it evaluates a
deterministic 10-puzzle sample spread across rating bands. Use `--limit 50` for
a larger sample, or `--all` for the full 500-puzzle benchmark.

The local runner asks for exactly one legal move token at a time in UCI or
standard algebraic (SAN) notation, with no explanation or extra text. It
normalizes accepted answers to UCI for scoring. On a correct move, it reveals
only the expected opponent move and asks for the next move in the same
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

## Dashboard Lab Logos

Dashboard model chips render lab marks that are **vendored into the repo** as
React components under `components/ui/svgs/`. Nothing is fetched from
svgl.app or models.dev at render time: a third-party request per logo per page
load leaves gaps whenever those hosts are slow, blocked or offline, and leaks
visitor traffic to hosts the visitor did not choose.

`LAB_SVGS` in `components/chessbench-dashboard.tsx` maps each generated
`DashboardLabId` to a label and a mark. A lab with no vendored mark may omit
`icon` and falls back to a monogram, which still never touches the network.

`DashboardModel.lab` is the provider prefix of the model's Gateway id, for
example `openai` from `openai/gpt-5.5`.

The emitted `DashboardLabId` union covers only the labs the configured models
belong to, not the whole remote catalog, so a lab added upstream cannot rewrite
the generated file or break `bun run typecheck`.

Logo rules:

1. Prefer the exact brand mark from [SVGL](https://svgl.app/). Query
   `https://api.svgl.app?search=<lab>` or use the SVGL search UI.
2. Vendor it as a component in `components/ui/svgs/`, in the style of the files
   already there: a typed `SVGProps` component, no width/height, and
   `React.useId()` for any gradient, mask or filter id. Keep SVGL's light/dark
   pair when it publishes one and wire both into `icon`.
3. Marks stay the trademark of the lab they name and are used only to identify
   that lab's model.
4. Keep `LAB_SVGS` complete for every generated `DashboardLabId`. The mapping
   uses `satisfies Record<DashboardLabId, ...>`, so `bun run typecheck` fails
   when a benchmarked model introduces a lab with no entry.

Current mappings: `gpt5` -> OpenAI, `claude45` -> Anthropic, `gem25` ->
Google, `ds35` -> DeepSeek, `grok4` -> xAI, and `qwen3` -> Alibaba (Qwen mark).
