import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { buildDashboardData } from "./dashboard-build"
import type { LichessPuzzleBenchmarkItem } from "./lichess-puzzles"
import type { LichessPuzzleAttemptRow } from "./local-runner"

function item(
  id: string,
  rating: number,
  themes: string[],
  themeGroups: LichessPuzzleBenchmarkItem["metadata"]["themeGroups"] = []
): LichessPuzzleBenchmarkItem {
  return {
    id,
    benchmark: "lichess-puzzles-v1",
    position: {
      triggerFen: "8/8/8/8/8/8/8/8 w - - 0 1",
      triggerMove: "a1a2",
      fen: "8/8/8/8/8/8/8/8 b - - 0 1",
      sideToMove: "b",
    },
    expected: { uciLine: ["h8h1"], playerUciMoves: ["h8h1"], finalFen: "" },
    metadata: {
      lichessPuzzleId: id,
      lichessGameUrl: "",
      rating,
      ratingDeviation: 80,
      popularity: 90,
      nbPlays: 100,
      ratingBand: "1200-1599",
      ratingBucket: "1500-1599",
      length: "short",
      moveCounts: { solutionPlies: 1, playerMoves: 1, opponentReplies: 0 },
      primaryTheme: themes[0] ?? "middlegame",
      themeGroups,
      themes,
      openingTags: [],
    },
  }
}

function row(
  model: string,
  itemId: string,
  rating: number,
  solved: boolean
): LichessPuzzleAttemptRow {
  return {
    runId: "run",
    createdAt: "2026-06-06T08:00:00.000Z",
    benchmark: "lichess-puzzles-v1",
    promptTemplateId: "uci-or-san-single-move-v3",
    model,
    itemId,
    lichessPuzzleId: itemId,
    rating,
    ratingBand: "1200-1599",
    ratingBucket: "1500-1599",
    primaryTheme: "fork",
    status: solved ? "ok" : "wrong_move",
    solved,
    firstMoveCorrect: solved,
    exactPlayerLine: solved,
    playerMovePrefixScore: solved ? 1 : 0,
    expectedFullLine: ["h8h1"],
    expectedPlayerLine: ["h8h1"],
    submittedPlayerMoves: [solved ? "h8h1" : "h8h2"],
    revealedOpponentMoves: [],
    invalidTurnIndex: null,
    errorMessage: "",
    latencyMsTotal: 1000,
    inputTokens: 10,
    outputTokens: 5,
    totalTokens: 15,
    reasoningTokens: 0,
    costUsd: 0.001,
    servedProvider: "test",
    generationId: "gen",
    turns: [],
  }
}

const models = [
  { id: "a", name: "GPT 5.5", vendor: "OpenAI", lab: "openai" },
  { id: "b", name: "Claude Opus 4.8", vendor: "Anthropic", lab: "anthropic" },
].map((model) => ({ ...model, color: "#000", colorDark: "#fff", releaseQ: "" }))

const items = [
  item("p1", 1012, ["fork", "middlegame"]),
  item("p2", 1500, ["mateIn1"], ["checkmate"]),
  item("p3", 2043, ["pin", "rookEndgame"], ["endgame"]),
]

describe("buildDashboardData", () => {
  const data = buildDashboardData({
    models,
    items,
    rows: {
      a: [
        row("a", "p1", 1500, true),
        row("a", "p2", 1500, true),
        row("a", "p3", 1500, false),
      ],
      b: [
        row("b", "p1", 1500, false),
        row("b", "p2", 1500, false),
        row("b", "p3", 1500, false),
      ],
    },
    datasetSize: 3,
    sourceFiles: ["a.csv", "b.csv"],
  })

  test("emits the elo estimate with its one-puzzle band", () => {
    const [a] = data.scoreboard

    assert.equal(a?.accuracy, 0.667)
    assert.deepEqual(
      { elo: a?.elo, eloLow: a?.eloLow, eloHigh: a?.eloHigh },
      { elo: 1620, eloLow: 1380, eloHigh: 2298 }
    )
  })

  test("emits one category table of accuracy and n", () => {
    assert.deepEqual(data.category.a?.fork, { accuracy: 1, n: 1 })
    assert.deepEqual(data.category.a?.endgame, { accuracy: 0, n: 1 })
    assert.deepEqual(data.category.b?.zugzwang, { accuracy: null, n: 0 })
  })

  test("emits rating bounds, sample size, and short names", () => {
    assert.deepEqual(data.meta.ratingBounds, [1000, 2050])
    assert.deepEqual(data.meta.sampleSize, { min: 3, max: 3 })
    assert.deepEqual(
      data.models.map((model) => model.shortName),
      ["GPT", "Claude"]
    )
  })
})
