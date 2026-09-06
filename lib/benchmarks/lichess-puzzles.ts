import { readFile } from "node:fs/promises"

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

export async function loadItems(
  path: string
): Promise<LichessPuzzleBenchmarkItem[]> {
  const contents = await readFile(path, "utf8")
  // SAFETY: items.jsonl is written by prepare-lichess-puzzles.ts as one LichessPuzzleBenchmarkItem per line.
  return contents
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LichessPuzzleBenchmarkItem)
}

const ratingBandOrder: RatingBandId[] = [
  "under-1200",
  "1200-1599",
  "1600-1999",
  "2000-2399",
  "2400-plus",
]

export const LICHESS_PUZZLE_PROMPT_TEMPLATE_ID = "uci-or-san-single-move-v3"

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
