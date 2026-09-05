import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { parseAcceptedMoveAnswer } from "../chess/moves"
import type { LichessPuzzleBenchmarkItem } from "./lichess-puzzles"
import { runLichessPuzzleAttempt } from "./local-runner"

function puzzle(): LichessPuzzleBenchmarkItem {
  return {
    id: "lichess:test",
    benchmark: "lichess-puzzles-v1",
    position: {
      triggerFen: "8/p5pp/5p2/1p1k4/4P1PB/1P2K3/P1P3bP/8 b - - 0 30",
      triggerMove: "g2e4",
      fen: "8/p5pp/5p2/1p1k4/4b1PB/1P2K3/P1P4P/8 w - - 0 31",
      sideToMove: "w",
    },
    expected: {
      uciLine: ["c2c4", "b5c4", "b3c4", "d5c4", "e3e4"],
      playerUciMoves: ["c2c4", "b3c4", "e3e4"],
      finalFen: "8/p5pp/5p2/8/2k1K1PB/8/P6P/8 b - - 0 33",
    },
    metadata: {
      lichessPuzzleId: "test",
      lichessGameUrl: "https://lichess.org/example",
      rating: 962,
      ratingDeviation: 87,
      popularity: 93,
      nbPlays: 508,
      ratingBand: "under-1200",
      ratingBucket: "0900-0999",
      length: "long",
      moveCounts: {
        solutionPlies: 5,
        playerMoves: 3,
        opponentReplies: 2,
      },
      primaryTheme: "bishopEndgame",
      themeGroups: ["endgame", "positional"],
      themes: ["bishopEndgame", "crushing", "endgame", "long"],
      openingTags: [],
    },
  }
}

describe("local lichess puzzle attempts", () => {
  test("runs a puzzle as UCI/SAN multi-turn interaction", async () => {
    const answers = ["c2c4", "b3c4", "e3e4"]

    const row = await runLichessPuzzleAttempt({
      runId: "run",
      model: "test/model",
      item: puzzle(),
      generate: async ({ messages }) => {
        const answer = answers.shift()
        assert.notEqual(answer, undefined)
        return {
          text: answer ?? "",
          latencyMs: 10,
          messages,
        }
      },
    })

    assert.equal(row.status, "ok")
    assert.equal(row.solved, true)
    assert.deepEqual(row.submittedPlayerMoves, ["c2c4", "b3c4", "e3e4"])
    assert.deepEqual(row.revealedOpponentMoves, ["b5c4", "d5c4"])
    assert.deepEqual(
      row.turns.map((turn) => turn.prompt),
      [
        [
          "Position FEN: 8/p5pp/5p2/1p1k4/4b1PB/1P2K3/P1P4P/8 w - - 0 31",
          "Find the best move for the side to move.",
          "Output contract:",
          "Return exactly one legal chess move for the side to move.",
          "Accepted notation: UCI such as e2e4 or e7e8q, or SAN such as Nf3, Rxa6, O-O, or exd8=Q+.",
          "Your entire response must be only that move token. No explanation, labels, move numbers, code block, or extra text.",
        ].join("\n"),
        [
          "Opponent played: b5c4.",
          "Find the next move.",
          "Output contract:",
          "Return exactly one legal chess move for the side to move.",
          "Accepted notation: UCI such as e2e4 or e7e8q, or SAN such as Nf3, Rxa6, O-O, or exd8=Q+.",
          "Your entire response must be only that move token. No explanation, labels, move numbers, code block, or extra text.",
        ].join("\n"),
        [
          "Opponent played: d5c4.",
          "Find the next move.",
          "Output contract:",
          "Return exactly one legal chess move for the side to move.",
          "Accepted notation: UCI such as e2e4 or e7e8q, or SAN such as Nf3, Rxa6, O-O, or exd8=Q+.",
          "Your entire response must be only that move token. No explanation, labels, move numbers, code block, or extra text.",
        ].join("\n"),
      ]
    )
  })

  test("accepts SAN answers and stores them as UCI moves", async () => {
    const answers = ["1. c4!", "bxc4+", "`Kxe4`"]

    const row = await runLichessPuzzleAttempt({
      runId: "run",
      model: "test/model",
      item: puzzle(),
      generate: async () => {
        const answer = answers.shift()
        assert.notEqual(answer, undefined)
        return { text: answer ?? "", latencyMs: 10 }
      },
    })

    assert.equal(row.status, "ok")
    assert.equal(row.solved, true)
    assert.deepEqual(row.submittedPlayerMoves, ["c2c4", "b3c4", "e3e4"])
    assert.deepEqual(
      row.turns.map((turn) => turn.parsedMove),
      ["c2c4", "b3c4", "e3e4"]
    )
  })

  test("marks extra text invalid and stops without revealing later moves", async () => {
    const row = await runLichessPuzzleAttempt({
      runId: "run",
      model: "test/model",
      item: puzzle(),
      generate: async () => ({ text: "best is c2c4", latencyMs: 10 }),
    })

    assert.equal(row.status, "invalid_format")
    assert.equal(row.solved, false)
    assert.deepEqual(row.submittedPlayerMoves, [])
    assert.deepEqual(row.revealedOpponentMoves, [])
    assert.equal(row.turns.length, 1)
  })

  test("stores valid wrong moves before stopping", async () => {
    const row = await runLichessPuzzleAttempt({
      runId: "run",
      model: "test/model",
      item: puzzle(),
      generate: async () => ({ text: "a2a3", latencyMs: 10 }),
    })

    assert.equal(row.status, "wrong_move")
    assert.equal(row.solved, false)
    assert.deepEqual(row.submittedPlayerMoves, ["a2a3"])
    assert.equal(row.playerMovePrefixScore, 0)
  })

  test("marks illegal UCI-shaped moves invalid", async () => {
    const row = await runLichessPuzzleAttempt({
      runId: "run",
      model: "test/model",
      item: puzzle(),
      generate: async () => ({ text: "a1b3", latencyMs: 10 }),
    })

    assert.equal(row.status, "invalid_format")
    assert.equal(row.solved, false)
    assert.deepEqual(row.submittedPlayerMoves, [])
    assert.equal(
      parseAcceptedMoveAnswer("a1b3", "8/8/8/8/8/8/8/R3K2k w - - 0 1"),
      null
    )
  })
})
