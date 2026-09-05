import assert from "node:assert/strict"
import { describe, test } from "node:test"
import type {
  LichessPuzzleBenchmarkItem,
  RatingBandId,
} from "./lichess-puzzles"
import { selectDefaultLichessPuzzleItems } from "./lichess-puzzles"

function item(
  id: string,
  ratingBand: RatingBandId
): LichessPuzzleBenchmarkItem {
  return {
    id,
    benchmark: "lichess-puzzles-v1",
    position: {
      triggerFen: "8/8/8/8/8/8/8/8 w - - 0 1",
      triggerMove: "a2a3",
      fen: "8/8/8/8/8/8/8/8 w - - 0 1",
      sideToMove: "w",
    },
    expected: {
      uciLine: ["a2a3"],
      playerUciMoves: ["a2a3"],
      finalFen: "8/8/8/8/8/8/8/8 b - - 0 1",
    },
    metadata: {
      lichessPuzzleId: id,
      lichessGameUrl: "https://lichess.org/example",
      rating: 1000,
      ratingDeviation: 80,
      popularity: 90,
      nbPlays: 500,
      ratingBand,
      ratingBucket: "1000-1099",
      length: "short",
      moveCounts: {
        solutionPlies: 1,
        playerMoves: 1,
        opponentReplies: 0,
      },
      primaryTheme: "fork",
      themeGroups: ["tactic"],
      themes: ["fork", "short"],
      openingTags: [],
    },
  }
}

describe("lichess puzzle default selection", () => {
  test("selects a deterministic sample spread across rating bands", () => {
    const items = [
      item("u1", "under-1200"),
      item("u2", "under-1200"),
      item("u3", "under-1200"),
      item("m1", "1200-1599"),
      item("m2", "1200-1599"),
      item("m3", "1200-1599"),
      item("h1", "1600-1999"),
      item("h2", "1600-1999"),
      item("h3", "1600-1999"),
      item("e1", "2000-2399"),
      item("e2", "2000-2399"),
      item("e3", "2000-2399"),
      item("x1", "2400-plus"),
      item("x2", "2400-plus"),
      item("x3", "2400-plus"),
    ]

    assert.deepEqual(
      selectDefaultLichessPuzzleItems(items, 10).map((entry) => entry.id),
      ["u1", "u2", "m1", "m2", "h1", "h2", "e1", "e2", "x1", "x2"]
    )
  })
})
