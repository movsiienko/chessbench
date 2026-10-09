import { Chess } from "chess.js"

import { applyUciMove, parseAcceptedMoveAnswer } from "../chess/moves"
import {
  LICHESS_PUZZLE_PROMPT_TEMPLATE_ID,
  type LichessPuzzleBenchmarkItem,
} from "./lichess-puzzles"

const outputInstructions = [
  "Output contract:",
  "Return exactly one legal chess move for the side to move.",
  "Accepted notation: UCI such as e2e4 or e7e8q, or SAN such as Nf3, Rxa6, O-O, or exd8=Q+.",
  "Your entire response must be only that move token. No explanation, labels, move numbers, code block, or extra text.",
]

export type BenchmarkMessage = {
  role: "user" | "assistant"
  content: string
}

export type GenerateBenchmarkText = (input: {
  model: string
  messages: BenchmarkMessage[]
  abortSignal?: AbortSignal
}) => Promise<{
  text: string
  reasoningText?: string
  reasoning?: unknown
  latencyMs: number
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
    reasoningTokens?: number
    raw?: unknown
  }
  costUsd?: number
  generationId?: string
  servedProvider?: string
  warnings?: string[]
}>

export type LichessPuzzleTurnResult =
  | "correct"
  | "wrong_move"
  | "invalid_format"
  | "timeout"
  | "error"

export type LichessPuzzleAttemptStatus =
  | "ok"
  | "wrong_move"
  | "invalid_format"
  | "timeout"
  | "error"

export type LichessPuzzleAttemptTurn = {
  turnIndex: number
  prompt: string
  rawAnswer: string
  reasoningText?: string
  reasoning?: unknown
  parsedMove: string
  expectedMove: string
  result: LichessPuzzleTurnResult
  errorMessage: string
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
    reasoningTokens?: number
    raw?: unknown
  }
  costUsd?: number
  servedProvider?: string
  generationId?: string
  warnings?: string[]
}

export type LichessPuzzleAttemptRow = {
  runId: string
  createdAt: string
  benchmark: "lichess-puzzles-v1"
  promptTemplateId: typeof LICHESS_PUZZLE_PROMPT_TEMPLATE_ID
  model: string
  itemId: string
  lichessPuzzleId: string
  rating: number
  ratingBand: string
  ratingBucket: string
  primaryTheme: string
  status: LichessPuzzleAttemptStatus
  solved: boolean
  firstMoveCorrect: boolean
  exactPlayerLine: boolean
  playerMovePrefixScore: number
  expectedFullLine: string[]
  expectedPlayerLine: string[]
  submittedPlayerMoves: string[]
  revealedOpponentMoves: string[]
  invalidTurnIndex: number | null
  errorMessage: string
  latencyMsTotal: number
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  reasoningEffort?: string
  maxOutputTokens?: number | null
  reasoningTokens: number | null
  costUsd: number | null
  servedProvider: string
  generationId: string
  turns: LichessPuzzleAttemptTurn[]
}

type GeneratedTurn = Awaited<ReturnType<GenerateBenchmarkText>>

/**
 * An attempt between turns. Plain data, so a workflow can carry it from one
 * step to the next and each paid model call can be its own step.
 */
export type AttemptState = {
  messages: BenchmarkMessage[]
  turns: LichessPuzzleAttemptTurn[]
  submittedPlayerMoves: string[]
  revealedOpponentMoves: string[]
  status: LichessPuzzleAttemptStatus
  invalidTurnIndex: number | null
  errorMessage: string
  latencyMsTotal: number
  // null until a turn reports the figure, then a running total.
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  reasoningTokens: number | null
  costUsd: number | null
  servedProvider: string
  generationId: string
  done: boolean
}

export function startAttempt(): AttemptState {
  return {
    messages: [],
    turns: [],
    submittedPlayerMoves: [],
    revealedOpponentMoves: [],
    status: "ok",
    invalidTurnIndex: null,
    errorMessage: "",
    latencyMsTotal: 0,
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    reasoningTokens: null,
    costUsd: null,
    servedProvider: "",
    generationId: "",
    done: false,
  }
}

/** The conversation to send for the next turn, ending with its prompt. */
export function nextTurnMessages(
  item: LichessPuzzleBenchmarkItem,
  state: AttemptState
): BenchmarkMessage[] {
  return [...state.messages, { role: "user", content: turnPrompt(item, state) }]
}

/** Scores the model's answer to the next turn. */
export function recordAnswer(
  item: LichessPuzzleBenchmarkItem,
  state: AttemptState,
  response: GeneratedTurn
): AttemptState {
  const turnIndex = state.turns.length
  const prompt = turnPrompt(item, state)
  const expectedMove = item.expected.playerUciMoves[turnIndex]
  const position = positionBefore(item, state)
  const rawAnswer = response.text
  const parsedMove = parseAcceptedMoveAnswer(rawAnswer, position.fen())
  const usage = response.usage
  const next: AttemptState = {
    ...state,
    messages: [
      ...state.messages,
      { role: "user", content: prompt },
      { role: "assistant", content: rawAnswer },
    ],
    latencyMsTotal: state.latencyMsTotal + response.latencyMs,
    inputTokens: usage
      ? (state.inputTokens ?? 0) + (usage.inputTokens ?? 0)
      : state.inputTokens,
    outputTokens: usage
      ? (state.outputTokens ?? 0) + (usage.outputTokens ?? 0)
      : state.outputTokens,
    totalTokens: usage
      ? (state.totalTokens ?? 0) + (usage.totalTokens ?? 0)
      : state.totalTokens,
    reasoningTokens:
      usage?.reasoningTokens !== undefined
        ? (state.reasoningTokens ?? 0) + usage.reasoningTokens
        : state.reasoningTokens,
    costUsd:
      response.costUsd !== undefined
        ? (state.costUsd ?? 0) + response.costUsd
        : state.costUsd,
    servedProvider: response.servedProvider || state.servedProvider,
    generationId: response.generationId || state.generationId,
  }
  const turn = {
    turnIndex,
    prompt,
    rawAnswer,
    parsedMove: parsedMove ?? "",
    expectedMove,
    errorMessage: "",
    reasoningText: response.reasoningText,
    reasoning: response.reasoning,
    usage: usage
      ? {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
          reasoningTokens: usage.reasoningTokens,
          raw: usage.raw,
        }
      : undefined,
    costUsd: response.costUsd,
    servedProvider: response.servedProvider,
    generationId: response.generationId,
    warnings: response.warnings?.length ? response.warnings : undefined,
  }

  if (!parsedMove) {
    return {
      ...next,
      status: "invalid_format",
      invalidTurnIndex: turnIndex,
      turns: [...state.turns, { ...turn, result: "invalid_format" }],
      done: true,
    }
  }

  const submittedPlayerMoves = [...state.submittedPlayerMoves, parsedMove]

  if (parsedMove !== expectedMove) {
    return {
      ...next,
      submittedPlayerMoves,
      status: "wrong_move",
      invalidTurnIndex: turnIndex,
      turns: [...state.turns, { ...turn, result: "wrong_move" }],
      done: true,
    }
  }

  const lastTurn = turnIndex === item.expected.playerUciMoves.length - 1
  const opponentMove = item.expected.uciLine[turnIndex * 2 + 1]

  return {
    ...next,
    submittedPlayerMoves,
    revealedOpponentMoves:
      opponentMove && !lastTurn
        ? [...state.revealedOpponentMoves, opponentMove]
        : state.revealedOpponentMoves,
    turns: [...state.turns, { ...turn, result: "correct" }],
    done: lastTurn,
  }
}

/**
 * Ends the attempt on a turn that produced no answer: a provider `error`
 * (pending, retried by a later run) or an exceeded move time limit
 * (`timeout`, a failed turn like a wrong move).
 */
export function recordFailure(
  item: LichessPuzzleBenchmarkItem,
  state: AttemptState,
  result: "error" | "timeout",
  errorMessage: string
): AttemptState {
  const turnIndex = state.turns.length

  return {
    ...state,
    status: result,
    invalidTurnIndex: turnIndex,
    errorMessage,
    turns: [
      ...state.turns,
      {
        turnIndex,
        prompt: turnPrompt(item, state),
        rawAnswer: "",
        parsedMove: "",
        expectedMove: item.expected.playerUciMoves[turnIndex],
        result,
        errorMessage,
      },
    ],
    done: true,
  }
}

export function attemptRow(
  {
    runId,
    model,
    item,
    createdAt,
  }: {
    runId: string
    model: string
    item: LichessPuzzleBenchmarkItem
    createdAt: string
  },
  state: AttemptState
): LichessPuzzleAttemptRow {
  const { submittedPlayerMoves } = state
  const exactPlayerLine = sameLine(
    submittedPlayerMoves,
    item.expected.playerUciMoves
  )

  return {
    runId,
    createdAt,
    benchmark: item.benchmark,
    promptTemplateId: LICHESS_PUZZLE_PROMPT_TEMPLATE_ID,
    model,
    itemId: item.id,
    lichessPuzzleId: item.metadata.lichessPuzzleId,
    rating: item.metadata.rating,
    ratingBand: item.metadata.ratingBand,
    ratingBucket: item.metadata.ratingBucket,
    primaryTheme: item.metadata.primaryTheme,
    status: state.status,
    solved: state.status === "ok" && exactPlayerLine,
    firstMoveCorrect:
      submittedPlayerMoves[0] === item.expected.playerUciMoves[0],
    exactPlayerLine,
    playerMovePrefixScore: prefixScore(
      submittedPlayerMoves,
      item.expected.playerUciMoves
    ),
    expectedFullLine: item.expected.uciLine,
    expectedPlayerLine: item.expected.playerUciMoves,
    submittedPlayerMoves,
    revealedOpponentMoves: state.revealedOpponentMoves,
    invalidTurnIndex: state.invalidTurnIndex,
    errorMessage: state.errorMessage,
    latencyMsTotal: state.latencyMsTotal,
    inputTokens: state.inputTokens,
    outputTokens: state.outputTokens,
    totalTokens: state.totalTokens,
    reasoningTokens: state.reasoningTokens,
    costUsd: state.costUsd,
    servedProvider: state.servedProvider,
    generationId: state.generationId,
    turns: state.turns,
  }
}

/** A whole attempt in one process: every turn in sequence. */
export async function runLichessPuzzleAttempt({
  runId,
  model,
  item,
  generate,
  createdAt = new Date().toISOString(),
}: {
  runId: string
  model: string
  item: LichessPuzzleBenchmarkItem
  generate: GenerateBenchmarkText
  createdAt?: string
}): Promise<LichessPuzzleAttemptRow> {
  let state = startAttempt()

  while (!state.done) {
    try {
      const messages = nextTurnMessages(item, state)
      state = recordAnswer(item, state, await generate({ model, messages }))
    } catch (error) {
      state = recordFailure(
        item,
        state,
        "error",
        error instanceof Error ? error.message : String(error)
      )
    }
  }

  return attemptRow({ runId, model, item, createdAt }, state)
}

function turnPrompt(item: LichessPuzzleBenchmarkItem, state: AttemptState) {
  const turnIndex = state.turns.length

  return [
    ...(turnIndex === 0
      ? [
          `Position FEN: ${item.position.fen}`,
          "Find the best move for the side to move.",
        ]
      : [
          `Opponent played: ${item.expected.uciLine[turnIndex * 2 - 1]}.`,
          "Find the next move.",
        ]),
    ...outputInstructions,
  ].join("\n")
}

/** Replays the correct moves so far and the replies they revealed. */
function positionBefore(item: LichessPuzzleBenchmarkItem, state: AttemptState) {
  const position = new Chess(item.position.fen)

  state.submittedPlayerMoves.forEach((move, index) => {
    applyUciMove(position, move)
    const reply = state.revealedOpponentMoves[index]
    if (reply) {
      applyUciMove(position, reply)
    }
  })

  return position
}

function sameLine(actual: string[], expected: string[]): boolean {
  return (
    actual.length === expected.length &&
    actual.every((move, index) => move === expected[index])
  )
}

function prefixScore(actual: string[], expected: string[]): number {
  if (expected.length === 0) {
    return actual.length === 0 ? 1 : 0
  }

  let correct = 0

  for (let index = 0; index < expected.length; index += 1) {
    if (actual[index] !== expected[index]) {
      break
    }

    correct += 1
  }

  return correct / expected.length
}
