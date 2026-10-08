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
import {
  LICHESS_PUZZLE_COLUMNS as columns,
  QUALITY_FILTERS,
} from "@/lib/benchmarks/lichess-puzzle-builder"
import { sampleLichessPuzzles } from "@/lib/benchmarks/lichess-puzzle-sampler"
import type { LichessPuzzleBenchmarkItem } from "@/lib/benchmarks/lichess-puzzles"

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

const { items, sourceStats, ratingBands } = await sampleLichessPuzzles(
  readLines(sourcePath),
  { seed, perBand }
)

mkdirSync(outDir, { recursive: true })

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
    ratingBands,
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
      buckets: countBy(items, (item) => [item.metadata.ratingBucket]),
    },
    moveCounts: {
      solutionPlies: countBy(
        items,
        (item) => [item.metadata.moveCounts.solutionPlies],
        numeric
      ),
      playerMoves: countBy(
        items,
        (item) => [item.metadata.moveCounts.playerMoves],
        numeric
      ),
      opponentReplies: countBy(
        items,
        (item) => [item.metadata.moveCounts.opponentReplies],
        numeric
      ),
    },
    themes: countBy(items, (item) => item.metadata.themes, byCountDesc),
    primaryThemes: countBy(
      items,
      (item) => [item.metadata.primaryTheme],
      byCountDesc
    ),
    themeGroups: countBy(
      items,
      (item) => item.metadata.themeGroups,
      byCountDesc
    ),
    lengths: countBy(items, (item) => [item.metadata.length]),
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

async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256")
  const stream = createReadStream(path)

  for await (const chunk of stream) {
    hash.update(chunk)
  }

  return hash.digest("hex")
}

type Entry = [string, number]

/** Key -> count over the items; each item may contribute several keys. */
function countBy(
  benchmarkItems: LichessPuzzleBenchmarkItem[],
  getKeys: (item: LichessPuzzleBenchmarkItem) => Array<string | number>,
  order: (left: Entry, right: Entry) => number = (left, right) =>
    left[0].localeCompare(right[0])
): Record<string, number> {
  const counts = new Map<string, number>()

  for (const item of benchmarkItems) {
    for (const key of getKeys(item)) {
      counts.set(String(key), (counts.get(String(key)) ?? 0) + 1)
    }
  }

  return Object.fromEntries([...counts.entries()].sort(order))
}

function numeric([left]: Entry, [right]: Entry) {
  return Number(left) - Number(right)
}

function byCountDesc([, left]: Entry, [, right]: Entry) {
  return right - left
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
