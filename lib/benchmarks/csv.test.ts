import assert from "node:assert/strict"
import { describe, test } from "node:test"
import type { LichessPuzzleAttemptRow } from "./local-runner"
import {
  ATTEMPT_CSV_HEADER,
  parseAttemptRows,
  parseCsvRecords,
  serializeAttemptRow,
} from "./csv"

describe("CSV parsing", () => {
  test("preserves quoted commas, quotes, and embedded newlines", () => {
    const records = parseCsvRecords(
      [
        "id,message,turns_json",
        'row-1,"first line',
        'second line","[{""rawAnswer"":""Rxa6""}]"',
      ].join("\n")
    )

    assert.deepEqual(records, [
      ["id", "message", "turns_json"],
      ["row-1", "first line\nsecond line", '[{"rawAnswer":"Rxa6"}]'],
    ])
  })
})

describe("attempt row codec", () => {
  test("header matches the tracked result files", () => {
    assert.equal(
      ATTEMPT_CSV_HEADER,
      "run_id,created_at,benchmark,prompt_template_id,model,item_id,lichess_puzzle_id,rating,rating_band,rating_bucket,primary_theme,status,solved,first_move_correct,exact_player_line,player_move_prefix_score,expected_full_line,expected_player_line,submitted_player_moves,revealed_opponent_moves,invalid_turn_index,error_message,latency_ms_total,input_tokens,output_tokens,total_tokens,reasoning_effort,max_output_tokens,reasoning_tokens,cost_usd,served_provider,generation_id,turns_json"
    )
  })

  test("round-trips a fully populated row", () => {
    const row: LichessPuzzleAttemptRow = {
      runId: "20260606T080351Z-097b1682",
      createdAt: "2026-06-06T08:51:26.315Z",
      benchmark: "lichess-puzzles-v1",
      promptTemplateId: "uci-or-san-single-move-v3",
      model: "openai/gpt-5-nano",
      itemId: "lichess:rYFDJ",
      lichessPuzzleId: "rYFDJ",
      rating: 962,
      ratingBand: "under-1200",
      ratingBucket: "0900-0999",
      primaryTheme: "bishopEndgame",
      status: "wrong_move",
      solved: false,
      firstMoveCorrect: true,
      exactPlayerLine: false,
      playerMovePrefixScore: 0.5,
      expectedFullLine: ["c2c4", "b5c4", "b3c4"],
      expectedPlayerLine: ["c2c4", "b3c4"],
      submittedPlayerMoves: ["c2c4", "h4h5"],
      revealedOpponentMoves: ["b5c4"],
      invalidTurnIndex: 1,
      errorMessage: 'provider said "no", then\nretried',
      latencyMsTotal: 2122,
      inputTokens: 145,
      outputTokens: 4,
      totalTokens: 149,
      reasoningEffort: "low",
      maxOutputTokens: 4096,
      reasoningTokens: 0,
      costUsd: 0.000198,
      servedProvider: "openai",
      generationId: "gen_01",
      turns: [
        {
          turnIndex: 0,
          prompt:
            'Position FEN: 8/8 w - - 0 1\nReply with "one" move, e.g. e2e4',
          rawAnswer: "c2c4",
          parsedMove: "c2c4",
          expectedMove: "c2c4",
          result: "correct",
          errorMessage: "",
          reasoning: [],
          usage: { inputTokens: 145, outputTokens: 4, totalTokens: 149 },
          costUsd: 0.000198,
          servedProvider: "openai",
          generationId: "gen_01",
        },
      ],
    }

    const csv = `${ATTEMPT_CSV_HEADER}\n${serializeAttemptRow(row)}\n`
    assert.deepEqual(parseAttemptRows(csv), [row])
  })
})
