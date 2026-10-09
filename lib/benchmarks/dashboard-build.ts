import { buildAttemptEvidence, type AttemptSummary } from "./attempt-evidence"
import type { LichessPuzzleBenchmarkItem } from "./lichess-puzzles"
import { labOf, MODELS, type LabId } from "./models"

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

/** A scoreboard entry: one registry model at one reasoning level. */
export type DashboardModelInput = {
  id: string
  /** The registry model's Gateway ID; several entries can share one. */
  model: string
  name: string
  vendor: string
  lab: LabId
  color: string
  colorDark: string
}

export type DashboardAttemptRow = AttemptSummary & { attemptId: string }

/** An attempt as stored, minus its turns. */
export type StoredAttempt = {
  attemptId: string
  model: string
  reasoningLevel: string
  status: string
  record: AttemptSummary
}

export type DashboardBuildInput = {
  models: DashboardModelInput[]
  items: LichessPuzzleBenchmarkItem[]
  /** Finished attempt rows keyed by entry id. */
  rows: Record<string, DashboardAttemptRow[]>
  /** Pending (provider error) attempts per entry id; excluded from scores. */
  pending: Record<string, number>
  datasetSize: number
}

/**
 * Groups current-protocol attempts into scoreboard entries, one per registry
 * model and reasoning level. Models outside the registry have no display
 * metadata and are left out.
 */
export function entriesFrom(stored: StoredAttempt[]) {
  const models: DashboardModelInput[] = []
  const rows: Record<string, DashboardAttemptRow[]> = {}
  const pending: Record<string, number> = {}

  for (const model of MODELS) {
    const own = stored.filter((attempt) => attempt.model === model.id)

    for (const level of unique(own.map((a) => a.reasoningLevel)).sort()) {
      // Entry ids become CSS custom property names (`--color-<id>`).
      const id = `${model.id}-${level}`.replace(/[^a-z0-9-]+/gi, "-")
      const atLevel = own.filter((attempt) => attempt.reasoningLevel === level)

      models.push({
        id,
        model: model.id,
        name: `${model.name} · ${level}`,
        vendor: model.vendor,
        lab: labOf(model.id),
        color: model.color,
        colorDark: model.colorDark,
      })
      const finished = atLevel.filter((attempt) => attempt.status !== "error")
      const finishedItems = new Set(finished.map((a) => a.record.itemId))

      rows[id] = finished.map((attempt) => ({
        ...attempt.record,
        attemptId: attempt.attemptId,
      }))
      // Items whose every attempt so far was a provider error. An error row
      // stays after a successful retry, so rows alone would overcount.
      pending[id] = unique(
        atLevel
          .filter((attempt) => attempt.status === "error")
          .map((attempt) => attempt.record.itemId)
      ).filter((itemId) => !finishedItems.has(itemId)).length
    }
  }

  return { models, rows, pending }
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
  pending,
  datasetSize,
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
      buildScoreboardRow(model.id, rowsFor(model), pending[model.id] ?? 0)
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

function buildScoreboardRow(
  model: string,
  rows: DashboardAttemptRow[],
  pending: number
) {
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
    pending,
    accuracy: round(accuracy, 3),
    elo: estimateElo(avgRating, accuracy),
    eloLow: estimateElo(avgRating, Math.max(0, accuracy - step)),
    eloHigh: estimateElo(avgRating, Math.min(1, accuracy + step)),
    // Extrapolated from a small sample, so it is emitted at whole-dollar precision.
    cost: round(count === 0 ? 0 : (totalCost / count) * 1000, 0),
    avgTokens: Math.round(average(rows.map((row) => row.totalTokens ?? 0))),
    avgMoveTime: round(
      average(rows.map((row) => row.latencyMsTotal)) / 1000,
      1
    ),
    legalRate: round(count === 0 ? 0 : valid / count, 3),
  }
}

function buildCategoryStats(
  rows: DashboardAttemptRow[],
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
  // Entries are scored on their own item sets, so this is often a range.
  return counts.length === 0
    ? { min: 0, max: 0 }
    : { min: Math.min(...counts), max: Math.max(...counts) }
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
  rows: Record<string, DashboardAttemptRow[]>
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
        if (!row) {
          return null
        }
        const { attemptId, ...summary } = row
        return buildAttemptEvidence(model.id, attemptId, summary)
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

function latestDate(rows: DashboardAttemptRow[]) {
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
