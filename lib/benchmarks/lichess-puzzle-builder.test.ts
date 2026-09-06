import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, test } from "node:test"
import { escapeCsv } from "./csv"
import {
  buildPuzzleItem,
  parsePuzzleRow,
  type ParsedPuzzleRow,
} from "./lichess-puzzle-builder"
import type { LichessPuzzleBenchmarkItem } from "./lichess-puzzles"

// PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
const bishopEndgame =
  "rYFDJ,8/p5pp/5p2/1p1k4/4P1PB/1P2K3/P1P3bP/8 b - - 0 30,g2e4 c2c4 b5c4 b3c4 d5c4 e3e4,962,87,93,508,bishopEndgame crushing endgame long,https://lichess.org/m4QTuikA/black#60,"

function parseOk(line: string): ParsedPuzzleRow {
  const parsed = parsePuzzleRow(line)
  assert.ok(!("rejected" in parsed), `rejected: ${JSON.stringify(parsed)}`)
  return parsed
}

function build(line: string) {
  return buildPuzzleItem(parseOk(line))
}

describe("parsePuzzleRow", () => {
  test("classifies the row", () => {
    const parsed = parseOk(bishopEndgame)
    assert.equal(parsed.band.id, "under-1200")
    assert.deepEqual(parsed.quality, {
      rating: 962,
      ratingDeviation: 87,
      popularity: 93,
      nbPlays: 508,
    })
    assert.deepEqual(parsed.themes, [
      "bishopEndgame",
      "crushing",
      "endgame",
      "long",
    ])
  })

  test("rejects mateIn1", () => {
    assert.deepEqual(
      parsePuzzleRow(
        "00sJb,r3r1k1/pp3pbp/1qp1b1p1/2B5/2BP4/Q1n2N2/P4PPP/3R1K1R w - - 4 18,e2e4 e5e4,1000,80,95,1000,mateIn1 short,https://lichess.org/x,"
      ),
      { rejected: "mateIn1" }
    )
  })

  test("rejects rows failing the quality thresholds", () => {
    const [id, fen, moves, rating, deviation, popularity, plays, ...rest] =
      bishopEndgame.split(",")
    const withField = (index: number, value: string) =>
      [id, fen, moves, rating, deviation, popularity, plays, ...rest]
        .map((field, i) => (i === index ? value : field))
        .join(",")

    assert.deepEqual(parsePuzzleRow(withField(5, "79")), {
      rejected: "quality",
    })
    assert.deepEqual(parsePuzzleRow(withField(6, "299")), {
      rejected: "quality",
    })
    assert.deepEqual(parsePuzzleRow(withField(4, "111")), {
      rejected: "quality",
    })
    assert.deepEqual(parsePuzzleRow(withField(3, "abc")), {
      rejected: "quality",
    })
  })

  test("rejects rows with the wrong column count or unbalanced quotes", () => {
    assert.deepEqual(parsePuzzleRow(""), { rejected: "invalidColumns" })
    assert.deepEqual(parsePuzzleRow("a,b,c"), { rejected: "invalidColumns" })
    assert.deepEqual(parsePuzzleRow(`"unclosed,${bishopEndgame}`), {
      rejected: "invalidColumns",
    })
  })

  test("parses a quoted field with an embedded comma", () => {
    const quoted = bishopEndgame.replace(
      "bishopEndgame crushing endgame long",
      '"bishopEndgame crushing, endgame long"'
    )
    const parsed = parseOk(quoted)
    assert.equal(parsed.row.Themes, "bishopEndgame crushing, endgame long")
    assert.equal(parsed.row.GameUrl, "https://lichess.org/m4QTuikA/black#60")
  })
})

describe("buildPuzzleItem", () => {
  test("builds an item with derived strata", () => {
    const item = build(bishopEndgame)
    assert.ok(item)
    assert.equal(item.id, "lichess:rYFDJ")
    assert.equal(item.position.sideToMove, "w")
    assert.deepEqual(item.expected.playerUciMoves, ["c2c4", "b3c4", "e3e4"])
    assert.equal(item.metadata.ratingBand, "under-1200")
    assert.equal(item.metadata.ratingBucket, "0900-0999")
    assert.equal(item.metadata.primaryTheme, "bishopEndgame")
    assert.deepEqual(item.metadata.themeGroups, ["endgame", "positional"])
    assert.equal(item.metadata.length, "long")
    assert.deepEqual(item.metadata.moveCounts, {
      solutionPlies: 5,
      playerMoves: 3,
      opponentReplies: 2,
    })
  })

  test("rejects an illegal solution move", () => {
    assert.equal(build(bishopEndgame.replace("e3e4", "e3e5")), null)
  })

  test("rejects an illegal trigger move and a missing solution", () => {
    assert.equal(build(bishopEndgame.replace("g2e4", "g2g4")), null)
    assert.equal(
      build(bishopEndgame.replace("g2e4 c2c4 b5c4 b3c4 d5c4 e3e4", "g2e4")),
      null
    )
  })

  test("reproduces every tracked item byte for byte", () => {
    const lines = readFileSync(
      new URL(
        "../../data/benchmarks/lichess-puzzles-v1/items.jsonl",
        import.meta.url
      ),
      "utf8"
    )
      .trim()
      .split("\n")
    assert.equal(lines.length, 500)

    for (const line of lines) {
      // SAFETY: items.jsonl is written by the prep script as one LichessPuzzleBenchmarkItem per line.
      const { position, metadata } = JSON.parse(
        line
      ) as LichessPuzzleBenchmarkItem
      const csvRow = [
        metadata.lichessPuzzleId,
        position.triggerFen,
        [position.triggerMove, ...JSON.parse(line).expected.uciLine].join(" "),
        metadata.rating,
        metadata.ratingDeviation,
        metadata.popularity,
        metadata.nbPlays,
        metadata.themes.join(" "),
        metadata.lichessGameUrl,
        metadata.openingTags.join(" "),
      ]
        .map(escapeCsv)
        .join(",")

      assert.equal(JSON.stringify(build(csvRow)), line)
    }
  })
})
