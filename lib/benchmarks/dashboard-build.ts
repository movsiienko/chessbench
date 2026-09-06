import { buildAttemptEvidence } from "./attempt-evidence"
import type { LichessPuzzleBenchmarkItem } from "./lichess-puzzles"
import type { LichessPuzzleAttemptRow } from "./local-runner"

export type CategoryId =
  | "mate"
  | "fork"
  | "pin"
  | "skewer"
  | "discoAtk"
  | "sacrifice"
  | "endgame"
  | "opening"
  | "middlegame"
  | "defense"
  | "zugzwang"
  | "promotion"

export type DashboardModelInput = {
  id: string
  name: string
  vendor: string
  lab: string
  color: string
  colorDark: string
  releaseQ: string
}

export type DashboardBuildInput = {
  models: DashboardModelInput[]
  items: LichessPuzzleBenchmarkItem[]
  /** Attempt rows keyed by model id. */
  rows: Record<string, LichessPuzzleAttemptRow[]>
  datasetSize: number
  sourceFiles: string[]
}

/** Puzzle rating slider granularity; `meta.ratingBounds` is rounded to it. */
const RATING_STEP = 50

export const categories: Array<{
  id: CategoryId
  label: string
  matches: (item: LichessPuzzleBenchmarkItem) => boolean
}> = [
  { id: "mate", label: "Mate", matches: byThemePrefix("mate") },
  { id: "fork", label: "Fork", matches: byTheme("fork") },
  { id: "pin", label: "Pin", matches: byTheme("pin") },
  { id: "skewer", label: "Skewer", matches: byTheme("skewer") },
  {
    id: "discoAtk",
    label: "Discovered attack",
    matches: byTheme("discoveredAttack"),
  },
  { id: "sacrifice", label: "Sacrifice", matches: byTheme("sacrifice") },
  {
    id: "endgame",
    label: "Endgame",
    matches: (item) => item.metadata.themeGroups.includes("endgame"),
  },
  {
    id: "opening",
    label: "Opening",
    matches: (item) =>
      item.metadata.themes.includes("opening") ||
      item.metadata.openingTags.length > 0,
  },
  { id: "middlegame", label: "Middlegame", matches: byTheme("middlegame") },
  {
    id: "defense",
    label: "Defense",
    matches: (item) =>
      item.metadata.themeGroups.includes("defense") ||
      item.metadata.themes.includes("defensiveMove"),
  },
  { id: "zugzwang", label: "Zugzwang", matches: byTheme("zugzwang") },
  {
    id: "promotion",
    label: "Promotion",
    matches: (item) =>
      item.metadata.themes.includes("promotion") ||
      item.metadata.themes.includes("advancedPawn") ||
      item.metadata.themes.includes("underPromotion"),
  },
]

/**
 * Everything the dashboard reads, derived once here so the browser only
 * formats. Pure: no paths, no network.
 */
export function buildDashboardData({
  models,
  items,
  rows,
  datasetSize,
  sourceFiles,
}: DashboardBuildInput) {
  const itemsById = new Map(items.map((item) => [item.id, item]))
  const rowsFor = (model: DashboardModelInput) => rows[model.id] ?? []
  const allRows = models.flatMap(rowsFor)
  const attemptedItems = unique(allRows.map((row) => row.itemId))
    .map((id) => itemsById.get(id))
    .filter((item): item is LichessPuzzleBenchmarkItem => Boolean(item))
  const ratings = attemptedItems.map((item) => item.metadata.rating)
  const names = models.map((model) => model.name)

  return {
    models: models.map((model) => ({
      ...model,
      shortName: shortName(model.name, names),
    })),
    labIds: unique(models.map((model) => model.lab)).sort(),
    categories: categories.map(({ id, label }) => ({ id, label })),
    scoreboard: models.map((model) =>
      buildScoreboardRow(model.id, rowsFor(model))
    ),
    category: Object.fromEntries(
      models.map((model) => [
        model.id,
        buildCategoryStats(rowsFor(model), itemsById),
      ])
    ),
    puzzles: attemptedItems.map((item) => buildPuzzle(item, models, rows)),
    meta: {
      puzzleCount: attemptedItems.length,
      evaluations: allRows.length,
      sampleSize: resolveSampleSize(
        models.map(
          (model) => unique(rowsFor(model).map((row) => row.itemId)).length
        )
      ),
      datasetSize,
      lastUpdated: latestDate(allRows).slice(0, 10),
      version: "0.8.0",
      benchmarkId: "lichess-puzzles-v1",
      sourceFiles,
      rowsByModel: Object.fromEntries(
        models.map((model) => [model.id, rowsFor(model).length])
      ),
      ratingBounds: ratingBoundsOf(ratings),
      ratingStep: RATING_STEP,
      maxOutputTokens: "uncapped",
      eloIsEstimated: true,
      costIsExtrapolated: true,
    },
  }
}

export type DashboardData = ReturnType<typeof buildDashboardData>

/** Shortest word prefix of `name` that no other name starts with. */
function shortName(name: string, names: string[]) {
  const words = name.split(" ")

  for (let length = 1; length < words.length; length += 1) {
    const candidate = words.slice(0, length).join(" ")

    if (names.filter((other) => other.startsWith(candidate)).length === 1) {
      return candidate
    }
  }

  return name
}

function buildScoreboardRow(model: string, rows: LichessPuzzleAttemptRow[]) {
  const count = rows.length
  const solved = rows.filter((row) => row.solved).length
  const valid = rows.filter((row) => row.status !== "invalid_format").length
  const accuracy = count === 0 ? 0 : solved / count
  const avgRating = count === 0 ? 0 : average(rows.map((row) => row.rating))
  const totalCost = sum(rows.map((row) => row.costUsd ?? 0))
  // One puzzle's worth of accuracy: the band shows where the Elo estimate
  // lands if the model solves or misses one more puzzle at this sample size.
  const step = count === 0 ? 0 : 1 / count

  return {
    model,
    n: count,
    accuracy: round(accuracy, 3),
    elo: estimateElo(avgRating, accuracy),
    eloLow: estimateElo(avgRating, Math.max(0, accuracy - step)),
    eloHigh: estimateElo(avgRating, Math.min(1, accuracy + step)),
    // Extrapolated from a small sample, so it is emitted at whole-dollar precision.
    cost: round(count === 0 ? 0 : (totalCost / count) * 1000, 0),
    // Errored attempts have no usage; they count as 0 tokens in the average.
    avgTokens: Math.round(average(rows.map((row) => row.totalTokens ?? 0))),
    avgMoveTime: round(
      average(rows.map((row) => row.latencyMsTotal)) / 1000,
      1
    ),
    legalRate: round(count === 0 ? 0 : valid / count, 3),
  }
}

function buildCategoryStats(
  rows: LichessPuzzleAttemptRow[],
  itemLookup: Map<string, LichessPuzzleBenchmarkItem>
) {
  const stats = new Map<CategoryId, { accuracy: number | null; n: number }>()

  for (const category of categories) {
    const categoryRows = rows.filter((row) => {
      const item = itemLookup.get(row.itemId)
      return item ? category.matches(item) : false
    })

    stats.set(category.id, {
      accuracy:
        categoryRows.length === 0
          ? null
          : round(
              categoryRows.filter((row) => row.solved).length /
                categoryRows.length,
              3
            ),
      n: categoryRows.length,
    })
  }

  // SAFETY: `stats` is filled by iterating `categories`, so its keys are exactly the CategoryId union.
  return Object.fromEntries(stats) as Record<
    CategoryId,
    { accuracy: number | null; n: number }
  >
}

function resolveSampleSize(counts: number[]) {
  const min = Math.min(...counts)
  const max = Math.max(...counts)

  if (min !== max) {
    console.warn(
      `Models were evaluated on different puzzle counts (min ${min}, max ${max}); emitting a range for META.sampleSize.`
    )
  }

  return { min, max }
}

function ratingBoundsOf(ratings: number[]): [number, number] {
  if (ratings.length === 0) {
    return [0, 0]
  }

  return [
    Math.floor(Math.min(...ratings) / RATING_STEP) * RATING_STEP,
    Math.ceil(Math.max(...ratings) / RATING_STEP) * RATING_STEP,
  ]
}

function buildPuzzle(
  item: LichessPuzzleBenchmarkItem,
  models: DashboardModelInput[],
  rows: Record<string, LichessPuzzleAttemptRow[]>
) {
  return {
    id: item.id,
    fen: item.position.fen,
    themes: categoriesFor(item),
    side: item.position.sideToMove,
    rating: item.metadata.rating,
    popularity: item.metadata.popularity,
    solution: item.expected.playerUciMoves,
    caption: `${item.metadata.lichessPuzzleId}: ${formatTheme(
      item.metadata.primaryTheme
    )} puzzle rated ${item.metadata.rating}.`,
    attempts: models
      .map((model) => {
        const row = rows[model.id]?.find(
          (candidate) => candidate.itemId === item.id
        )
        return row ? buildAttemptEvidence(model.id, row) : null
      })
      .filter((attempt): attempt is NonNullable<typeof attempt> =>
        Boolean(attempt)
      ),
  }
}

function categoriesFor(item: LichessPuzzleBenchmarkItem): CategoryId[] {
  const matched = categories
    .filter((category) => category.matches(item))
    .map((category) => category.id)

  return matched.length > 0 ? matched.slice(0, 3) : ["middlegame"]
}

function byTheme(theme: string) {
  return (item: LichessPuzzleBenchmarkItem) =>
    item.metadata.themes.includes(theme)
}

function byThemePrefix(prefix: string) {
  return (item: LichessPuzzleBenchmarkItem) =>
    item.metadata.themes.some((theme) => theme.startsWith(prefix))
}

function formatTheme(theme: string) {
  return theme
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (first) => first.toUpperCase())
}

function estimateElo(avgRating: number, score: number) {
  const clamped = Math.max(0.01, Math.min(0.99, score))
  return Math.round(avgRating + 400 * Math.log10(clamped / (1 - clamped)))
}

function latestDate(rows: LichessPuzzleAttemptRow[]) {
  return (
    rows
      .map((row) => row.createdAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? new Date(0).toISOString()
  )
}

function average(values: number[]) {
  return values.length === 0 ? 0 : sum(values) / values.length
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

function unique<T>(values: T[]) {
  return [...new Set(values)]
}

function round(value: number, digits: number) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}
