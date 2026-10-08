import { readableMove } from "../chess/moves"
import type {
  LichessPuzzleAttemptRow,
  LichessPuzzleAttemptStatus,
} from "./local-runner"

/** A recorded attempt and the meaning shared by its summary and exports. */
export type AttemptEvidence<Model extends string = string> = {
  model: Model
  solved: boolean
  firstMove: { uci: string; label: string; correct: boolean | null }
  outcome: string
  thinkingMs: number
  thinkingTokens: number | null
  record: LichessPuzzleAttemptRow
}

const outcomeLabels: Record<LichessPuzzleAttemptStatus, string> = {
  ok: "Unsolved",
  wrong_move: "Wrong move",
  invalid_format: "Invalid answer",
  error: "Error",
}

export function buildAttemptEvidence<Model extends string>(
  model: Model,
  row: LichessPuzzleAttemptRow
): AttemptEvidence<Model> {
  const playedMove = row.submittedPlayerMoves[0] ?? ""
  return {
    model,
    solved: row.solved,
    firstMove: {
      uci: playedMove,
      label: playedMove ? readableMove(playedMove) : "No valid move",
      correct: playedMove ? row.firstMoveCorrect : null,
    },
    outcome: row.solved
      ? "Solved"
      : `${outcomeLabels[row.status]}${row.invalidTurnIndex === null ? "" : ` on turn ${row.invalidTurnIndex + 1}`}`,
    thinkingMs: row.latencyMsTotal,
    thinkingTokens: row.reasoningTokens ?? row.totalTokens,
    record: row,
  }
}

/** Download the recorded evidence, including structured turns and provider metadata. */
export function attemptJson(attempt: AttemptEvidence): string {
  return `${JSON.stringify(attempt.record, null, 2)}\n`
}

export function attemptTranscript(attempt: AttemptEvidence): string {
  const row = attempt.record
  const header = [
    `# ${row.model} trace - ${row.itemId}`,
    `Run: ${row.runId}`,
    `Generation: ${row.generationId || "not recorded"}`,
    `Served provider: ${row.servedProvider || "not recorded"}`,
    `Status: ${row.status}`,
    `Solved: ${row.solved}`,
    `Expected player line: ${row.expectedPlayerLine.join(" ")}`,
    `Submitted player moves: ${row.submittedPlayerMoves.join(" ")}`,
    `Latency: ${row.latencyMsTotal}ms`,
    `Tokens: ${row.totalTokens ?? "not recorded"}`,
    `Reasoning effort: ${row.reasoningEffort || "not recorded"}`,
    `Max output tokens: ${row.maxOutputTokens ?? "not recorded"}`,
    `Reasoning tokens: ${row.reasoningTokens ?? "not recorded"}`,
    `Cost USD: ${row.costUsd ?? "not recorded"}`,
  ]

  const turnText = row.turns.flatMap((turn) => [
    "",
    `Turn ${turn.turnIndex + 1}`,
    "Prompt:",
    turn.prompt,
    "Raw answer:",
    turn.rawAnswer || "(empty)",
    `Parsed move: ${turn.parsedMove || "(none)"}`,
    `Expected move: ${turn.expectedMove}`,
    `Result: ${turn.result}`,
    ...(turn.reasoningText ? ["Reasoning:", turn.reasoningText] : []),
    ...(!turn.reasoningText && turn.reasoning !== undefined
      ? ["Recorded reasoning:", JSON.stringify(turn.reasoning, null, 2)]
      : []),
    ...(turn.errorMessage ? [`Error: ${turn.errorMessage}`] : []),
  ])

  return [...header, ...turnText].join("\n")
}
