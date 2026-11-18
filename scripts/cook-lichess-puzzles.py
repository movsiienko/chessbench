"""Step 2 of building lichess-puzzles-v2: theme the puzzles with Lichess's own tagger.

Lichess adds puzzles with empty themes and tags them later with cook.py from
github.com/ornicar/lichess-puzzler, so most recent puzzles in the dump carry
only lila's phase/source tags. This runs cook.py on every row and rewrites the
Themes column as cook's tags plus those phase/source tags from the dump.

Left out: crushing/advantage/equality (cook derives them from the generator's
engine eval, which the dump does not publish) and zugzwang (a separate
Stockfish pass). Cook never produces discoveredCheck or the named mates
(operaMate, pillsburysMate, ...), which Lichess adds elsewhere.

Needs a lichess-puzzler checkout at TAGGER_COMMIT and python-chess 1.3.0:

  python3 -I scripts/cook-lichess-puzzles.py --tagger=<checkout> tag <in.csv> <out.csv>
  python3 -I scripts/cook-lichess-puzzles.py --tagger=<checkout> validate <older dump .csv.zst>

`validate` cooks 500 puzzles Lichess already tagged (lowest
sha256("cook-validation-v1:" + PuzzleId) among rows with popularity >= 80,
plays >= 300 and RD <= 110) and compares the tags cook can produce.
"""

import argparse
import collections
import csv
import hashlib
import heapq
import logging
import os
import subprocess
import sys

TAGGER_COMMIT = "8e24b6d5e2b9618e41581a327926e4ac67c610a2"
CP_TAGS = {"crushing", "advantage", "equality"}
LILA_TAGS = {"opening", "middlegame", "endgame", "master", "masterVsMaster", "superGM"}
LENGTH_TAGS = {"oneMove", "short", "long", "veryLong"}

parser = argparse.ArgumentParser()
parser.add_argument("--tagger", required=True, help="lichess-puzzler checkout")
parser.add_argument("mode", choices=["tag", "validate"])
parser.add_argument("paths", nargs="+")
args = parser.parse_args()

commit = subprocess.run(
    ["git", "-C", args.tagger, "rev-parse", "HEAD"], capture_output=True, text=True, check=True
).stdout.strip()
if commit != TAGGER_COMMIT:
    sys.exit(f"lichess-puzzler is at {commit}, expected {TAGGER_COMMIT}")

sys.path.insert(0, f"{args.tagger}/tagger")
import chess  # noqa: E402
from chess import Board, Move  # noqa: E402
from chess.pgn import Game  # noqa: E402

if chess.__version__ != "1.3.0":
    sys.exit(f"python-chess {chess.__version__}; the tagger pins 1.3.0")

import cook  # noqa: E402
from model import Puzzle  # noqa: E402

logging.disable(logging.CRITICAL)  # cook logs every match


def cooked_tags(row):
    node = Game.from_board(Board(row["FEN"]))
    for uci in row["Moves"].split():
        node = node.add_main_variation(Move.from_uci(uci))
    # cp only picks crushing/advantage/equality, which are dropped.
    return set(cook.cook(Puzzle(row["PuzzleId"], node.game(), 0))) - CP_TAGS - {"zugzwang"}


if args.mode == "tag":
    source, target = args.paths
    # Written aside and moved into place, so target may even be the source.
    with open(source, newline="") as inp, open(f"{target}.part", "w", newline="") as out:
        reader = csv.DictReader(inp)
        writer = csv.DictWriter(out, reader.fieldnames, lineterminator="\n")
        writer.writeheader()
        for row in reader:
            lila = {tag for tag in row["Themes"].split() if tag in LILA_TAGS}
            row["Themes"] = " ".join(sorted(cooked_tags(row) | lila))
            writer.writerow(row)
    os.replace(f"{target}.part", target)
    sys.exit(0)

zstd = subprocess.Popen(["zstdcat", args.paths[0]], stdout=subprocess.PIPE, text=True)
tagged = (
    row
    for row in csv.DictReader(zstd.stdout)
    if int(row["Popularity"]) >= 80
    and int(row["NbPlays"]) >= 300
    and int(row["RatingDeviation"]) <= 110
    and set(row["Themes"].split()) & LENGTH_TAGS
)
sample = heapq.nsmallest(
    500,
    tagged,
    key=lambda row: hashlib.sha256(f"cook-validation-v1:{row['PuzzleId']}".encode()).digest(),
)

if zstd.wait() != 0:
    sys.exit(f"zstdcat failed on {args.paths[0]}")

tp, fp, fn = collections.Counter(), collections.Counter(), collections.Counter()
exact = 0
for row in sample:
    ours = cooked_tags(row)
    theirs = set(row["Themes"].split()) - LILA_TAGS - CP_TAGS - {"zugzwang"}
    exact += ours == theirs
    for tag in ours | theirs:
        counter = tp if tag in ours and tag in theirs else fp if tag in ours else fn
        counter[tag] += 1
print(f"{exact}/{len(sample)} exact tag-set matches")
for tag in sorted(set(tp) | set(fp) | set(fn)):
    print(f"{tag:20} tp={tp[tag]:4} fp={fp[tag]:4} fn={fn[tag]:4}")
