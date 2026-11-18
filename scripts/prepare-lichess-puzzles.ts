import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, renameSync } from "node:fs"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  LICHESS_PUZZLE_COLUMNS as columns,
  QUALITY_FILTERS,
  V2_QUALITY_FILTERS,
} from "@/lib/benchmarks/lichess-puzzle-builder"
import { parseCsvRecords } from "@/lib/benchmarks/csv"
import { sampleLichessPuzzles } from "@/lib/benchmarks/lichess-puzzle-sampler"
import type { LichessPuzzleBenchmarkItem } from "@/lib/benchmarks/lichess-puzzles"
import {
  gameIdOf,
  readGameDates,
  readLines,
  verifiedProvenance,
} from "./lichess-files"

const benchmarkId = readOption("--benchmark")

if (
  benchmarkId !== "lichess-puzzles-v1" &&
  benchmarkId !== "lichess-puzzles-v2"
) {
  throw new Error(
    "Pass --benchmark=lichess-puzzles-v1 or --benchmark=lichess-puzzles-v2."
  )
}

const v2 = benchmarkId === "lichess-puzzles-v2"
// v2 builds from the output of filter-lichess-puzzles-by-game-date.ts and
// cook-lichess-puzzles.py in this directory; see the v2 README.
const gateDir = readOption("--gate")

if (v2 !== Boolean(gateDir)) {
  throw new Error("Pass --gate=<date gate cache dir> for v2, and only for v2.")
}

if (gateDir && readOption("--source")) {
  throw new Error("v2 reads its source from --gate; drop --source.")
}

const sourcePath = gateDir
  ? join(gateDir, "qualifying-cooked.csv")
  : (readOption("--source") ?? "data/raw/lichess/lichess_db_puzzle.csv.zst")
const outDir = readOption("--out") ?? join("data/benchmarks", benchmarkId)
const perBand = Number(readOption("--per-band") ?? 100)
const seed = readOption("--seed") ?? benchmarkId
const filters = v2 ? V2_QUALITY_FILTERS : QUALITY_FILTERS
const gate = gateDir
  ? JSON.parse(readFileSync(join(gateDir, "gate.json"), "utf8"))
  : undefined
// v2 is defined by this cutoff; a gate run with another one is not v2.
const v2Threshold = "2026-06-01T00:00:00.000Z"

if (gate && gate.thresholdUtc !== v2Threshold) {
  throw new Error(
    `The gate used ${gate.thresholdUtc}; v2 needs ${v2Threshold}.`
  )
}

if (!existsSync(sourcePath)) {
  throw new Error(
    gateDir
      ? `Missing ${sourcePath}. Tag qualifying.csv with scripts/cook-lichess-puzzles.py first.`
      : `Missing ${sourcePath}. Run "bun run datasets:lichess:download" first.`
  )
}

// v2 samples exactly this text, after checking it against the gate's output.
let cooked: string | undefined

if (gateDir) {
  const qualifying = readFileSync(join(gateDir, "qualifying.csv"), "utf8")
  if (
    createHash("sha256").update(qualifying).digest("hex") !==
    gate.qualifyingSha256
  ) {
    throw new Error("qualifying.csv is not the one gate.json describes.")
  }
  cooked = readFileSync(sourcePath, "utf8")
  // Tagging may rewrite Themes and nothing else in the gate's qualifying rows.
  const themes = columns.indexOf("Themes")
  const withoutThemes = (csv: string) =>
    csv
      .trimEnd()
      .split("\n")
      .map((line) =>
        JSON.stringify(
          (parseCsvRecords(line)[0] ?? []).filter(
            (_, index) => index !== themes
          )
        )
      )
      .join("\n")
  if (withoutThemes(qualifying) !== withoutThemes(cooked)) {
    throw new Error("qualifying-cooked.csv is not a tagging of qualifying.csv.")
  }
}

// The dump's download record; v2's gate checked it against the dump it read.
const provenance = gate?.source ?? (await verifiedProvenance(sourcePath))
const committedManifest = join(outDir, "manifest.json")

// Committed sets are immutable: a newer dump goes to another --out.
if (
  existsSync(committedManifest) &&
  JSON.parse(readFileSync(committedManifest, "utf8")).source?.sha256 !==
    provenance.sha256
) {
  throw new Error(
    `${outDir} was built from a different dump. Pass --out=<new dir> to build from this one.`
  )
}

if (sourcePath.endsWith(".zst") && spawnSync("zstdcat", ["--version"]).error) {
  throw new Error(
    "zstdcat not found on PATH. Install zstd (brew install zstd)."
  )
}

const { items, sourceStats, ratingBands } = await sampleLichessPuzzles(
  cooked?.trimEnd().split("\n") ?? readLines(sourcePath, provenance.sha256),
  { seed, perBand, filters, benchmark: benchmarkId }
)

if (gateDir) {
  const createdAt = readGameDates(join(gateDir, "game-dates.ndjson"))
  for (const item of items) {
    const ms = createdAt.get(gameIdOf(item.metadata.lichessGameUrl))
    if (ms === undefined || ms === null || ms < Date.parse(v2Threshold)) {
      throw new Error(`${item.id} has no game date on or after the threshold.`)
    }
    item.metadata.gameCreatedAt = new Date(ms).toISOString()
  }
}

const itemsPath = join(outDir, "items.jsonl")
const manifestPath = join(outDir, "manifest.json")
const itemsJsonl = items.map((item) => `${JSON.stringify(item)}\n`).join("")

// A committed set is never rewritten: identical items are left untouched, and
// different ones are refused.
if (existsSync(itemsPath)) {
  if (readFileSync(itemsPath, "utf8") !== itemsJsonl) {
    throw new Error(
      `${outDir} holds a different puzzle set. Pass --out=<new dir> to write this one.`
    )
  }
} else {
  // Staged, so an interrupted write never leaves a partial items.jsonl.
  mkdirSync(outDir, { recursive: true })
  await writeFile(`${itemsPath}.part`, itemsJsonl)
  renameSync(`${itemsPath}.part`, itemsPath)
}

const v2Methodology = gate && {
  baseline: {
    ...gate.baseline,
    role: "Puzzle ids already in this April 2026 dump are excluded, since their games predate the date threshold. It is not the dump v1 was built from.",
  },
  gameDateGate: {
    thresholdUtc: gate.thresholdUtc,
    ...gate.dateSource,
    missingDates: "excluded",
    completedAt: gate.completedAt,
    funnel: gate.funnel,
  },
  tagging: {
    tool: "cook.py from Lichess's puzzle tagger",
    repository: "https://github.com/ornicar/lichess-puzzler",
    commit: "8e24b6d5e2b9618e41581a327926e4ac67c610a2",
    pythonChess: "1.3.0",
    script: "scripts/cook-lichess-puzzles.py",
    why: "Lichess adds puzzles with empty themes and tags them later, so most recent puzzles in the dump carry only phase/source tags. Every v2 puzzle is re-tagged with the same tagger.",
    keptFromDump: [
      "opening",
      "middlegame",
      "endgame",
      "master",
      "masterVsMaster",
      "superGM",
    ],
    omitted: {
      "crushing, advantage, equality":
        "cook derives them from the puzzle generator's engine eval, which the dump does not publish",
      zugzwang: "needs a separate Stockfish pass",
    },
    neverProducedByCook: [
      "discoveredCheck",
      "named mates such as operaMate, pillsburysMate, killBoxMate, morphysMate, epauletteMate, swallowstailMate, triangleMate",
    ],
    validation:
      '500 April 2026 puzzles Lichess had tagged (popularity >= 80, plays >= 300, RD <= 110; lowest sha256("cook-validation-v1:" + PuzzleId)): every tag cook produces matched with 100% precision and recall; 467/500 tag sets match exactly, and every mismatch is a tag cook never produces. Reproduce with `python3 -I scripts/cook-lichess-puzzles.py --tagger=<lichess-puzzler checkout> validate <April 2026 dump .csv.zst>`.',
  },
  mateInOne:
    "Kept, unlike v1. The scorer accepts only the Lichess solution, so a different mating move scores as a miss.",
  contamination: {
    note: "Temporally held out by underlying game date: every puzzle comes from a game created on or after the threshold. That is not proof the puzzles are absent from any model's training data. June 1, 2026 precedes Mistral Large 4's latest training-data collection (September 2026), most providers publish no exact cutoff, models may receive later post-training, and the same positions can occur in earlier games.",
    sources: [
      "https://legal.mistral.ai/documents/Mistral%20Large%204%20-%20Public%20Summary%20of%20Training%20Content.pdf",
      "https://platform.claude.com/docs/en/about-claude/models/overview",
    ],
  },
}

const manifest = {
  id: benchmarkId,
  title: v2 ? "Lichess Puzzles v2" : "Lichess Puzzles v1",
  description: v2
    ? "A deterministic, quality-filtered chess puzzle benchmark of Lichess puzzles from games played on or after June 1, 2026 (UTC)."
    : "A deterministic, quality-filtered chess puzzle benchmark sampled from the Lichess puzzle database.",
  createdAt: gate?.completedAt ?? provenance.retrievalFinishedAt,
  source: {
    name: "Lichess puzzle database",
    pageUrl: "https://database.lichess.org/#puzzles",
    downloadUrl: provenance.sourceUrl,
    finalUrl: provenance.finalUrl,
    license: "Creative Commons CC0",
    retrievalStartedAt: provenance.retrievalStartedAt,
    retrievalFinishedAt: provenance.retrievalFinishedAt,
    downloadLastModified: provenance.lastModified,
    downloadEtag: provenance.etag,
    downloadContentLength: provenance.contentLength,
    bytes: provenance.bytes,
    sha256: provenance.sha256,
  },
  ...v2Methodology,
  format: {
    sourceColumns: columns,
    itemFile: "items.jsonl",
    promptContract:
      "Runners build prompts at execution time from position.fen. The local runner asks for exactly one legal move token in standard algebraic notation (SAN) with no explanation or extra text, still accepts UCI, normalizes accepted answers to UCI, reveals expected opponent replies in SAN after correct moves, and stops on the first wrong or invalid move.",
    expectedAnswer:
      "expected.uciLine contains the full forcing line after the Lichess setup move; expected.playerUciMoves contains only the side-to-move moves.",
  },
  selection: {
    seed,
    targetPerRatingBand: perBand,
    totalItems: items.length,
    filters: {
      minPopularity: filters.minPopularity,
      minPlays: filters.minPlays,
      ...(filters.minPlaysByBand && { minPlaysByBand: filters.minPlaysByBand }),
      maxRatingDeviation: filters.maxRatingDeviation,
      excludedThemes: filters.excludeMateIn1 ? ["mateIn1"] : [],
      ...(gate && { minGameCreatedAt: gate.thresholdUtc }),
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
    mateInOneByBand: countBy(
      items.filter((item) => item.metadata.themes.includes("mateIn1")),
      (item) => [item.metadata.ratingBand]
    ),
    belowDefaultMinPlaysByBand: countBy(
      items.filter((item) => item.metadata.nbPlays < filters.minPlays),
      (item) => [item.metadata.ratingBand]
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
