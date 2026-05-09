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
  latencyMs: number
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
  }
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
  parsedMove: string
  expectedMove: string
  result: LichessPuzzleTurnResult
  errorMessage: string
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
  let hasUsage = false

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
      }

      const rawAnswer = response.text
      const parsedMove = parseStrictUciMove(rawAnswer)

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
      })

      const opponentMove = item.expected.uciLine[playerMoveIndex * 2 + 1]

      if (
        opponentMove &&
        playerMoveIndex < item.expected.playerUciMoves.length - 1
      ) {
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
