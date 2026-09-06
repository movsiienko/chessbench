import { spawn, spawnSync } from "node:child_process"
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
import { parseCsvRecords } from "@/lib/benchmarks/csv"
import {
  buildPuzzleItem,
  LICHESS_PUZZLE_COLUMNS as columns,
  parsePuzzleRow,
  QUALITY_FILTERS,
  RATING_BANDS as ratingBands,
  reservoirSlot,
} from "@/lib/benchmarks/lichess-puzzle-builder"
import type {
  LichessPuzzleBenchmarkItem,
  PuzzleLength,
  RatingBandId,
  ThemeGroupId,
} from "@/lib/benchmarks/lichess-puzzles"

type Candidate = {
  hashKey: string
  item: LichessPuzzleBenchmarkItem
}

const sourcePath =
  readOption("--source") ?? "data/raw/lichess/lichess_db_puzzle.csv.zst"
const outDir = readOption("--out") ?? "data/benchmarks/lichess-puzzles-v1"
const perBand = Number(readOption("--per-band") ?? 100)
const seed = readOption("--seed") ?? "lichess-puzzles-v1"
const { minPopularity, minPlays, maxRatingDeviation } = QUALITY_FILTERS
const benchmarkId = "lichess-puzzles-v1"
const sourceUrl = "https://database.lichess.org/lichess_db_puzzle.csv.zst"
const sourcePageUrl = "https://database.lichess.org/#puzzles"
const sourcePageLastUpdated = "2026-05-02"
const sourceDownloadLastModified = "2026-05-01T09:33:23Z"
const sourceDownloadContentLength = 296291296

if (!existsSync(sourcePath)) {
  throw new Error(
    `Missing ${sourcePath}. Run "bun run datasets:lichess:download" first.`
  )
}

if (sourcePath.endsWith(".zst") && spawnSync("zstdcat", ["--version"]).error) {
  throw new Error(
    "zstdcat not found on PATH. Install zstd (brew install zstd)."
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
  rowsWithInvalidColumns: 0,
  rowsRejectedByQuality: 0,
  rowsRejectedAsMateInOne: 0,
  rowsRejectedAsIllegal: 0,
}
const rejectionStat = {
  invalidColumns: "rowsWithInvalidColumns",
  quality: "rowsRejectedByQuality",
  mateIn1: "rowsRejectedAsMateInOne",
} as const
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
    if (parseCsvRecords(line)[0]?.join(",") !== columns.join(",")) {
      throw new Error(`Unexpected CSV header: ${line}`)
    }
    headerVerified = true
    continue
  }

  sourceStats.rowsSeen += 1

  const parsed = parsePuzzleRow(line)

  if ("rejected" in parsed) {
    if (parsed.rejected !== "invalidColumns") {
      sourceStats.rowsParsed += 1
    }
    sourceStats[rejectionStat[parsed.rejected]] += 1
    continue
  }

  sourceStats.rowsParsed += 1

  const bandId = parsed.band.id
  sourceStats.rowsPassingFilters += 1
  passingFiltersByBand.set(bandId, (passingFiltersByBand.get(bandId) ?? 0) + 1)

  const candidates = selectedByBand.get(bandId) ?? []
  const hashKey = stableHash(`${seed}:${parsed.row.PuzzleId}`)
  const slot = reservoirSlot(candidates, hashKey, perBand)

  if (slot < 0) {
    continue
  }

  const item = buildPuzzleItem(parsed)

  if (item === null) {
    sourceStats.rowsRejectedAsIllegal += 1
    continue
  }

  sourceStats.rowsBuilt += 1
  candidates[slot] = { hashKey, item }
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

async function writeJson<T>(path: string, value: T): Promise<void> {
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
