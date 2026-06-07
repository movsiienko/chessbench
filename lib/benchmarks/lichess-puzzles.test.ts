import assert from "node:assert/strict"
import { describe, test } from "node:test"
import type { LichessPuzzleBenchmarkItem } from "./lichess-puzzles"
import {
  LICHESS_PUZZLE_PROMPT_TEMPLATE_ID,
  buildLichessPuzzleInitialPrompt,
  selectDefaultLichessPuzzleItems,
} from "./lichess-puzzles"

function item(id: string, ratingBand: string): LichessPuzzleBenchmarkItem {
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
      ratingBand:
        ratingBand as LichessPuzzleBenchmarkItem["metadata"]["ratingBand"],
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

describe("lichess puzzle runtime prompt contract", () => {
  test("builds the prompt at runtime from FEN instead of storing it on items", () => {
    const benchmarkItem = item("one", "under-1200")

    assert.equal("prompt" in benchmarkItem, false)
    assert.equal(LICHESS_PUZZLE_PROMPT_TEMPLATE_ID, "uci-or-san-single-move-v3")
    assert.equal(
      buildLichessPuzzleInitialPrompt(benchmarkItem),
      [
        "Position FEN: 8/8/8/8/8/8/8/8 w - - 0 1",
        "Find the best move for the side to move.",
        "Output contract:",
        "Return exactly one legal chess move for the side to move.",
        "Accepted notation: UCI such as e2e4 or e7e8q, or SAN such as Nf3, Rxa6, O-O, or exd8=Q+.",
        "Your entire response must be only that move token. No explanation, labels, move numbers, code block, or extra text.",
      ].join("\n")
    )
  })
})

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
