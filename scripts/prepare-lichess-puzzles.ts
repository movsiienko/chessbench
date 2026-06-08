import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  statSync,
} from "node:fs"
import { writeFile } from "node:fs/promises"
import { basename, join } from "node:path"
import { createInterface } from "node:readline"
import { Chess } from "chess.js"
import type {
  LichessPuzzleBenchmarkItem,
  PuzzleMoveCounts,
  PuzzleLength,
  RatingBandId,
  ThemeGroupId,
} from "@/lib/benchmarks/lichess-puzzles"

type LichessPuzzleCsvRow = {
  PuzzleId: string
  FEN: string
  Moves: string
  Rating: string
  RatingDeviation: string
  Popularity: string
  NbPlays: string
  Themes: string
  GameUrl: string
  OpeningTags: string
}

type RatingBand = {
  id: RatingBandId
  label: string
  min: number
  max: number
}

type Candidate = {
  hashKey: string
  item: LichessPuzzleBenchmarkItem
}

const sourcePath =
  readOption("--source") ?? "data/raw/lichess/lichess_db_puzzle.csv.zst"
const outDir = readOption("--out") ?? "data/benchmarks/lichess-puzzles-v1"
const perBand = Number(readOption("--per-band") ?? 100)
const seed = readOption("--seed") ?? "lichess-puzzles-v1"
const columns = [
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
const minPopularity = 80
const minPlays = 300
const maxRatingDeviation = 110
const benchmarkId = "lichess-puzzles-v1"
const sourceUrl = "https://database.lichess.org/lichess_db_puzzle.csv.zst"
const sourcePageUrl = "https://database.lichess.org/#puzzles"
const sourcePageLastUpdated = "2026-05-02"
const sourceDownloadLastModified = "2026-05-01T09:33:23Z"
const sourceDownloadContentLength = 296291296

const ratingBands: RatingBand[] = [
  { id: "under-1200", label: "<1200", min: 0, max: 1199 },
  { id: "1200-1599", label: "1200-1599", min: 1200, max: 1599 },
  { id: "1600-1999", label: "1600-1999", min: 1600, max: 1999 },
  { id: "2000-2399", label: "2000-2399", min: 2000, max: 2399 },
  { id: "2400-plus", label: "2400+", min: 2400, max: Number.POSITIVE_INFINITY },
]

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

const themeGroupsByTheme: Record<string, ThemeGroupId> = {
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
}

if (!existsSync(sourcePath)) {
  throw new Error(
    `Missing ${sourcePath}. Run "bun run datasets:lichess:download" first.`
  )
}

const selectedByBand = new Map<RatingBandId, Candidate[]>(
  ratingBands.map((band) => [band.id, []])
)
const sourceStats = {
  rowsSeen: 0,
  rowsParsed: 0,
  rowsPassingFilters: 0,
  rowsBuilt: 0,
  rowsWithInvalidShape: 0,
  rowsRejectedByQuality: 0,
  rowsRejectedAsMateInOne: 0,
  rowsRejectedAsIllegal: 0,
}
const passingFiltersByBand = new Map<RatingBandId, number>(
  ratingBands.map((band) => [band.id, 0])
)
const selectedThemeCounts = new Map<string, number>()
const selectedPrimaryThemeCounts = new Map<string, number>()
const selectedThemeGroupCounts = new Map<ThemeGroupId, number>()
const selectedLengthCounts = new Map<PuzzleLength, number>()
const selectedRatingBucketCounts = new Map<string, number>()
const selectedSolutionPlyCounts = new Map<string, number>()
const selectedPlayerMoveCounts = new Map<string, number>()
const selectedOpponentReplyCounts = new Map<string, number>()

let headerVerified = false

for await (const line of readLines(sourcePath)) {
  if (!headerVerified) {
    verifyHeader(line)
    headerVerified = true
    continue
  }

  sourceStats.rowsSeen += 1

  const row = parseRow(line)

  if (row === null) {
    sourceStats.rowsWithInvalidShape += 1
    continue
  }

  sourceStats.rowsParsed += 1

  const quality = parseQuality(row)

  if (!quality) {
    sourceStats.rowsRejectedByQuality += 1
    continue
  }

  const band = findRatingBand(quality.rating)

  if (!band) {
    sourceStats.rowsRejectedByQuality += 1
    continue
  }

  const themes = splitTags(row.Themes)

  if (themes.includes("mateIn1")) {
    sourceStats.rowsRejectedAsMateInOne += 1
    continue
  }

  sourceStats.rowsPassingFilters += 1
  passingFiltersByBand.set(
    band.id,
    (passingFiltersByBand.get(band.id) ?? 0) + 1
  )

  const hashKey = stableHash(`${seed}:${row.PuzzleId}`)

  if (!couldImproveSelection(band.id, hashKey)) {
    continue
  }

  const item = buildItem(row, quality, band, themes)

  if (item === null) {
    sourceStats.rowsRejectedAsIllegal += 1
    continue
  }

  sourceStats.rowsBuilt += 1
  maybeKeepCandidate(band.id, { hashKey, item })
}

const items = ratingBands.flatMap((band) =>
  [...(selectedByBand.get(band.id) ?? [])]
    .sort((left, right) => left.hashKey.localeCompare(right.hashKey))
    .map((candidate) => candidate.item)
)

for (const item of items) {
  selectedRatingBucketCounts.set(
    item.metadata.ratingBucket,
    (selectedRatingBucketCounts.get(item.metadata.ratingBucket) ?? 0) + 1
  )

  for (const theme of item.metadata.themes) {
    selectedThemeCounts.set(theme, (selectedThemeCounts.get(theme) ?? 0) + 1)
  }

  selectedPrimaryThemeCounts.set(
    item.metadata.primaryTheme,
    (selectedPrimaryThemeCounts.get(item.metadata.primaryTheme) ?? 0) + 1
  )

  for (const group of item.metadata.themeGroups) {
    selectedThemeGroupCounts.set(
      group,
      (selectedThemeGroupCounts.get(group) ?? 0) + 1
    )
  }

  selectedLengthCounts.set(
    item.metadata.length,
    (selectedLengthCounts.get(item.metadata.length) ?? 0) + 1
  )

  selectedSolutionPlyCounts.set(
    String(item.metadata.moveCounts.solutionPlies),
    (selectedSolutionPlyCounts.get(
      String(item.metadata.moveCounts.solutionPlies)
    ) ?? 0) + 1
  )
  selectedPlayerMoveCounts.set(
    String(item.metadata.moveCounts.playerMoves),
    (selectedPlayerMoveCounts.get(
      String(item.metadata.moveCounts.playerMoves)
    ) ?? 0) + 1
  )
  selectedOpponentReplyCounts.set(
    String(item.metadata.moveCounts.opponentReplies),
    (selectedOpponentReplyCounts.get(
      String(item.metadata.moveCounts.opponentReplies)
    ) ?? 0) + 1
  )
}

mkdirSync(outDir, { recursive: true })
mkdirSync(join(outDir, "indexes"), { recursive: true })

const itemsPath = join(outDir, "items.jsonl")
const manifestPath = join(outDir, "manifest.json")
const itemsWriter = createWriteStream(itemsPath)

for (const item of items) {
  itemsWriter.write(`${JSON.stringify(item)}\n`)
}

await new Promise<void>((resolve, reject) => {
  itemsWriter.once("error", reject)
  itemsWriter.end(() => resolve())
})

await writeIndexes(outDir, items)

const manifest = {
  id: benchmarkId,
  title: "Lichess Puzzles v1",
  description:
    "A deterministic, quality-filtered chess puzzle benchmark sampled from the Lichess puzzle database.",
  createdAt: `${sourcePageLastUpdated}T00:00:00.000Z`,
  source: {
    name: "Lichess puzzle database",
    pageUrl: sourcePageUrl,
    downloadUrl: sourceUrl,
    localRawPath: sourcePath,
    localRawFileName: basename(sourcePath),
    localRawBytes: statSync(sourcePath).size,
    localRawSha256: await hashFile(sourcePath),
    license: "Creative Commons CC0",
    pageLastUpdated: sourcePageLastUpdated,
    downloadLastModified: sourceDownloadLastModified,
    downloadContentLength: sourceDownloadContentLength,
    downloadEtag: '"69f47363-11a90be0"',
  },
  format: {
    sourceColumns: columns,
    itemFile: "items.jsonl",
    indexFiles: {
      byRatingBucket: "indexes/by-rating-bucket.json",
      byPlayerMoveCount: "indexes/by-player-move-count.json",
      bySolutionPlyCount: "indexes/by-solution-ply-count.json",
      byPrimaryTheme: "indexes/by-primary-theme.json",
      byTheme: "indexes/by-theme.json",
    },
    promptContract:
      "Runners build prompts at execution time from position.fen. The local runner asks for exactly one legal move token in UCI or standard algebraic (SAN) notation with no explanation or extra text, normalizes accepted answers to UCI, reveals expected opponent replies after correct moves, and stops on the first wrong or invalid move.",
    expectedAnswer:
      "expected.uciLine contains the full forcing line after the Lichess setup move; expected.playerUciMoves contains only the side-to-move moves.",
  },
  selection: {
    seed,
    targetPerRatingBand: perBand,
    totalItems: items.length,
    filters: {
      minPopularity,
      minPlays,
      maxRatingDeviation,
      excludedThemes: ["mateIn1"],
      legalLineValidation:
        "Every trigger and solution move is applied with chess.js.",
    },
    ratingBands: ratingBands.map((band) => ({
      id: band.id,
      label: band.label,
      min: band.min,
      max: Number.isFinite(band.max) ? band.max : null,
      eligible: passingFiltersByBand.get(band.id) ?? 0,
      selected: selectedByBand.get(band.id)?.length ?? 0,
    })),
  },
  scoring: {
    primaryMetric: "solved_rate",
    solvedDefinition:
      "An answer is solved when its extracted UCI move sequence exactly matches either the full expected line or the player-only expected line.",
    metrics: [
      {
        id: "solved",
        range: [0, 1],
        description:
          "1 when the submitted line exactly matches expected.uciLine or expected.playerUciMoves.",
      },
      {
        id: "firstMoveCorrect",
        range: [0, 1],
        description:
          "1 when the first submitted UCI move matches the first player move.",
      },
      {
        id: "fullLinePrefixScore",
        range: [0, 1],
        description:
          "Correct leading plies divided by expected.uciLine length.",
      },
      {
        id: "playerMovePrefixScore",
        range: [0, 1],
        description:
          "Correct leading player moves divided by expected.playerUciMoves length.",
      },
    ],
    parser:
      "Answers are parsed by extracting UCI tokens matching /[a-h][1-8][a-h][1-8][qrbn]?/i.",
  },
  sourceStats,
  selectedStats: {
    ratings: {
      min: Math.min(...items.map((item) => item.metadata.rating)),
      max: Math.max(...items.map((item) => item.metadata.rating)),
      average: round(
        items.reduce((sum, item) => sum + item.metadata.rating, 0) /
          items.length
      ),
      buckets: sortedCountObject(selectedRatingBucketCounts),
    },
    moveCounts: {
      solutionPlies: sortedNumericCountObject(selectedSolutionPlyCounts),
      playerMoves: sortedNumericCountObject(selectedPlayerMoveCounts),
      opponentReplies: sortedNumericCountObject(selectedOpponentReplyCounts),
    },
    themes: Object.fromEntries(
      [...selectedThemeCounts.entries()].sort(
        (left, right) => right[1] - left[1]
      )
    ),
    primaryThemes: Object.fromEntries(
      [...selectedPrimaryThemeCounts.entries()].sort(
        (left, right) => right[1] - left[1]
      )
    ),
    themeGroups: Object.fromEntries(
      [...selectedThemeGroupCounts.entries()].sort(
        (left, right) => right[1] - left[1]
      )
    ),
    lengths: Object.fromEntries(
      [...selectedLengthCounts.entries()].sort((left, right) =>
        left[0].localeCompare(right[0])
      )
    ),
  },
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

console.log(`Wrote ${items.length} benchmark items to ${itemsPath}`)
console.log(`Wrote manifest to ${manifestPath}`)

function readOption(name: string): string | undefined {
  return process.argv
    .find((argument) => argument.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

async function* readLines(path: string): AsyncGenerator<string> {
  if (path.endsWith(".zst")) {
    const child = spawn("zstdcat", [path], {
      stdio: ["ignore", "pipe", "inherit"],
    })

    if (!child.stdout) {
      throw new Error("Failed to read zstdcat stdout.")
    }

    const lines = createInterface({
      input: child.stdout,
      crlfDelay: Infinity,
    })

    for await (const line of lines) {
      yield line
    }

    const exitCode = await new Promise<number | null>((resolve) => {
      child.once("close", resolve)
    })

    if (exitCode !== 0) {
      throw new Error(`zstdcat exited with code ${exitCode}`)
    }

    return
  }

  const lines = createInterface({
    input: createReadStream(path),
    crlfDelay: Infinity,
  })

  for await (const line of lines) {
    yield line
  }
}

function verifyHeader(line: string): void {
  const actual = parseCsvLine(line)

  if (actual.join(",") !== columns.join(",")) {
    throw new Error(`Unexpected CSV header: ${line}`)
  }
}

function parseRow(line: string): LichessPuzzleCsvRow | null {
  const values = parseCsvLine(line)

  if (values.length !== columns.length) {
    return null
  }

  return Object.fromEntries(
    columns.map((column, index) => [column, values[index]])
  ) as LichessPuzzleCsvRow
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ""
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (quoted && char === '"' && next === '"') {
      current += '"'
      index += 1
      continue
    }

    if (char === '"') {
      quoted = !quoted
      continue
    }

    if (!quoted && char === ",") {
      fields.push(current)
      current = ""
      continue
    }

    current += char
  }

  fields.push(current)
  return fields
}

function parseQuality(row: LichessPuzzleCsvRow):
  | {
      rating: number
      ratingDeviation: number
      popularity: number
      nbPlays: number
    }
  | false {
  const rating = Number(row.Rating)
  const ratingDeviation = Number(row.RatingDeviation)
  const popularity = Number(row.Popularity)
  const nbPlays = Number(row.NbPlays)

  if (
    !Number.isFinite(rating) ||
    !Number.isFinite(ratingDeviation) ||
    !Number.isFinite(popularity) ||
    !Number.isFinite(nbPlays) ||
    ratingDeviation > maxRatingDeviation ||
    popularity < minPopularity ||
    nbPlays < minPlays
  ) {
    return false
  }

  return { rating, ratingDeviation, popularity, nbPlays }
}

function findRatingBand(rating: number): RatingBand | undefined {
  return ratingBands.find((band) => rating >= band.min && rating <= band.max)
}

function splitTags(value: string): string[] {
  return value.trim() === "" ? [] : value.trim().split(/\s+/)
}

function buildItem(
  row: LichessPuzzleCsvRow,
  quality: {
    rating: number
    ratingDeviation: number
    popularity: number
    nbPlays: number
  },
  band: RatingBand,
  themes: string[]
): LichessPuzzleBenchmarkItem | null {
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
  const moveCounts = getMoveCounts(solutionMoves, playerUciMoves)
  const primaryTheme = findPrimaryTheme(themes)

  for (const move of solutionMoves) {
    if (!applyUciMove(chess, move)) {
      return null
    }
  }

  return {
    id: `lichess:${row.PuzzleId}`,
    benchmark: benchmarkId,
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
      moveCounts,
      primaryTheme,
      themeGroups: findThemeGroups(themes, primaryTheme),
      themes,
      openingTags: splitTags(row.OpeningTags),
    },
  }
}

function applyUciMove(chess: Chess, move: string): boolean {
  const normalized = move.toLowerCase()
  const result = chess.move({
    from: normalized.slice(0, 2),
    to: normalized.slice(2, 4),
    promotion: normalized[4],
  })

  return result !== null
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

function getMoveCounts(
  solutionMoves: string[],
  playerUciMoves: string[]
): PuzzleMoveCounts {
  return {
    solutionPlies: solutionMoves.length,
    playerMoves: playerUciMoves.length,
    opponentReplies: solutionMoves.length - playerUciMoves.length,
  }
}

function findRatingBucket(rating: number): string {
  const start = Math.floor(rating / 100) * 100
  const end = start + 99

  return `${formatRating(start)}-${formatRating(end)}`
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
    groups.add(themeGroupsByTheme[theme] ?? "other")
  }

  groups.delete("other")

  return groups.size > 0 ? [...groups].sort() : ["other"]
}

function maybeKeepCandidate(bandId: RatingBandId, candidate: Candidate): void {
  const candidates = selectedByBand.get(bandId)

  if (!candidates) {
    throw new Error(`Unknown rating band: ${bandId}`)
  }

  if (candidates.length < perBand) {
    candidates.push(candidate)
    return
  }

  let worstIndex = 0

  for (let index = 1; index < candidates.length; index += 1) {
    if (candidates[index].hashKey > candidates[worstIndex].hashKey) {
      worstIndex = index
    }
  }

  if (candidate.hashKey < candidates[worstIndex].hashKey) {
    candidates[worstIndex] = candidate
  }
}

function couldImproveSelection(bandId: RatingBandId, hashKey: string): boolean {
  const candidates = selectedByBand.get(bandId)

  if (!candidates) {
    throw new Error(`Unknown rating band: ${bandId}`)
  }

  if (candidates.length < perBand) {
    return true
  }

  return (
    hashKey <
    candidates.reduce(
      (worst, candidate) =>
        candidate.hashKey > worst ? candidate.hashKey : worst,
      candidates[0].hashKey
    )
  )
}

function stableHash(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256")
  const stream = createReadStream(path)

  for await (const chunk of stream) {
    hash.update(chunk)
  }

  return hash.digest("hex")
}

async function writeIndexes(
  outDirPath: string,
  benchmarkItems: LichessPuzzleBenchmarkItem[]
): Promise<void> {
  await Promise.all([
    writeJson(
      join(outDirPath, "indexes/by-rating-bucket.json"),
      indexBy(benchmarkItems, (item) => [item.metadata.ratingBucket])
    ),
    writeJson(
      join(outDirPath, "indexes/by-player-move-count.json"),
      indexBy(benchmarkItems, (item) => [
        String(item.metadata.moveCounts.playerMoves),
      ])
    ),
    writeJson(
      join(outDirPath, "indexes/by-solution-ply-count.json"),
      indexBy(benchmarkItems, (item) => [
        String(item.metadata.moveCounts.solutionPlies),
      ])
    ),
    writeJson(
      join(outDirPath, "indexes/by-primary-theme.json"),
      indexBy(benchmarkItems, (item) => [item.metadata.primaryTheme])
    ),
    writeJson(
      join(outDirPath, "indexes/by-theme.json"),
      indexBy(benchmarkItems, (item) => item.metadata.themes)
    ),
  ])
}

function indexBy(
  benchmarkItems: LichessPuzzleBenchmarkItem[],
  getKeys: (item: LichessPuzzleBenchmarkItem) => string[]
): Record<string, string[]> {
  const index = new Map<string, string[]>()

  for (const item of benchmarkItems) {
    for (const key of getKeys(item)) {
      const ids = index.get(key) ?? []
      ids.push(item.id)
      index.set(key, ids)
    }
  }

  return Object.fromEntries(
    [...index.entries()].sort((left, right) => left[0].localeCompare(right[0]))
  )
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

function sortedCountObject(
  counts: Map<string, number>
): Record<string, number> {
  return Object.fromEntries(
    [...counts.entries()].sort((left, right) => left[0].localeCompare(right[0]))
  )
}

function sortedNumericCountObject(
  counts: Map<string, number>
): Record<string, number> {
  return Object.fromEntries(
    [...counts.entries()].sort(
      (left, right) => Number(left[0]) - Number(right[0])
    )
  )
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
