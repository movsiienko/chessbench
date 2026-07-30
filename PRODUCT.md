# Product

<!-- impeccable:product-schema 1 -->

## Register

product

## Platform

web

## Users

ChessBench serves developers, researchers, and model evaluators who need to compare how language models solve chess puzzles. They are usually reviewing benchmark results, inspecting individual puzzle failures, or preparing local benchmark runs, and they need dense evidence that remains legible during repeated analysis sessions.

ChessBench is built as a public benchmark that other people cite. Visitors arrive to read a number, judge whether they can trust it, and link or quote it elsewhere, so the published result and the evidence behind it are the product, not an internal convenience.

## Product Purpose

ChessBench evaluates model chess puzzle solving against a deterministic Lichess-derived benchmark. Success means users can understand leaderboard performance, inspect puzzle-level behavior, reproduce runs locally, and trust the benchmark methodology without fighting the interface.

## Positioning

ChessBench publishes puzzle-level evidence, not just scores. Every leaderboard number drills down into the actual position, the move each model played, its transcript, and its thinking time and token cost, so a failure is inspectable rather than aggregate. A competing benchmark can copy a solved-rate table; it cannot copy the evidence trail unless it also records and publishes per-puzzle model behavior.

Supporting mechanisms, already true in the repository and available to state factually: the sample is seeded and stratified (100 puzzles from each of five rating bands, with rating, theme, and move-count indexes), and the local runner drives puzzles one move at a time, revealing the expected opponent reply after each correct move and stopping on the first wrong or invalid move.

## Operating Context

- The published surface is a single-route dashboard with three sections: Leaderboard (aggregate comparison, charts, results table), Problems (puzzle browser with filters and a focused board, model attempts, and transcripts), and Docs (methodology and scoring).
- Analysis is comparative and repetitive: users scan across models, then drop into one puzzle, then return. The same screens are revisited many times in a session.
- Benchmark runs happen offline via Bun scripts, not in the browser. Results reach the dashboard as tracked canonical CSVs that a build step compiles into generated dashboard data.
- Reproduction is part of the workflow: a reader who distrusts a number is expected to be able to run the dataset preparation and benchmark commands themselves.
- Chess positions are real board state. Move feedback, last moves, and corrections are spatial facts about the board, not text notifications.

## Capabilities and Constraints

- Web app on Next.js 16 / React 19 with Tailwind v4, shadcn/Base UI primitives, Recharts for charts, and Chessground for boards. Geist and Geist Mono are the typefaces in use.
- Dashboard data is generated (`lib/benchmarks/dashboard-data.ts` from `scripts/build-dashboard-data.ts`) and must not be hand-edited; the interface consumes whatever models, themes, and labs the canonical results contain.
- The current dataset is `lichess-puzzles-v1`: 500 puzzles, quality-filtered, `mateIn1` excluded to avoid alternate-mate ambiguity. Dataset identity is versioned, so the interface should not hard-code a single dataset as permanent.
- The primary metric is `solved_rate`, an exact match against either the full forcing line or the player-only move line. Secondary metrics are first-move accuracy, full-line prefix score, and player-move prefix score.
- Model lab identity comes from models.dev, with logo routes preferring SVGL; the lab mapping is type-checked so a new lab id fails the build rather than rendering blank.
- Terminology to use consistently: puzzle, item, attempt, solved rate, rating band, theme, ply, FEN, UCI, SAN, canonical run, lab, model.

**Binding product fact: results are real runs only.** Every figure shown comes from tracked canonical CSVs of actual model runs. Illustrative, sampled, projected, or placeholder numbers must never appear in the interface, including in empty states, examples, and screenshots.

## Brand Commitments

- Name and wordmark: ChessBench.
- Personality: restrained, precise, analytical. The product should feel like a quiet benchmark lab — confident, evidence-led, and focused on the board, the model attempt, and the measured result.
- Model brand color and lab marks belong to model identity only. Provider colors are never page-level accents.
- Chess spatial truth is binding: board position, move feedback, and correction arrows stay connected to the board rather than being abstracted into disconnected UI copy.
- Familiar controls are preferred over novelty: standard tabs, filters, tables, and charts.
- Anti-references: generic AI dashboard chrome, decorative gradients, glassmorphism, oversized marketing composition, gamified leaderboard noise, and chess-themed ornament that competes with the actual board.

## Evidence on Hand

- Benchmark dataset: `data/benchmarks/lichess-puzzles-v1/items.jsonl`, `manifest.json`, and `indexes/` (by rating bucket, player move count, solution ply count, primary theme, theme).
- Real model results: tracked canonical CSVs in `data/results/canonical/lichess-puzzles-v1/` across OpenAI, Anthropic, Google, DeepSeek, xAI, Alibaba, Meta, and MiniMax models, plus run logs in `data/results/logs/`.
- Source: the Lichess puzzle database, CC0, with page URL, download URL, checksum, and retrieval dates recorded in the manifest. Attribution and license must stay accurate.
- Scoring implementation and tests: `lib/benchmarks/lichess-puzzles.ts`, `lib/benchmarks/local-runner.ts`, with accompanying test files.
- Lab logo assets: `components/ui/svgs/`.
- Absent, and not to be fabricated: testimonials, named users or adopters, usage statistics, press, funding, pricing, a public deployment URL, or any claim of third-party endorsement.

## Product Principles

- **Evidence before decoration.** Every element should help a visitor compare models, inspect a puzzle, or understand scoring. Anything that does neither is removable.
- **Publish for the skeptic.** The reader who doubts a number is the primary reader. Methodology, sample boundaries, dataset version, and caveats must be reachable from wherever a score is shown.
- **A score is a doorway.** Aggregate figures should always lead to the underlying puzzle, move, and transcript rather than terminating in a summary.
- **Analytical calm under density.** The interface must stay quiet across long, repeated review sessions; density is fine, noise is not.
- **Only measured truth.** Show what was actually run, with its real caveats, and state absence rather than filling gaps with plausible-looking numbers.

## Accessibility & Inclusion

Target WCAG AA as the baseline. Maintain sufficient text and chart contrast, full keyboard operability for controls, visible focus states, reduced-motion alternatives, and non-color-only encodings for model results, move correctness, and chart series.
