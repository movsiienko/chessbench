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

`sampleLichessPuzzles` in `lib/benchmarks/lichess-puzzle-sampler.ts` owns
filtering, seeded membership, legality validation, and output order over a
stream of CSV lines. The CLI handles source decompression and file output.
Tests cover selection across input orders, illegal candidate replacement,
all 500 tracked items, and the preparation command's output and manifest.

## Scoring

Scoring lives in `lib/benchmarks/local-runner.ts`, one turn at a time
(`recordAnswer`, `recordFailure`).

The primary metric is `solved_rate`: a puzzle is solved when the model plays
every player move of the solution line correctly, one move per turn. The
attempt stops at the first wrong move, invalid format, exceeded move time limit
(270 seconds), or provider error, and only a completed line counts as solved.
Provider errors are pending, not results: scores exclude them and the next run
retries them. Secondary metrics include first move accuracy and player-move
prefix score.

## Benchmark Runs

Runs execute on Vercel Workflows (`lib/benchmarks/benchmark-workflow.ts`), one
step per turn, five attempts at a time. Start one through the admin endpoint:

```bash
curl -X POST https://<production-domain>/api/benchmark-runs \
  -H "Authorization: Bearer $BENCHMARK_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"models":["openai/gpt-5.5"],"items":{"limit":50},"reasoning":"low","dryRun":true}'
```

- `models`: Gateway IDs from `MODELS` in `lib/benchmarks/models.ts`.
- `items`: `{"limit": n}` for the deterministic sample spread across rating
  bands (a larger limit includes every smaller one), optionally narrowed with
  `"bands"`, or `{"ids": [...]}`.
- `reasoning`: a provider-neutral level (`provider-default`, `none`,
  `minimal`, `low`, `medium`, `high`, `xhigh`, `max`), sent as the AI SDK's
  `reasoning` option. Each provider maps it to its own control: an effort
  setting on effort-based models (Claude Opus 4.6+, GPT-5, Grok, Gemini 3) or
  a share of max output tokens on budget-based ones. Any provider warning
  about the mapping is recorded with the turn.
- `dryRun: true` returns `{toRun, skipped}` without starting anything.
  Otherwise the response is `202 {runId, toRun, skipped}`.

Each model and item is claimed in Postgres before the paid call, so items an
entry has already finished, or that another run is playing, are skipped. A
failed call is retried up to four times, after the provider's `retry-after` or
an exponential backoff; a request the provider rejects as invalid is not
retried. A turn still failing goes pending for the next run. Claims
left by a run that died are released after two hours. A finished run
regenerates the dashboard on the production domain.

The model is asked for exactly one legal move token at a time in UCI or
standard algebraic (SAN) notation, with no explanation or extra text. Accepted
answers are normalized to UCI for scoring. On a correct move, only the expected
opponent move is revealed and the next move is asked for in the same
conversation.

### Tests

`bun test` runs the unit tests. `bun x vitest run` runs the `*.integration.ts`
tests: workflows execute in-process on the Workflow SDK's local world against an
in-memory PGlite database migrated from `drizzle/`, with scripted models
installed as the AI SDK's default provider. `bun run test` runs both.

## Results Database

Attempts are recorded in Neon Postgres (schema in `lib/db/schema.ts`,
migrations in `drizzle/`). Vercel applies migrations before every build;
production and preview use `chessbench-db`, where each preview deployment gets
its own branch of production data. Local development uses the separate
`chessbench-dev-db`:

```bash
vercel env pull .env.local
set -a && . ./.env.local && set +a && bun run db:migrate
```

Generate a migration after editing the schema with `bun x drizzle-kit generate`.

## Dashboard Data

`app/page.tsx` is prerendered at build from Postgres: every current-protocol
model and reasoning level with finished attempts becomes a scoreboard entry
(`entriesFrom` in `lib/benchmarks/dashboard-build.ts`). The page carries attempt
summaries only; a transcript fetches its full record from
`/api/attempts/<id>`, which the CDN caches permanently. After new results land,
regenerate the page on the production domain:

```bash
curl -X POST https://<production-domain>/api/revalidate \
  -H "Authorization: Bearer $BENCHMARK_ADMIN_TOKEN"
```

## Dashboard Lab Logos

Dashboard model chips render lab marks that are **vendored into the repo** as
React components under `components/ui/svgs/`. Nothing is fetched from
svgl.app or models.dev at render time: a third-party request per logo per page
load leaves gaps whenever those hosts are slow, blocked or offline, and leaks
visitor traffic to hosts the visitor did not choose.

`LAB_SVGS` in `components/chessbench-dashboard.tsx` maps each `LabId` to a
label and a mark. A lab with no vendored mark may omit
`icon` and falls back to a monogram, which still never touches the network.

`LabId` is the provider prefix of a registry model's Gateway id, for example
`openai` from `openai/gpt-5.5`, so it covers only the labs of models in `MODELS`
(`lib/benchmarks/models.ts`), not the whole remote catalog.

Logo rules:

1. Prefer the exact brand mark from [SVGL](https://svgl.app/). Query
   `https://api.svgl.app?search=<lab>` or use the SVGL search UI.
2. Vendor it as a component in `components/ui/svgs/`, in the style of the files
   already there: a typed `SVGProps` component, no width/height, and
   `React.useId()` for any gradient, mask or filter id. Keep SVGL's light/dark
   pair when it publishes one and wire both into `icon`.
3. Marks stay the trademark of the lab they name and are used only to identify
   that lab's model.
4. Keep `LAB_SVGS` complete for every `LabId`. The mapping uses
   `satisfies Record<LabId, ...>`, so `bun run typecheck` fails when a registry
   model introduces a lab with no entry.
