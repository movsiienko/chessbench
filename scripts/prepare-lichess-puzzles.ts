// Step 3 of building the puzzle set: sample it from the date gate's tagged
// output (filter-lichess-puzzles-by-game-date.ts, then cook-lichess-puzzles.py)
// and write items.jsonl plus manifest.json. See the set's README.
//
//   bun scripts/prepare-lichess-puzzles.ts --gate=<date gate cache dir>
import { createHash, randomUUID } from "node:crypto"
import {
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
} from "node:fs"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { parseCsvRecords } from "@/lib/benchmarks/csv"
import {
  LICHESS_PUZZLE_COLUMNS as columns,
  MIN_GAME_CREATED_AT as threshold,
  QUALITY_FILTERS as filters,
  SAMPLING_SEED as seed,
} from "@/lib/benchmarks/lichess-puzzle-builder"
import { sampleLichessPuzzles } from "@/lib/benchmarks/lichess-puzzle-sampler"
import {
  BENCHMARK_ID,
  type LichessPuzzleBenchmarkItem,
} from "@/lib/benchmarks/lichess-puzzles"
import { gameIdOf, readGameDates } from "./lichess-files"

const gateDir = readOption("--gate")

if (!gateDir) {
  throw new Error("Pass --gate=<date gate cache dir>.")
}

const sourcePath = join(gateDir, "qualifying-cooked.csv")
const outDir = readOption("--out") ?? join("data/benchmarks", BENCHMARK_ID)
const perBand = Number(readOption("--per-band") ?? 100)
const gate = JSON.parse(readFileSync(join(gateDir, "gate.json"), "utf8"))

if (gate.thresholdUtc !== threshold) {
  throw new Error(
    `The gate used ${gate.thresholdUtc}; the set needs ${threshold}.`
  )
}

if (!existsSync(sourcePath)) {
  throw new Error(
    `Missing ${sourcePath}. Tag qualifying.csv with scripts/cook-lichess-puzzles.py first.`
  )
}

const qualifying = readFileSync(join(gateDir, "qualifying.csv"), "utf8")

if (
  createHash("sha256").update(qualifying).digest("hex") !==
  gate.qualifyingSha256
) {
  throw new Error("qualifying.csv is not the one gate.json describes.")
}

// Sampled exactly as checked: tagging may rewrite Themes and nothing else in
// the gate's qualifying rows.
const cooked = readFileSync(sourcePath, "utf8")
const themesColumn = columns.indexOf("Themes")
const withoutThemes = (csv: string) =>
  csv
    .trimEnd()
    .split("\n")
    .map((line) =>
      JSON.stringify(
        (parseCsvRecords(line)[0] ?? []).filter(
          (_, index) => index !== themesColumn
        )
      )
    )
    .join("\n")

if (withoutThemes(qualifying) !== withoutThemes(cooked)) {
  throw new Error("qualifying-cooked.csv is not a tagging of qualifying.csv.")
}

// The dump's download record; the gate checked it against the dump it read.
const provenance = gate.source
const committedManifest = join(outDir, "manifest.json")

// A committed set is immutable: a newer dump goes to another --out.
if (
  existsSync(committedManifest) &&
  JSON.parse(readFileSync(committedManifest, "utf8")).source?.sha256 !==
    provenance.sha256
) {
  throw new Error(
    `${outDir} was built from a different dump. Pass --out=<new dir> to build from this one.`
  )
}

const { items, sourceStats, ratingBands } = await sampleLichessPuzzles(
  cooked.trimEnd().split("\n"),
  { seed, perBand }
)
const createdAt = readGameDates(join(gateDir, "game-dates.ndjson"))

for (const item of items) {
  const ms = createdAt.get(gameIdOf(item.metadata.lichessGameUrl))
  if (ms === undefined || ms === null || ms < Date.parse(threshold)) {
    throw new Error(`${item.id} has no game date on or after the threshold.`)
  }
  item.metadata.gameCreatedAt = new Date(ms).toISOString()
}

const itemsPath = join(outDir, "items.jsonl")
const manifestPath = join(outDir, "manifest.json")
const itemsJsonl = items.map((item) => `${JSON.stringify(item)}\n`).join("")

// A committed set is never rewritten: identical items are left untouched, and
// different ones are refused.
const refuseDifferentSet = () => {
  if (readFileSync(itemsPath, "utf8") !== itemsJsonl) {
    throw new Error(
      `${outDir} holds a different puzzle set. Pass --out=<new dir> to write this one.`
    )
  }
}

if (existsSync(itemsPath)) {
  refuseDifferentSet()
  if (existsSync(manifestPath)) {
    // An exact rebuild: the committed set, manifest included, stays as is.
    console.log(`${outDir} already holds this set; left unchanged.`)
    process.exit(0)
  }
} else {
  // Staged in a file this run alone creates ("wx"), so an interrupted write
  // never leaves a partial items.jsonl, and published with link, which unlike
  // rename fails if another run got there first; that run's items must then
  // match.
  mkdirSync(outDir, { recursive: true })
  const staged = `${itemsPath}.${randomUUID()}.part`
  try {
    await writeFile(staged, itemsJsonl, { flag: "wx" })
    try {
      linkSync(staged, itemsPath)
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "EEXIST")
      ) {
        throw error
      }
      refuseDifferentSet()
    }
  } finally {
    rmSync(staged, { force: true })
  }
}

const manifest = {
  id: BENCHMARK_ID,
  title: "Lichess Puzzles",
  description:
    "A deterministic, quality-filtered chess puzzle benchmark of Lichess puzzles from games played on or after June 1, 2026 (UTC).",
  createdAt: gate.completedAt,
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
  baseline: {
    ...gate.baseline,
    role: "Puzzle ids already in this April 2026 dump are excluded, since their games predate the date threshold.",
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
    why: "Lichess adds puzzles with empty themes and tags them later, so most recent puzzles in the dump carry only phase/source tags. Every puzzle in the set is re-tagged with the same tagger.",
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
    "Kept. The scorer accepts only the Lichess solution, so a different mating move scores as a miss.",
  contamination: {
    note: "Temporally held out by underlying game date: every puzzle comes from a game created on or after the threshold. That is not proof the puzzles are absent from any model's training data. June 1, 2026 precedes Mistral Large 4's latest training-data collection (September 2026), most providers publish no exact cutoff, models may receive later post-training, and the same positions can occur in earlier games.",
    sources: [
      "https://legal.mistral.ai/documents/Mistral%20Large%204%20-%20Public%20Summary%20of%20Training%20Content.pdf",
      "https://platform.claude.com/docs/en/about-claude/models/overview",
    ],
  },
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
      minPlaysByBand: filters.minPlaysByBand,
      maxRatingDeviation: filters.maxRatingDeviation,
      minGameCreatedAt: threshold,
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

// Staged and renamed, so an interrupted write never leaves a partial manifest.
const stagedManifest = `${manifestPath}.${randomUUID()}.part`
await writeFile(stagedManifest, `${JSON.stringify(manifest, null, 2)}\n`)
renameSync(stagedManifest, manifestPath)

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
