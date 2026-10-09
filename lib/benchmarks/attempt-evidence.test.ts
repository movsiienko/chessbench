import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, test } from "node:test"
import {
  buildDashboardData,
  entriesFrom,
  type StoredAttempt,
} from "./dashboard-build"
import { parseAttemptRows } from "./csv"
import { loadItems } from "./lichess-puzzles"
import type { LichessPuzzleAttemptRow } from "./local-runner"
import {
  attemptJson,
  attemptTranscript,
  buildAttemptEvidence,
} from "./attempt-evidence"

// The six sets published before results moved to Postgres, imported by
// drizzle/0001 as protocol v1.
const publishedFiles = [
  "openai-gpt-5-5-single-move-v3-effort-only-20260605.csv",
  "anthropic-claude-opus-4-8-single-move-v3-thinking-low-20260606.csv",
  "google-gemini-3-5-flash-single-move-v3-thinking-low-20260606.csv",
  "deepseek-deepseek-v3-2-thinking-single-move-v3-thinking-low-20260606.csv",
  "xai-grok-4-1-fast-reasoning-single-move-v3-thinking-low-20260606.csv",
  "alibaba-qwen3-max-thinking-single-move-v3-thinking-low-20260606.csv",
]

const items = await loadItems("data/benchmarks/lichess-puzzles-v1/items.jsonl")
const records: LichessPuzzleAttemptRow[] = (
  await Promise.all(
    publishedFiles.map(async (file) =>
      parseAttemptRows(
        await readFile(
          `data/results/canonical/lichess-puzzles-v1/${file}`,
          "utf8"
        )
      )
    )
  )
).flat()
const stored: StoredAttempt[] = records.map((record, index) => {
  const { turns: _turns, ...summary } = record
  return {
    attemptId: `attempt-${index}`,
    model: record.model,
    reasoningLevel: record.reasoningEffort || "none",
    status: record.status,
    record: summary,
  }
})
const entries = entriesFrom(stored)
const data = buildDashboardData({
  ...entries,
  items,
  datasetSize: items.length,
})
const gpt5 = records.filter((record) => record.model === "openai/gpt-5.5")

function evidenceFor(record: LichessPuzzleAttemptRow) {
  return data.puzzles
    .find((puzzle) => puzzle.id === record.itemId)
    ?.attempts.find((attempt) => attempt.record.model === record.model)
}

describe("scoreboard entries", () => {
  test("one entry per model and reasoning level, errors pending", () => {
    assert.equal(entries.models.length, 6)
    const claude = entries.models.find((model) =>
      model.name.startsWith("Claude Opus 4.8")
    )!
    assert.equal(claude.name, "Claude Opus 4.8 · low")
    assert.equal(claude.id, "anthropic-claude-opus-4-8-low")
    assert.equal(entries.pending[claude.id], 2)
    assert.equal(entries.rows[claude.id]?.length, 8)
    const score = data.scoreboard.find((row) => row.model === claude.id)!
    assert.equal(score.n, 8)
    assert.equal(score.pending, 2)
  })
})

describe("published attempt evidence", () => {
  test("keeps a correct first move distinct from a later failed attempt", () => {
    const puzzle = data.puzzles.find((puzzle) => puzzle.id === "lichess:bHLqd")!
    for (const model of [
      "openai/gpt-5.5",
      "deepseek/deepseek-v3.2-thinking",
      "xai/grok-4.1-fast-reasoning",
    ]) {
      const attempt = puzzle.attempts.find(
        (attempt) => attempt.record.model === model
      )!
      assert.equal(attempt.solved, false)
      assert.equal(attempt.firstMove.uci, "e6d7")
      assert.equal(attempt.firstMove.correct, true)
      assert.equal(attempt.outcome, "Wrong move on turn 2")
    }
  })

  test("summarizes every finished record and transcribes its reasoning", () => {
    let laterFailures = 0
    let reasoningTurns = 0
    for (const record of records) {
      const evidence = evidenceFor(record)
      if (record.status === "error") {
        assert.equal(evidence, undefined)
        continue
      }
      const { turns: _turns, ...summary } = record
      assert.deepEqual(evidence?.record, summary)
      assert.deepEqual(JSON.parse(attemptJson(record)), record)
      if (!record.solved && record.firstMoveCorrect) {
        laterFailures += 1
        assert.equal(evidence?.solved, false)
        assert.equal(evidence?.firstMove.correct, true)
      }
      for (const turn of record.turns) {
        if (turn.reasoningText) {
          reasoningTurns += 1
          assert.ok(attemptTranscript(record).includes(turn.reasoningText))
        }
      }
    }
    // A ninth later failure was a provider error on turn 2, now pending.
    assert.equal(laterFailures, 8)
    assert.equal(reasoningTurns, 21)
  })

  test("distinguishes a wrong first move, invalid answer, and provider error", () => {
    const original = gpt5[0]!
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
      const evidence = buildAttemptEvidence("test", "attempt", record)
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
        attemptTranscript(record).includes("Recorded provider reasoning")
      )
      assert.ok(attemptTranscript(record).includes(`Result: ${status}`))
      if (status === "error")
        assert.ok(attemptTranscript(record).includes("Provider unavailable"))
      assert.deepEqual(JSON.parse(attemptJson(record)).turns, record.turns)
    }
  })

  test("labels completed attempts without inferring failure from missing moves", () => {
    const record = gpt5.find((row) => row.solved)!
    const evidence = buildAttemptEvidence("gpt5", "attempt", record)
    assert.equal(evidence.solved, true)
    assert.equal(evidence.firstMove.correct, true)
    assert.equal(evidence.outcome, "Solved")
    const incomplete = buildAttemptEvidence("gpt5", "attempt", {
      ...record,
      solved: false,
      status: "ok",
      invalidTurnIndex: null,
    })
    assert.equal(incomplete.outcome, "Unsolved")
  })
})
