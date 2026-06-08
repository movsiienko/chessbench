import { Chess } from "chess.js"

import {
  LICHESS_PUZZLE_PROMPT_TEMPLATE_ID,
  buildLichessPuzzleFollowupPrompt,
  buildLichessPuzzleInitialPrompt,
  type LichessPuzzleBenchmarkItem,
} from "./lichess-puzzles"

export type BenchmarkMessage = {
  role: "user" | "assistant"
  content: string
}

export type GenerateBenchmarkText = (input: {
  model: string
  messages: BenchmarkMessage[]
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
}>

export type LichessPuzzleTurnResult =
  | "correct"
  | "wrong_move"
  | "invalid_format"
  | "error"

export type LichessPuzzleAttemptStatus =
  | "ok"
  | "wrong_move"
  | "invalid_format"
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
  reasoningTokens: number | null
  costUsd: number | null
  servedProvider: string
  generationId: string
  turns: LichessPuzzleAttemptTurn[]
}

const STRICT_UCI_PATTERN = /^[a-h][1-8][a-h][1-8][qrbn]?$/i

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
  const messages: BenchmarkMessage[] = []
  const turns: LichessPuzzleAttemptTurn[] = []
  const submittedPlayerMoves: string[] = []
  const revealedOpponentMoves: string[] = []
  let status: LichessPuzzleAttemptStatus = "ok"
  let invalidTurnIndex: number | null = null
  let errorMessage = ""
  let latencyMsTotal = 0
  let inputTokens = 0
  let outputTokens = 0
  let totalTokens = 0
  let reasoningTokens = 0
  let costUsd = 0
  let hasUsage = false
  let hasReasoningUsage = false
  let hasCost = false
  let servedProvider = ""
  let generationId = ""
  const position = new Chess(item.position.fen)

  for (
    let playerMoveIndex = 0;
    playerMoveIndex < item.expected.playerUciMoves.length;
    playerMoveIndex += 1
  ) {
    const expectedMove = item.expected.playerUciMoves[playerMoveIndex]
    const prompt =
      playerMoveIndex === 0
        ? buildLichessPuzzleInitialPrompt(item)
        : buildLichessPuzzleFollowupPrompt(
            item.expected.uciLine[playerMoveIndex * 2 - 1]
          )

    messages.push({ role: "user", content: prompt })

    try {
      const response = await generate({ model, messages: [...messages] })
      latencyMsTotal += response.latencyMs

      if (response.usage) {
        hasUsage = true
        inputTokens += response.usage.inputTokens ?? 0
        outputTokens += response.usage.outputTokens ?? 0
        totalTokens += response.usage.totalTokens ?? 0

        if (response.usage.reasoningTokens !== undefined) {
          hasReasoningUsage = true
          reasoningTokens += response.usage.reasoningTokens
        }
      }

      if (response.costUsd !== undefined) {
        hasCost = true
        costUsd += response.costUsd
      }

      if (response.servedProvider) {
        servedProvider = response.servedProvider
      }

      if (response.generationId) {
        generationId = response.generationId
      }

      const rawAnswer = response.text
      const parsedMove = parseAcceptedMoveAnswer(rawAnswer, position.fen())
      const turnUsage = response.usage
        ? {
            inputTokens: response.usage.inputTokens,
            outputTokens: response.usage.outputTokens,
            totalTokens: response.usage.totalTokens,
            reasoningTokens: response.usage.reasoningTokens,
            raw: response.usage.raw,
          }
        : undefined
      const turnMetadata = {
        reasoningText: response.reasoningText,
        reasoning: response.reasoning,
        usage: turnUsage,
        costUsd: response.costUsd,
        servedProvider: response.servedProvider,
        generationId: response.generationId,
      }

      messages.push({ role: "assistant", content: rawAnswer })

      if (!parsedMove) {
        status = "invalid_format"
        invalidTurnIndex = playerMoveIndex
        turns.push({
          turnIndex: playerMoveIndex,
          prompt,
          rawAnswer,
          parsedMove: "",
          expectedMove,
          result: "invalid_format",
          errorMessage: "",
          ...turnMetadata,
        })
        break
      }

      submittedPlayerMoves.push(parsedMove)

      if (parsedMove !== expectedMove) {
        status = "wrong_move"
        invalidTurnIndex = playerMoveIndex
        turns.push({
          turnIndex: playerMoveIndex,
          prompt,
          rawAnswer,
          parsedMove,
          expectedMove,
          result: "wrong_move",
          errorMessage: "",
          ...turnMetadata,
        })
        break
      }

      turns.push({
        turnIndex: playerMoveIndex,
        prompt,
        rawAnswer,
        parsedMove,
        expectedMove,
        result: "correct",
        errorMessage: "",
        ...turnMetadata,
      })

      applyUciMove(position, parsedMove)
      const opponentMove = item.expected.uciLine[playerMoveIndex * 2 + 1]

      if (
        opponentMove &&
        playerMoveIndex < item.expected.playerUciMoves.length - 1
      ) {
        applyUciMove(position, opponentMove)
        revealedOpponentMoves.push(opponentMove)
      }
    } catch (error) {
      status = "error"
      invalidTurnIndex = playerMoveIndex
      errorMessage = error instanceof Error ? error.message : String(error)
      turns.push({
        turnIndex: playerMoveIndex,
        prompt,
        rawAnswer: "",
        parsedMove: "",
        expectedMove,
        result: "error",
        errorMessage,
      })
      break
    }
  }

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
    status,
    solved: status === "ok" && exactPlayerLine,
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
    revealedOpponentMoves,
    invalidTurnIndex,
    errorMessage,
    latencyMsTotal,
    inputTokens: hasUsage ? inputTokens : null,
    outputTokens: hasUsage ? outputTokens : null,
    totalTokens: hasUsage ? totalTokens : null,
    reasoningTokens: hasReasoningUsage ? reasoningTokens : null,
    costUsd: hasCost ? costUsd : null,
    servedProvider,
    generationId,
    turns,
  }
}

export function parseStrictUciMove(answer: string): string | null {
  const trimmed = answer.trim()

  if (!STRICT_UCI_PATTERN.test(trimmed)) {
    return null
  }

  return trimmed.toLowerCase()
}

export function parseAcceptedMoveAnswer(
  answer: string,
  fen: string
): string | null {
  const normalized = normalizeMoveAnswer(answer)

  if (!normalized) {
    return null
  }

  const uciMove = parseStrictUciMove(normalized)

  if (uciMove) {
    return parseUciMove(uciMove, fen)
  }

  return parseSanMove(normalized, fen)
}

function parseUciMove(answer: string, fen: string): string | null {
  try {
    const chess = new Chess(fen)
    const move = chess.move(uciToMoveObject(answer))
    return `${move.from}${move.to}${move.promotion ?? ""}`.toLowerCase()
  } catch {
    return null
  }
}

function parseSanMove(answer: string, fen: string): string | null {
  try {
    const chess = new Chess(fen)
    const move = chess.move(answer)
    return `${move.from}${move.to}${move.promotion ?? ""}`.toLowerCase()
  } catch {
    return null
  }
}

function applyUciMove(chess: Chess, uci: string) {
  chess.move(uciToMoveObject(uci))
}

function uciToMoveObject(uci: string) {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci[4],
  }
}

function normalizeMoveAnswer(answer: string): string {
  let normalized = answer
    .trim()
    .replaceAll("×", "x")
    .replaceAll("–", "-")
    .replaceAll("—", "-")

  const fenced = normalized.match(
    /^```(?:text|chess|pgn)?\s*([\s\S]*?)\s*```$/i
  )
  if (fenced?.[1]) {
    normalized = fenced[1].trim()
  }

  const wrapped = normalized.match(/^`([^`\n]+)`$/)
  if (wrapped?.[1]) {
    normalized = wrapped[1].trim()
  }

  normalized = normalized.replace(/^\d+\.(?:\.\.)?\s*/, "")
  normalized = normalized.replace(/[.!?]+$/g, "")

  if (/^0-0(?:-0)?[+#]?$/i.test(normalized)) {
    normalized = normalized.replaceAll("0", "O")
  }

  return /\s/.test(normalized) ? "" : normalized
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
