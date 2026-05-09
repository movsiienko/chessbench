export type RatingBandId =
  | "under-1200"
  | "1200-1599"
  | "1600-1999"
  | "2000-2399"
  | "2400-plus"

export type PuzzleLength = "short" | "long" | "veryLong" | "unknown"

export type ThemeGroupId =
  | "attack"
  | "checkmate"
  | "defense"
  | "endgame"
  | "material"
  | "positional"
  | "special"
  | "tactic"
  | "other"

export type PuzzleMoveCounts = {
  solutionPlies: number
  playerMoves: number
  opponentReplies: number
}

export type LichessPuzzleBenchmarkItem = {
  id: string
  benchmark: "lichess-puzzles-v1"
  position: {
    triggerFen: string
    triggerMove: string
    fen: string
    sideToMove: "w" | "b"
  }
  expected: {
    uciLine: string[]
    playerUciMoves: string[]
    finalFen: string
  }
  metadata: {
    lichessPuzzleId: string
    lichessGameUrl: string
    rating: number
    ratingDeviation: number
    popularity: number
    nbPlays: number
    ratingBand: RatingBandId
    ratingBucket: string
    length: PuzzleLength
    moveCounts: PuzzleMoveCounts
    primaryTheme: string
    themeGroups: ThemeGroupId[]
    themes: string[]
    openingTags: string[]
  }
}

export type LichessPuzzleScore = {
  solved: boolean
  firstMoveCorrect: boolean
  exactFullLine: boolean
  exactPlayerLine: boolean
  fullLinePrefixScore: number
  playerMovePrefixScore: number
  submittedMoves: string[]
  submittedPlayerMoves: string[]
}

const UCI_MOVE_PATTERN = /\b[a-h][1-8][a-h][1-8][qrbn]?\b/gi
const ratingBandOrder: RatingBandId[] = [
  "under-1200",
  "1200-1599",
  "1600-1999",
  "2000-2399",
  "2400-plus",
]

export const LICHESS_PUZZLE_PROMPT_TEMPLATE_ID = "uci-next-move-v1"

export function buildLichessPuzzleInitialPrompt(
  item: Pick<LichessPuzzleBenchmarkItem, "position">
): string {
  return [
    `Position FEN: ${item.position.fen}`,
    "Find the best move for the side to move.",
    "Reply with UCI move notation only.",
  ].join("\n")
}

export function buildLichessPuzzleFollowupPrompt(opponentMove: string): string {
  return [
    `Opponent played: ${opponentMove}.`,
    "Find the next move.",
    "Reply with UCI move notation only.",
  ].join("\n")
}

export function selectDefaultLichessPuzzleItems(
  items: LichessPuzzleBenchmarkItem[],
  limit: number
): LichessPuzzleBenchmarkItem[] {
  if (limit >= items.length) {
    return items
  }

  const selected: LichessPuzzleBenchmarkItem[] = []
  const byBand = new Map<RatingBandId, LichessPuzzleBenchmarkItem[]>(
    ratingBandOrder.map((band) => [band, []])
  )

  for (const item of items) {
    byBand.get(item.metadata.ratingBand)?.push(item)
  }

  const basePerBand = Math.floor(limit / ratingBandOrder.length)
  let remainder = limit % ratingBandOrder.length

  for (const band of ratingBandOrder) {
    const bandItems = byBand.get(band) ?? []
    const bandLimit = basePerBand + (remainder > 0 ? 1 : 0)
    remainder -= remainder > 0 ? 1 : 0
    selected.push(...bandItems.slice(0, bandLimit))
  }

  return selected
}

export function extractUciMoves(answer: string): string[] {
  return (answer.match(UCI_MOVE_PATTERN) ?? []).map((move) =>
    move.toLowerCase()
  )
}

export function scoreLichessPuzzleAnswer(
  item: Pick<LichessPuzzleBenchmarkItem, "expected">,
  answer: string
): LichessPuzzleScore {
  const submittedMoves = extractUciMoves(answer)
  const expectedFullLine = item.expected.uciLine
  const expectedPlayerLine = item.expected.playerUciMoves
  const exactFullLine = sameLine(submittedMoves, expectedFullLine)
  const exactPlayerLine = sameLine(submittedMoves, expectedPlayerLine)
  const likelyFullLine =
    exactFullLine ||
    submittedMoves.length === expectedFullLine.length ||
    submittedMoves[1] === expectedFullLine[1]

  const submittedPlayerMoves = likelyFullLine
    ? submittedMoves.filter((_, index) => index % 2 === 0)
    : submittedMoves

  return {
    solved: exactFullLine || exactPlayerLine,
    firstMoveCorrect: submittedMoves[0] === expectedPlayerLine[0],
    exactFullLine,
    exactPlayerLine,
    fullLinePrefixScore: prefixScore(submittedMoves, expectedFullLine),
    playerMovePrefixScore: prefixScore(
      submittedPlayerMoves,
      expectedPlayerLine
    ),
    submittedMoves,
    submittedPlayerMoves,
  }
}

function sameLine(actual: string[], expected: string[]): boolean {
  return (
    actual.length === expected.length &&
    prefixCount(actual, expected) === expected.length
  )
}

function prefixScore(actual: string[], expected: string[]): number {
  if (expected.length === 0) {
    return actual.length === 0 ? 1 : 0
  }

  return prefixCount(actual, expected) / expected.length
}

function prefixCount(actual: string[], expected: string[]): number {
  let correct = 0

  for (let index = 0; index < expected.length; index += 1) {
    if (actual[index] !== expected[index]) {
      break
    }

    correct += 1
  }

  return correct
}
