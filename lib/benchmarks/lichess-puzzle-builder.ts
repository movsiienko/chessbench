import { Chess } from "chess.js"
import { applyUciMove } from "@/lib/chess/moves"
import { parseCsvRecords } from "./csv"
import type {
  LichessPuzzleBenchmarkItem,
  PuzzleLength,
  RatingBandId,
  ThemeGroupId,
} from "./lichess-puzzles"

// Methodology of lichess-puzzles-v1: the strata tables and the row -> item
// rules. Changing anything here changes the benchmark; items.jsonl is the
// reference and lichess-puzzle-builder.test.ts checks it byte for byte.

export const LICHESS_PUZZLE_COLUMNS = [
  "PuzzleId",
  "FEN",
  "Moves",
  "Rating",
  "RatingDeviation",
  "Popularity",
  "NbPlays",
  "Themes",
  "GameUrl",
  "OpeningTags",
] as const

export type LichessPuzzleCsvRow = Record<
  (typeof LICHESS_PUZZLE_COLUMNS)[number],
  string
>

export type RatingBand = {
  id: RatingBandId
  label: string
  min: number
  max: number
}

export const RATING_BANDS: RatingBand[] = [
  { id: "under-1200", label: "<1200", min: 0, max: 1199 },
  { id: "1200-1599", label: "1200-1599", min: 1200, max: 1599 },
  { id: "1600-1999", label: "1600-1999", min: 1600, max: 1999 },
  { id: "2000-2399", label: "2000-2399", min: 2000, max: 2399 },
  { id: "2400-plus", label: "2400+", min: 2400, max: Number.POSITIVE_INFINITY },
]

export const QUALITY_FILTERS = {
  minPopularity: 80,
  minPlays: 300,
  maxRatingDeviation: 110,
}

const structuralThemes = new Set([
  "short",
  "long",
  "veryLong",
  "opening",
  "middlegame",
  "endgame",
  "master",
  "masterVsMaster",
  "superGM",
])

const outcomeThemes = new Set(["advantage", "crushing"])

const themePriority = new Set([
  "mateIn2",
  "mateIn3",
  "mateIn4",
  "mateIn5",
  "mate",
  "fork",
  "pin",
  "skewer",
  "discoveredAttack",
  "discoveredCheck",
  "doubleCheck",
  "deflection",
  "decoy",
  "attraction",
  "clearance",
  "interference",
  "xRayAttack",
  "capturingDefender",
  "hangingPiece",
  "trappedPiece",
  "sacrifice",
  "promotion",
  "advancedPawn",
  "quietMove",
  "defensiveMove",
  "zugzwang",
  "backRankMate",
  "smotheredMate",
  "anastasiaMate",
  "arabianMate",
  "hookMate",
  "operaMate",
  "cornerMate",
  "morphysMate",
  "epauletteMate",
  "triangleMate",
  "bishopEndgame",
  "knightEndgame",
  "pawnEndgame",
  "queenEndgame",
  "queenRookEndgame",
  "rookEndgame",
  "kingsideAttack",
  "queensideAttack",
  "attackingF2F7",
  "crushing",
  "advantage",
])

const themeGroupsByTheme = new Map<string, ThemeGroupId>(
  Object.entries({
    advancedPawn: "special",
    anastasiaMate: "checkmate",
    arabianMate: "checkmate",
    attackingF2F7: "attack",
    attraction: "tactic",
    backRankMate: "checkmate",
    bishopEndgame: "endgame",
    capturingDefender: "material",
    clearance: "tactic",
    collinearMove: "tactic",
    cornerMate: "checkmate",
    crushing: "positional",
    decoy: "tactic",
    defensiveMove: "defense",
    deflection: "tactic",
    discoveredAttack: "tactic",
    discoveredCheck: "tactic",
    doubleCheck: "tactic",
    endgame: "endgame",
    enPassant: "special",
    epauletteMate: "checkmate",
    exposedKing: "attack",
    fork: "tactic",
    hangingPiece: "material",
    hookMate: "checkmate",
    interference: "tactic",
    kingsideAttack: "attack",
    knightEndgame: "endgame",
    mate: "checkmate",
    mateIn2: "checkmate",
    mateIn3: "checkmate",
    mateIn4: "checkmate",
    mateIn5: "checkmate",
    morphysMate: "checkmate",
    operaMate: "checkmate",
    pawnEndgame: "endgame",
    pin: "tactic",
    promotion: "special",
    queenEndgame: "endgame",
    queenRookEndgame: "endgame",
    queensideAttack: "attack",
    quietMove: "positional",
    rookEndgame: "endgame",
    sacrifice: "material",
    skewer: "tactic",
    smotheredMate: "checkmate",
    trappedPiece: "material",
    triangleMate: "checkmate",
    xRayAttack: "tactic",
    zugzwang: "positional",
  } as const)
)

export type ParsedPuzzleRow = {
  row: LichessPuzzleCsvRow
  quality: {
    rating: number
    ratingDeviation: number
    popularity: number
    nbPlays: number
  }
  band: RatingBand
  themes: string[]
}

export type PuzzleRowRejection = "invalidColumns" | "quality" | "mateIn1"

/** Cheap filters only; chess.js validation happens in buildPuzzleItem. */
export function parsePuzzleRow(
  line: string
): ParsedPuzzleRow | { rejected: PuzzleRowRejection } {
  let values: string[]

  try {
    values = parseCsvRecords(line)[0] ?? []
  } catch {
    return { rejected: "invalidColumns" }
  }

  if (values.length !== LICHESS_PUZZLE_COLUMNS.length) {
    return { rejected: "invalidColumns" }
  }

  // SAFETY: values.length === LICHESS_PUZZLE_COLUMNS.length was checked above, and the columns list every LichessPuzzleCsvRow key.
  const row = Object.fromEntries(
    LICHESS_PUZZLE_COLUMNS.map((column, index) => [column, values[index]])
  ) as LichessPuzzleCsvRow

  const quality = {
    rating: Number(row.Rating),
    ratingDeviation: Number(row.RatingDeviation),
    popularity: Number(row.Popularity),
    nbPlays: Number(row.NbPlays),
  }

  if (
    !Object.values(quality).every(Number.isFinite) ||
    quality.ratingDeviation > QUALITY_FILTERS.maxRatingDeviation ||
    quality.popularity < QUALITY_FILTERS.minPopularity ||
    quality.nbPlays < QUALITY_FILTERS.minPlays
  ) {
    return { rejected: "quality" }
  }

  const band = RATING_BANDS.find(
    (candidate) =>
      quality.rating >= candidate.min && quality.rating <= candidate.max
  )

  if (!band) {
    return { rejected: "quality" }
  }

  const themes = splitTags(row.Themes)

  return themes.includes("mateIn1")
    ? { rejected: "mateIn1" }
    : { row, quality, band, themes }
}

/** Null when the trigger move or any solution move is illegal. */
export function buildPuzzleItem({
  row,
  quality,
  band,
  themes,
}: ParsedPuzzleRow): LichessPuzzleBenchmarkItem | null {
  const moves = splitTags(row.Moves)

  if (moves.length < 2) {
    return null
  }

  const chess = new Chess(row.FEN)
  const triggerMove = moves[0]

  if (!applyUciMove(chess, triggerMove)) {
    return null
  }

  const fen = chess.fen()
  const sideToMove = chess.turn()
  const solutionMoves = moves.slice(1).map((move) => move.toLowerCase())
  const playerUciMoves = solutionMoves.filter((_, index) => index % 2 === 0)
  const primaryTheme = findPrimaryTheme(themes)

  for (const move of solutionMoves) {
    if (!applyUciMove(chess, move)) {
      return null
    }
  }

  return {
    id: `lichess:${row.PuzzleId}`,
    benchmark: "lichess-puzzles-v1",
    position: {
      triggerFen: row.FEN,
      triggerMove,
      fen,
      sideToMove,
    },
    expected: {
      uciLine: solutionMoves,
      playerUciMoves,
      finalFen: chess.fen(),
    },
    metadata: {
      lichessPuzzleId: row.PuzzleId,
      lichessGameUrl: row.GameUrl,
      rating: quality.rating,
      ratingDeviation: quality.ratingDeviation,
      popularity: quality.popularity,
      nbPlays: quality.nbPlays,
      ratingBand: band.id,
      ratingBucket: findRatingBucket(quality.rating),
      length: findPuzzleLength(themes),
      moveCounts: {
        solutionPlies: solutionMoves.length,
        playerMoves: playerUciMoves.length,
        opponentReplies: solutionMoves.length - playerUciMoves.length,
      },
      primaryTheme,
      themeGroups: findThemeGroups(themes, primaryTheme),
      themes,
      openingTags: splitTags(row.OpeningTags),
    },
  }
}

/**
 * Reservoir of the `capacity` smallest hash keys. Returns the index the key
 * should be written to, or -1 when it would not improve the retained set.
 */
export function reservoirSlot(
  retained: { hashKey: string }[],
  hashKey: string,
  capacity: number
): number {
  if (retained.length < capacity) {
    return retained.length
  }

  let worst = 0

  for (let index = 1; index < retained.length; index += 1) {
    if (retained[index].hashKey > retained[worst].hashKey) {
      worst = index
    }
  }

  return hashKey < retained[worst].hashKey ? worst : -1
}

function splitTags(value: string): string[] {
  return value.trim() === "" ? [] : value.trim().split(/\s+/)
}

function findPuzzleLength(themes: string[]): PuzzleLength {
  if (themes.includes("veryLong")) {
    return "veryLong"
  }

  if (themes.includes("long")) {
    return "long"
  }

  if (themes.includes("short")) {
    return "short"
  }

  return "unknown"
}

function findRatingBucket(rating: number): string {
  const start = Math.floor(rating / 100) * 100

  return `${formatRating(start)}-${formatRating(start + 99)}`
}

function formatRating(rating: number): string {
  return String(rating).padStart(4, "0")
}

function findPrimaryTheme(themes: string[]): string {
  return (
    themes.find(
      (theme) =>
        themePriority.has(theme) &&
        !structuralThemes.has(theme) &&
        !outcomeThemes.has(theme)
    ) ??
    themes.find(
      (theme) => !structuralThemes.has(theme) && !outcomeThemes.has(theme)
    ) ??
    themes.find((theme) => outcomeThemes.has(theme)) ??
    themes.find((theme) => !structuralThemes.has(theme)) ??
    themes[0] ??
    "unknown"
  )
}

function findThemeGroups(
  themes: string[],
  primaryTheme: string
): ThemeGroupId[] {
  const groups = new Set<ThemeGroupId>()

  for (const theme of [primaryTheme, ...themes]) {
    groups.add(themeGroupsByTheme.get(theme) ?? "other")
  }

  groups.delete("other")

  return groups.size > 0 ? [...groups].sort() : ["other"]
}
