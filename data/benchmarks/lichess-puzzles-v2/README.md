# Lichess Puzzles v2

500 Lichess puzzles, 100 per rating band, from games played on or after
2026-06-01T00:00:00Z (UTC). `manifest.json` records the exact provenance,
filters and counts; this file explains them.

## Why

Every v2 puzzle comes from a game created after June 1, 2026, so the set is
held out by game date. That is not proof the puzzles are absent from a model's
training data:

- Mistral Large 4's training data was collected through September 2026
  ([public summary](https://legal.mistral.ai/documents/Mistral%20Large%204%20-%20Public%20Summary%20of%20Training%20Content.pdf)).
- Claude Opus 5.5's training data runs to June 2026
  ([models overview](https://platform.claude.com/docs/en/about-claude/models/overview)).
- Most providers publish no exact cutoff, models get later post-training, and
  the same position can occur in earlier games.

## Sources

- **Puzzles:** `lichess_db_puzzle.csv.zst` from database.lichess.org,
  `Last-Modified` 2026-11-01, downloaded 2026-11-06. URL, `ETag`, bytes and
  SHA-256 are in `manifest.source`.
- **Baseline:** the April 2026 dump, from the Internet Archive capture of
  2026-04-07 (`manifest.baseline`). A puzzle already in it comes from a game
  played before April, so it is dropped before any date lookup. It is not the
  dump v1 was built from.
- **Game dates:** `createdAt` (epoch ms, UTC) from Lichess's
  `POST /api/games/export/_ids`. A game the API did not return is dropped.
  Each item stores it as `metadata.gameCreatedAt`.

## Selection

| | v1 | v2 |
|---|---|---|
| Popularity | ≥ 80 | ≥ 80 |
| Plays | ≥ 300 | ≥ 300; ≥ 200 for 2400+ |
| Rating deviation | ≤ 110 | ≤ 110 |
| Mate-in-one | excluded | kept |
| Game date | any | on or after 2026-06-01 UTC |
| Seed | `lichess-puzzles-v1` | `lichess-puzzles-v2` |

Every move is replayed in chess.js. Each band keeps the 100 puzzles with the
lowest `sha256("lichess-puzzles-v2:" + PuzzleId)`.

- **2400+ plays:** only 51 puzzles in that band reach 300 plays, so it takes
  200. 84 of its 100 have 200 to 299 plays.
- **Mate-in-one:** 35 puzzles (20 under 1200, 9 at 1200-1599, 5 at 1600-1999,
  1 at 2000-2399). The scorer accepts only the Lichess solution, so a second
  valid mate scores as a miss.

## Themes

Lichess adds puzzles with empty themes and tags them later, so most of these
puzzles had only phase tags in the dump. Every v2 puzzle is re-tagged with
Lichess's own tagger, `cook.py` from
[ornicar/lichess-puzzler](https://github.com/ornicar/lichess-puzzler) at commit
`8e24b6d`, with python-chess 1.3.0. The phase and source tags (`opening`,
`middlegame`, `endgame`, `master`, `masterVsMaster`, `superGM`) are kept from
the dump.

- **Left out:**
  - `crushing`, `advantage` and `equality` come from the puzzle generator's
    engine eval, which the dump doesn't publish.
  - `zugzwang` needs a separate Stockfish pass.

  Puzzles with no motif therefore get a phase or length tag as `primaryTheme`
  where v1 had `crushing` or `advantage`.
- **Never produced by cook:** `discoveredCheck` and the named mates
  (`operaMate`, `pillsburysMate`, `killBoxMate` and others), which Lichess
  adds elsewhere.
- **Validation:** on 500 April 2026 puzzles Lichess had already tagged, every
  tag cook produces matched with 100% precision and recall. 467 of 500 tag
  sets match exactly, and every mismatch is a tag cook never produces.

## Rebuild

Needs `zstd`, Bun, and a Python 3 venv with `chess==1.3.0`.

```bash
# The current dump and the baseline, each with a .provenance.json sidecar.
# The baseline's sidecar records its Internet Archive download by hand.
bun run datasets:lichess:download -- --out=$CACHE/dump.csv.zst

# Baseline exclusion, filters, legality and game dates; resumable, and polite
# to the API (one request at a time, 300 ids each).
bun scripts/filter-lichess-puzzles-by-game-date.ts \
  --source=$CACHE/dump.csv.zst --baseline=$CACHE/baseline.csv.zst \
  --cache=$CACHE/gate --threshold=2026-06-01T00:00:00Z

git clone https://github.com/ornicar/lichess-puzzler $TAGGER
git -C $TAGGER checkout 8e24b6d5e2b9618e41581a327926e4ac67c610a2
python3 -I scripts/cook-lichess-puzzles.py --tagger=$TAGGER \
  tag $CACHE/gate/qualifying.csv $CACHE/gate/qualifying-cooked.csv

bun run datasets:lichess:prepare -- --benchmark=lichess-puzzles-v2 --gate=$CACHE/gate
```

`cook-lichess-puzzles.py validate <baseline.csv.zst>` reruns the tagger
validation.
