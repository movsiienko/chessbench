# Lichess Puzzles v1

This benchmark samples 500 chess tactics from the Lichess puzzle database.

## Source

- Page: https://database.lichess.org/#puzzles
- Download: https://database.lichess.org/lichess_db_puzzle.csv.zst
- License: Creative Commons CC0
- Page update recorded locally: `2026-05-02`
- Download `Last-Modified` recorded locally: `2026-05-01T09:33:23Z`
- Raw SHA-256:
  `5e85389530799a720c2899ce8003ee5b7406f70091e7f20e31b6cb688aeb25b4`

The source CSV columns are:

```text
PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
```

The downloaded source file contains `5,939,980` puzzle rows plus a header row.

## Selection

The benchmark is deterministic. The preparation script keeps the smallest
SHA-256 sample keys for each rating band using seed `lichess-puzzles-v1`.

Quality filters:

- `RatingDeviation <= 110`
- `Popularity >= 80`
- `NbPlays >= 300`
- Exclude `mateIn1`
- Validate the Lichess setup move and every solution move with `chess.js`

Rating bands:

- `under-1200`: 100 items
- `1200-1599`: 100 items
- `1600-1999`: 100 items
- `2000-2399`: 100 items
- `2400-plus`: 100 items

The manifest also records 100-point rating buckets, move-count distributions,
primary-theme counts, and theme-group counts.

## Item Shape

Each line in `items.jsonl` is one benchmark item:

```ts
{
  id: string
  benchmark: "lichess-puzzles-v1"
  position: {
    triggerFen: string
    triggerMove: string
    fen: string
    sideToMove: "w" | "b"
  }
  expected: {
    uciLine: string[]
    playerUciMoves: string[]
    finalFen: string
  }
  metadata: {
    lichessPuzzleId: string
    lichessGameUrl: string
    rating: number
    ratingDeviation: number
    popularity: number
    nbPlays: number
    ratingBand: string
    ratingBucket: string
    length: "short" | "long" | "veryLong" | "unknown"
    moveCounts: {
      solutionPlies: number
      playerMoves: number
      opponentReplies: number
    }
    primaryTheme: string
    themeGroups: string[]
    themes: string[]
    openingTags: string[]
  }
}
```

`position.fen` is the board after applying the first Lichess CSV move to
`position.triggerFen`. `expected.uciLine` is the complete forcing line from that
position. `expected.playerUciMoves` keeps only the moves made by the side to
move.

Prompt text is not stored in the dataset. Benchmark runners build prompts at
runtime from `position.fen` and record the prompt template used in result rows.

Granular fields:

- `metadata.rating` is the exact Lichess puzzle rating.
- `metadata.ratingBucket` is a zero-padded 100-point bucket, for example
  `1700-1799`.
- `metadata.moveCounts.solutionPlies` is the full expected line length after the
  setup move.
- `metadata.moveCounts.playerMoves` is the number of moves the solving side must
  find.
- `metadata.moveCounts.opponentReplies` is the number of forced opponent replies
  included in the line.
- `metadata.primaryTheme` chooses the most specific tactical, endgame,
  checkmate, attack, defense, material, or special-move theme available, falling
  back to broad outcomes like `advantage` or `crushing`.
- `metadata.themes` preserves the full Lichess theme list.
- `metadata.themeGroups` normalizes themes into broad groups such as `tactic`,
  `checkmate`, `endgame`, `attack`, `defense`, `material`, `positional`, and
  `special`.

## Indexes

The `indexes` directory contains item-id indexes for common benchmark slices:

- `by-rating-bucket.json`
- `by-player-move-count.json`
- `by-solution-ply-count.json`
- `by-primary-theme.json`
- `by-theme.json`

## Scoring

The local runner asks for one UCI move at a time. If the model gives the correct
move and the puzzle continues, the runner reveals the expected opponent reply in
the same conversation and asks for the next move.

The scorer extracts UCI tokens and reports:

- `solved`: exact match against `expected.uciLine` or
  `expected.playerUciMoves`
- `firstMoveCorrect`: first extracted move matches the first expected player
  move
- `fullLinePrefixScore`: correct leading plies divided by full line length
- `playerMovePrefixScore`: correct leading player moves divided by player move
  count

The implementation lives in `lib/benchmarks/lichess-puzzles.ts`.

## Rebuild

```bash
bun run datasets:lichess:download
bun run datasets:lichess:prepare
```
