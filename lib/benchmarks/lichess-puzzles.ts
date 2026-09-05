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

const ratingBandOrder: RatingBandId[] = [
  "under-1200",
  "1200-1599",
  "1600-1999",
  "2000-2399",
  "2400-plus",
]

export const LICHESS_PUZZLE_PROMPT_TEMPLATE_ID = "uci-or-san-single-move-v3"

const outputInstructions = [
  "Output contract:",
  "Return exactly one legal chess move for the side to move.",
  "Accepted notation: UCI such as e2e4 or e7e8q, or SAN such as Nf3, Rxa6, O-O, or exd8=Q+.",
  "Your entire response must be only that move token. No explanation, labels, move numbers, code block, or extra text.",
]

export function buildLichessPuzzleInitialPrompt(
  item: Pick<LichessPuzzleBenchmarkItem, "position">
): string {
  return [
    `Position FEN: ${item.position.fen}`,
    "Find the best move for the side to move.",
    ...outputInstructions,
  ].join("\n")
}

export function buildLichessPuzzleFollowupPrompt(opponentMove: string): string {
  return [
    `Opponent played: ${opponentMove}.`,
    "Find the next move.",
    ...outputInstructions,
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
