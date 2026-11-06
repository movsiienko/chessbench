# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

ChessBench serves developers, researchers, and model evaluators who need to compare how language models solve chess puzzles. They are usually reviewing benchmark results, inspecting individual puzzle failures, or preparing local benchmark runs, and they need dense evidence that remains legible during repeated analysis sessions.

ChessBench is built as a public benchmark that other people cite. Visitors arrive to read a number, judge whether they can trust it, and link or quote it elsewhere, so the published result and the evidence behind it are the product, not an internal convenience.

## Product Purpose

ChessBench evaluates model chess puzzle solving against a deterministic Lichess-derived benchmark. Success means users can understand leaderboard performance, inspect puzzle-level behavior, reproduce runs locally, and trust the benchmark methodology without fighting the interface.

## Positioning

ChessBench publishes puzzle-level evidence, not just scores. Every leaderboard number drills down into the actual position, the move each model played, its transcript, and its thinking time and token cost, so a failure is inspectable rather than aggregate. A competing benchmark can copy a solved-rate table; it cannot copy the evidence trail unless it also records and publishes per-puzzle model behavior.

Supporting mechanisms, already true in the repository and available to state factually: the sample is seeded and stratified (100 puzzles from each of five rating bands), and the runner drives puzzles one move at a time, revealing the expected opponent reply after each correct move and stopping on the first wrong, illegal, or invalid-format move, or a move over the 270-second time limit.

## Operating Context

- The published surface is a dashboard with three sections, each its own route: Leaderboard (`/`: aggregate comparison, charts, results table), Problems (`/puzzles`, with `/puzzles/[id]` for one puzzle: filters, a focused board, model attempts, and transcripts), and Docs (`/docs`: a short About page on methodology and scoring). Each puzzle tag links to the Problems list filtered by that theme (`/puzzles?theme=<tag>`); old `/tags/<tag>` links redirect there. Filters and the open model trace live in the query string, so any view can be linked.
- Analysis is comparative and repetitive: users scan across models, then drop into one puzzle, then return. The same screens are revisited many times in a session.
- Benchmark runs execute on Vercel Workflows, started from a GitHub Actions dispatch or the admin `/api/benchmark-runs` endpoint, not from the browser. Each attempt is recorded in Neon Postgres. The dashboard is prerendered from Postgres at build and regenerated through `/api/revalidate` after a run finishes.
- Reproduction is part of the workflow: a reader who distrusts a number can rebuild the dataset with the Bun preparation commands and read the scorer, prompt, and tests in the repository.
- Chess positions are real board state. Move feedback, last moves, and corrections are spatial facts about the board, not text notifications.

## Capabilities and Constraints

- Web app on Next.js 16 / React 19 with Tailwind v4, shadcn/Base UI primitives, Recharts for charts, and Chessground for boards. Geist and Geist Mono are the typefaces in use.
- Dashboard data is built from Postgres when the pages are prerendered or revalidated (`lib/benchmarks/dashboard-load.ts`, `lib/benchmarks/dashboard-build.ts`). The interface shows whatever models, reasoning levels, themes, and labs the current-protocol results contain.
- The current dataset is `lichess-puzzles-v1`: 500 puzzles, quality-filtered, `mateIn1` excluded to avoid alternate-mate ambiguity. Dataset identity is versioned, so the interface should not hard-code a single dataset as permanent.
- The primary metric is `solved_rate`: an attempt is solved when every player move matches the expected player-only move line and no turn fails. Opponent replies are revealed, not scored. Secondary metrics are first-move accuracy and player-move prefix score; the leaderboard also shows the share of legal answers, plus illegal-move and invalid-format counts.
- Model lab identity is the provider prefix of the Gateway model id, with vendored SVGL logos; the lab mapping is type-checked so a new lab id fails the build rather than rendering blank.
- Terminology to use consistently (see `CONTEXT.md`): puzzle, item, attempt, turn, entry, solved rate, pending attempt, reasoning level, protocol, rating band, theme, ply, FEN, UCI, SAN, lab, model.

**Binding product fact: results are real runs only.** Every figure shown comes from attempts of actual model runs recorded in Postgres. Illustrative, sampled, projected, or placeholder numbers must never appear in the interface, including in empty states, examples, and screenshots.

## Brand Commitments

- Name and wordmark: ChessBench.
- Personality: restrained, precise, analytical. The product should feel like a quiet benchmark lab — confident, evidence-led, and focused on the board, the model attempt, and the measured result.
- Model brand color and lab marks belong to model identity only. Provider colors are never page-level accents.
- Chess spatial truth is binding: board position, move feedback, and a shown solution stay connected to the board rather than being abstracted into disconnected UI copy.
- Familiar controls are preferred over novelty: standard tabs, filters, tables, and charts.
- Anti-references: generic AI dashboard chrome, decorative gradients, glassmorphism, oversized marketing composition, gamified leaderboard noise, and chess-themed ornament that competes with the actual board.

## Evidence on Hand

- Benchmark dataset: `data/benchmarks/lichess-puzzles-v1/items.jsonl` and `manifest.json`.
- Real model results: attempts in Neon Postgres (schema in `lib/db/schema.ts`), for the models in `MODELS` (`lib/benchmarks/models.ts`): OpenAI, Anthropic, Google, DeepSeek, xAI, and Alibaba. The first published results were imported by migration `drizzle/0001_import-published-results.sql`; the CSVs in `data/results/canonical/lichess-puzzles-v1/` are historical runs kept for reference and are not read by the dashboard.
- Source: the Lichess puzzle database, CC0, with page URL, download URL, checksum, and retrieval dates recorded in the manifest. Attribution and license must stay accurate.
- Scoring implementation and tests: `lib/benchmarks/lichess-puzzles.ts`, `lib/benchmarks/local-runner.ts`, and the run workflow `lib/benchmarks/benchmark-workflow.ts`, with accompanying test files.
- Public deployment: the production Vercel deployment of this repository.
- Lab logo assets: `components/ui/svgs/`.
- Absent, and not to be fabricated: testimonials, named users or adopters, usage statistics, press, funding, pricing, or any claim of third-party endorsement.

## Product Principles

- **Evidence before decoration.** Every element should help a visitor compare models, inspect a puzzle, or understand scoring. Anything that does neither is removable.
- **Publish for the skeptic.** The reader who doubts a number is the primary reader. Methodology, sample boundaries, dataset version, and caveats must be reachable from wherever a score is shown.
- **A score is a doorway.** Aggregate figures should always lead to the underlying puzzle, move, and transcript rather than terminating in a summary.
- **Analytical calm under density.** The interface must stay quiet across long, repeated review sessions; density is fine, noise is not.
- **Only measured truth.** Show what was actually run, with its real caveats, and state absence rather than filling gaps with plausible-looking numbers.

## Accessibility & Inclusion

Target WCAG AA as the baseline. Maintain sufficient text and chart contrast, full keyboard operability for controls, visible focus states, reduced-motion alternatives, and non-color-only encodings for model results, move correctness, and chart series.
