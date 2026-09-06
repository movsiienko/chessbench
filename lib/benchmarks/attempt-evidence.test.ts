import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, test } from "node:test"
import { buildDashboardData } from "./dashboard-build"
import { parseAttemptRows } from "./csv"
import { loadItems } from "./lichess-puzzles"
import { MODELS, type ModelId } from "./models"
import type { LichessPuzzleAttemptRow } from "./local-runner"
import {
  attemptJson,
  attemptTranscript,
  buildAttemptEvidence,
} from "./attempt-evidence"

const items = await loadItems("data/benchmarks/lichess-puzzles-v1/items.jsonl")
const rows: Record<ModelId, LichessPuzzleAttemptRow[]> = Object.fromEntries(
  await Promise.all(
    MODELS.map(async (model) => [
      model.id,
      parseAttemptRows(
        await readFile(
          `data/results/canonical/lichess-puzzles-v1/${model.file}`,
          "utf8"
        )
      ),
    ])
  )
)
const data = buildDashboardData({
  models: MODELS.map((model) => ({
    ...model,
    lab: model.apiModel.split("/")[0],
  })),
  items,
  rows,
  datasetSize: items.length,
  sourceFiles: MODELS.map((model) => model.file),
})

describe("published attempt evidence", () => {
  test("keeps a correct first move distinct from a later failed attempt", () => {
    const puzzle = data.puzzles.find((puzzle) => puzzle.id === "lichess:bHLqd")!
    for (const id of ["gpt5", "ds35", "grok4"]) {
      const attempt = puzzle.attempts.find((attempt) => attempt.model === id)!
      assert.equal(attempt.solved, false)
      assert.equal(attempt.firstMove.uci, "e6d7")
      assert.equal(attempt.firstMove.correct, true)
      assert.equal(attempt.outcome, "Wrong move on turn 2")
    }
  })

  test("preserves all configured records and their recorded reasoning", () => {
    let laterFailures = 0
    let reasoningTurns = 0
    for (const model of MODELS) {
      for (const record of rows[model.id]) {
        const evidence = data.puzzles
          .find((puzzle) => puzzle.id === record.itemId)!
          .attempts.find((attempt) => attempt.model === model.id)!
        assert.deepEqual(JSON.parse(attemptJson(evidence)), record)
        if (!record.solved && record.firstMoveCorrect) {
          laterFailures += 1
          assert.equal(evidence.solved, false)
          assert.equal(evidence.firstMove.correct, true)
        }
        for (const turn of record.turns) {
          if (turn.reasoningText) {
            reasoningTurns += 1
            assert.ok(attemptTranscript(evidence).includes(turn.reasoningText))
          }
        }
      }
    }
    assert.equal(laterFailures, 9)
    assert.equal(reasoningTurns, 21)
  })

  test("distinguishes a wrong first move, invalid answer, and provider error", () => {
    const original = rows.gpt5[0]
    for (const status of ["wrong_move", "invalid_format", "error"] as const) {
      const hasMove = status === "wrong_move"
      const record = {
        ...original,
        solved: false,
        firstMoveCorrect: false,
        status,
        submittedPlayerMoves: hasMove ? ["a2a3"] : [],
        invalidTurnIndex: 0,
        reasoningTokens: null,
        totalTokens: null,
        turns: [
          {
            turnIndex: 0,
            prompt: "Find the move",
            rawAnswer: hasMove ? "a2a3" : "",
            parsedMove: hasMove ? "a2a3" : "",
            expectedMove: "c2c4",
            result: status,
            errorMessage: status === "error" ? "Provider unavailable" : "",
            reasoning: [
              { type: "reasoning", text: "Recorded provider reasoning" },
            ],
          },
        ],
      }
      const evidence = buildAttemptEvidence("test", record)
      assert.equal(evidence.firstMove.correct, hasMove ? false : null)
      assert.equal(
        evidence.firstMove.label,
        hasMove ? "a2 to a3" : "No valid move"
      )
      assert.equal(evidence.thinkingTokens, null)
      const labels = {
        wrong_move: "Wrong move",
        invalid_format: "Invalid answer",
        error: "Error",
      }
      assert.equal(evidence.outcome, `${labels[status]} on turn 1`)
      assert.ok(
        attemptTranscript(evidence).includes("Recorded provider reasoning")
      )
      assert.ok(attemptTranscript(evidence).includes(`Result: ${status}`))
      if (status === "error")
        assert.ok(attemptTranscript(evidence).includes("Provider unavailable"))
      assert.deepEqual(JSON.parse(attemptJson(evidence)).turns, record.turns)
    }
  })

  test("labels completed attempts without inferring failure from missing moves", () => {
    const record = rows.gpt5.find((row) => row.solved)!
    const evidence = buildAttemptEvidence("gpt5", record)
    assert.equal(evidence.solved, true)
    assert.equal(evidence.firstMove.correct, true)
    assert.equal(evidence.outcome, "Solved")
    const incomplete = buildAttemptEvidence("gpt5", {
      ...record,
      solved: false,
      status: "ok",
      invalidTurnIndex: null,
    })
    assert.equal(incomplete.outcome, "Unsolved")
  })
})
