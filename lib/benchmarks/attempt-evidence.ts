import { moveToken, readableMove } from "../chess/moves"
import type {
  LichessPuzzleAttemptRow,
  LichessPuzzleAttemptStatus,
  LichessPuzzleAttemptTurn,
} from "./local-runner"

/** An attempt record without its turns, which are fetched when a transcript opens. */
export type AttemptSummary = Omit<LichessPuzzleAttemptRow, "turns">

/** A recorded attempt and the meaning shared by its summary and exports. */
export type AttemptEvidence<Model extends string = string> = {
  attemptId: string
  model: Model
  solved: boolean
  firstMove: { uci: string; label: string; correct: boolean | null }
  status: LichessPuzzleAttemptStatus
  outcome: string
  /** Why an unsolved attempt ended, in a sentence; empty when solved. */
  outcomeHint: string
  thinkingMs: number
  thinkingTokens: number | null
  record: AttemptSummary
}

const outcomeLabels: Record<LichessPuzzleAttemptStatus, string> = {
  ok: "Unsolved",
  wrong_move: "Wrong move",
  illegal_move: "Illegal move",
  invalid_format: "Invalid format",
  timeout: "Move time limit exceeded",
  error: "Error",
}

const outcomeHints: Record<LichessPuzzleAttemptStatus, string> = {
  ok: "Ended without completing the line.",
  wrong_move: "A legal move, but not the solution.",
  illegal_move: "Reads as a move, but not a legal one here.",
  invalid_format: "The answer was not a single move token.",
  timeout: "No answer within the move time limit.",
  error: "The provider returned an error.",
}

export function buildAttemptEvidence<Model extends string>(
  model: Model,
  attemptId: string,
  row: AttemptSummary,
  /** The final turn's raw answer; shown when the first move was illegal. */
  finalAnswer = ""
): AttemptEvidence<Model> {
  const playedMove = row.submittedPlayerMoves[0] ?? ""
  const illegalFirst =
    row.status === "illegal_move" && row.invalidTurnIndex === 0
  const illegalToken = illegalFirst ? moveToken(finalAnswer) : ""
  return {
    attemptId,
    model,
    solved: row.solved,
    firstMove: {
      uci: playedMove,
      label: playedMove
        ? readableMove(playedMove)
        : illegalToken
          ? // Struck through like a wrong move; the outcome line says it was illegal.
            readableMove(illegalToken)
          : "No valid move",
      correct: playedMove ? row.firstMoveCorrect : illegalFirst ? false : null,
    },
    status: row.status,
    outcomeHint: row.solved ? "" : outcomeHints[row.status],
    outcome: row.solved
      ? "Solved"
      : `${outcomeLabels[row.status]}${row.invalidTurnIndex === null ? "" : ` on turn ${row.invalidTurnIndex + 1}`}`,
    thinkingMs: row.latencyMsTotal,
    thinkingTokens: row.reasoningTokens ?? row.totalTokens,
    record: row,
  }
}

/**
 * A turn's reasoning as readable text (the AI SDK's join of the readable
 * reasoning parts), or `hidden` when the model reasoned but this response
 * carried only signed, encrypted, or no text (always for Claude, GPT, and
 * Grok; on some Gemini turns), or nothing when it did not reason at all.
 */
export function turnReasoning(
  turn: LichessPuzzleAttemptTurn
): { text: string } | "hidden" | null {
  const text = turn.reasoningText ?? ""
  if (text.trim()) return { text }
  const signedOrEncrypted =
    Array.isArray(turn.reasoning) && turn.reasoning.length > 0
  return signedOrEncrypted || (turn.usage?.reasoningTokens ?? 0) > 0
    ? "hidden"
    : null
}

/** Download the recorded evidence, including structured turns and provider metadata. */
export function attemptJson(record: LichessPuzzleAttemptRow): string {
  return `${JSON.stringify(record, null, 2)}\n`
}

export function attemptTranscript(row: LichessPuzzleAttemptRow): string {
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
    `Reasoning level: ${row.reasoningLevel || "not recorded"}`,
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
    ...reasoningLines(turnReasoning(turn)),
    ...(turn.errorMessage ? [`Error: ${turn.errorMessage}`] : []),
  ])

  return [...header, ...turnText].join("\n")
}

function reasoningLines(reasoning: ReturnType<typeof turnReasoning>) {
  if (reasoning === "hidden")
    return ["Reasoning: not returned as readable text"]
  return reasoning ? ["Reasoning:", reasoning.text] : []
}
