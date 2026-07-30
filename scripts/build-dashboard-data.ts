import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { parseCsvRecords } from "@/lib/benchmarks/csv"
import type { LichessPuzzleBenchmarkItem } from "@/lib/benchmarks/lichess-puzzles"

type ModelId = "gpt5" | "claude45" | "gem25" | "ds35" | "grok4" | "qwen3"
type CategoryId =
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

type ModelConfig = {
  id: ModelId
  apiModel: string
  file: string
  name: string
  vendor: string
  color: string
  releaseQ: string
}

type ModelsDevData = {
  labIds: string[]
  modelKeysByLowercase: Map<string, string>
}

type ResultRow = {
  run_id: string
  created_at: string
  benchmark: string
  prompt_template_id: string
  model: string
  item_id: string
  lichess_puzzle_id: string
  rating: string
  rating_band: string
  rating_bucket: string
  primary_theme: string
  status: string
  solved: string
  first_move_correct: string
  exact_player_line: string
  player_move_prefix_score: string
  expected_full_line: string
  expected_player_line: string
  submitted_player_moves: string
  revealed_opponent_moves: string
  invalid_turn_index: string
  error_message: string
  latency_ms_total: string
  input_tokens: string
  output_tokens: string
  total_tokens: string
  reasoning_effort?: string
  max_output_tokens?: string
  reasoning_tokens?: string
  cost_usd?: string
  served_provider?: string
  generation_id?: string
  turns_json: string
}

type Turn = {
  turnIndex: number
  prompt: string
  rawAnswer: string
  parsedMove: string
  expectedMove: string
  result: string
  errorMessage: string
}

const benchmarkId = "lichess-puzzles-v1"
const resultsDir = `data/results/canonical/${benchmarkId}`
const itemsPath = `data/benchmarks/${benchmarkId}/items.jsonl`
const manifestPath = `data/benchmarks/${benchmarkId}/manifest.json`
const outputPath = "lib/benchmarks/dashboard-data.ts"

const models: ModelConfig[] = [
  {
    id: "gpt5",
    apiModel: "openai/gpt-5.5",
    file: "openai-gpt-5-5-single-move-v3-effort-only-20260605.csv",
    name: "GPT 5.5",
    vendor: "OpenAI",
    color: "#10a37f",
    releaseQ: "v3 low reasoning",
  },
  {
    id: "claude45",
    apiModel: "anthropic/claude-opus-4.8",
    file: "anthropic-claude-opus-4-8-single-move-v3-thinking-low-20260606.csv",
    name: "Claude Opus 4.8",
    vendor: "Anthropic",
    color: "#d97757",
    releaseQ: "v3 low thinking",
  },
  {
    id: "gem25",
    apiModel: "google/gemini-3.5-flash",
    file: "google-gemini-3-5-flash-single-move-v3-thinking-low-20260606.csv",
    name: "Gemini 3.5 Flash",
    vendor: "Google",
    color: "#4285f4",
    releaseQ: "v3 low thinking",
  },
  {
    id: "ds35",
    apiModel: "deepseek/deepseek-v3.2-thinking",
    file: "deepseek-deepseek-v3-2-thinking-single-move-v3-thinking-low-20260606.csv",
    name: "DeepSeek V3.2 Thinking",
    vendor: "DeepSeek",
    color: "#2563eb",
    releaseQ: "v3 low thinking",
  },
  {
    id: "grok4",
    apiModel: "xai/grok-4.1-fast-reasoning",
    file: "xai-grok-4-1-fast-reasoning-single-move-v3-thinking-low-20260606.csv",
    name: "Grok 4.1 Fast Reasoning",
    vendor: "xAI",
    color: "#111827",
    releaseQ: "v3 low thinking",
  },
  {
    id: "qwen3",
    apiModel: "alibaba/qwen3-max-thinking",
    file: "alibaba-qwen3-max-thinking-single-move-v3-thinking-low-20260606.csv",
    name: "Qwen3 Max Thinking",
    vendor: "Alibaba",
    color: "#8b5cf6",
    releaseQ: "v3 thinking model",
  },
]

const categories: Array<{
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

const allItems = await loadItems(itemsPath)
const itemsById = new Map(allItems.map((item) => [item.id, item]))
const rowsByModel = new Map<ModelId, ResultRow[]>()
const modelsDev = await loadModelsDevData()

for (const model of models) {
  rowsByModel.set(model.id, await readRows(join(resultsDir, model.file)))
}

const attemptedItemIds = unique(
  models.flatMap((model) =>
    (rowsByModel.get(model.id) ?? []).map((row) => row.item_id)
  )
)
const attemptedItems = attemptedItemIds
  .map((id) => itemsById.get(id))
  .filter((item): item is LichessPuzzleBenchmarkItem => Boolean(item))
const latestCreatedAt = latestDate(
  models.flatMap((model) => rowsByModel.get(model.id) ?? [])
)
const totalRows = models.reduce(
  (sum, model) => sum + (rowsByModel.get(model.id)?.length ?? 0),
  0
)

const dashboardModels = models.map(
  ({ id, apiModel, name, vendor, color, releaseQ }) => ({
    id,
    name,
    vendor,
    lab: resolveModelLab(apiModel, modelsDev),
    color,
    releaseQ,
  })
)
// Narrowed to the labs the benchmark actually references so the union stays
// deterministic; resolveModelLab still validates each lab against models.dev.
const dashboardLabIds = unique(dashboardModels.map((model) => model.lab)).sort()
const dashboardCategories = categories.map(({ id, label }) => ({ id, label }))
const scoreboard = models.map((model) =>
  buildScoreboardRow(model, rowsByModel.get(model.id) ?? [])
)
const categoryStats = models.map((model) => ({
  id: model.id,
  ...buildCategoryStats(rowsByModel.get(model.id) ?? [], itemsById),
}))
const categoryScores = Object.fromEntries(
  categoryStats.map((entry) => [entry.id, entry.scores])
) as Record<ModelId, Record<CategoryId, number | null>>
const categorySample = Object.fromEntries(
  categoryStats.map((entry) => [entry.id, entry.sample])
) as Record<ModelId, Record<CategoryId, number>>
const puzzles = attemptedItems.map((item) => buildPuzzle(item, rowsByModel))
const datasetSize = await loadDatasetSize(manifestPath, allItems.length)
const sampleSize = resolveSampleSize()

const sourceFiles = models.map((model) => model.file)
const contents = `// Generated by scripts/build-dashboard-data.ts from canonical benchmark CSVs.
// Do not edit this file by hand.

export type DashboardModelId = ${models.map((model) => JSON.stringify(model.id)).join(" | ")}
export type DashboardLabId = ${dashboardLabIds.map((lab) => JSON.stringify(lab)).join(" | ")}
export type DashboardCategoryId = ${categories.map((category) => JSON.stringify(category.id)).join(" | ")}

export type DashboardModel = {
  id: DashboardModelId
  name: string
  vendor: string
  lab: DashboardLabId
  color: string
  releaseQ: string
}

export type DashboardScore = {
  model: DashboardModelId
  accuracy: number
  elo: number
  cost: number
  avgTokens: number
  avgMoveTime: number
  legalRate: number
}

export type DashboardPuzzleItem = {
  id: string
  fen: string
  themes: DashboardCategoryId[]
  side: "w" | "b"
  rating: number
  popularity: number
  solution: string[]
  caption: string
  attempts: DashboardSolutionAttempt[]
}

export type DashboardSolutionAttempt = {
  model: DashboardModelId
  correct: boolean
  playedMove: string
  movePretty: string
  thinkingMs: number
  thinkingTokens: number
  transcript: string
}

export const MODELS: DashboardModel[] = ${toTs(dashboardModels)}

export const CATEGORIES: Array<{ id: DashboardCategoryId; label: string }> = ${toTs(dashboardCategories)}

export const SCOREBOARD: DashboardScore[] = ${toTs(scoreboard)}

// null means the model had no evaluated puzzle in that theme bucket; it is not a score.
export const CATEGORY: Record<DashboardModelId, Record<DashboardCategoryId, number | null>> = ${toTs(categoryScores)}

// Number of evaluated puzzles behind each CATEGORY reading.
export const CATEGORY_SAMPLE: Record<DashboardModelId, Record<DashboardCategoryId, number>> = ${toTs(categorySample)}

export const PUZZLES: DashboardPuzzleItem[] = ${toTs(puzzles)}

export const META = ${toTs({
  puzzleCount: attemptedItems.length,
  evaluations: totalRows,
  sampleSize,
  datasetSize,
  lastUpdated: latestCreatedAt.slice(0, 10),
  version: "0.8.0",
  benchmarkId,
  sourceFiles,
  rowsByModel: Object.fromEntries(
    models.map((model) => [model.id, rowsByModel.get(model.id)?.length ?? 0])
  ),
  maxOutputTokens: "uncapped",
  eloIsEstimated: true,
  costIsExtrapolated: true,
})}
`

await writeFile(outputPath, contents)
console.log(`Wrote dashboard data to ${outputPath}`)

async function loadItems(path: string): Promise<LichessPuzzleBenchmarkItem[]> {
  const contents = await readFile(path, "utf8")
  return contents
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LichessPuzzleBenchmarkItem)
}

async function loadModelsDevData(): Promise<ModelsDevData> {
  const response = await fetch("https://models.dev/models.json")

  if (!response.ok) {
    throw new Error(
      `Unable to load models.dev model catalog: ${response.status} ${response.statusText}`
    )
  }

  const catalog = (await response.json()) as Record<string, unknown>
  const modelKeys = Object.keys(catalog)
  const labIds = unique(modelKeys.map((key) => key.split("/")[0] ?? ""))
    .filter(Boolean)
    .sort()

  if (labIds.length === 0) {
    throw new Error(
      "models.dev model catalog did not contain lab-prefixed keys"
    )
  }

  return {
    labIds,
    modelKeysByLowercase: new Map(
      modelKeys.map((key) => [key.toLowerCase(), key])
    ),
  }
}

function resolveModelLab(apiModel: string, modelsDev: ModelsDevData): string {
  const lab = apiModel.split("/")[0]?.toLowerCase()

  if (!lab || !modelsDev.labIds.includes(lab)) {
    throw new Error(
      `Unable to resolve models.dev lab for ${apiModel}. Expected the model id to start with a known models.dev lab id.`
    )
  }

  const matchedKey = modelKeyCandidates(apiModel).find((candidate) =>
    modelsDev.modelKeysByLowercase.has(candidate.toLowerCase())
  )

  if (!matchedKey) {
    console.warn(
      `No exact models.dev model key found for ${apiModel}; using validated lab prefix ${lab}.`
    )
  }

  return lab
}

function modelKeyCandidates(apiModel: string): string[] {
  const [lab = "", slug = ""] = apiModel.split("/")
  const slugCandidates = unique([
    slug,
    slug.replace(/\.(?=\d)/g, "-"),
    slug.replace(/-(thinking|reasoning|non-reasoning)$/i, ""),
    slug
      .replace(/-(thinking|reasoning|non-reasoning)$/i, "")
      .replace(/\.(?=\d)/g, "-"),
  ]).filter(Boolean)

  return slugCandidates.map((candidate) => `${lab}/${candidate}`)
}

async function readRows(path: string): Promise<ResultRow[]> {
  const contents = await readFile(path, "utf8")
  const [headers, ...records] = parseCsvRecords(contents)

  if (!headers) {
    return []
  }

  return records.map((cells) => {
    return Object.fromEntries(
      headers.map((header, index) => [header, cells[index] ?? ""])
    ) as ResultRow
  })
}

function buildScoreboardRow(model: ModelConfig, rows: ResultRow[]) {
  const count = rows.length
  const solved = rows.filter((row) => row.solved === "true").length
  const valid = rows.filter((row) => row.status !== "invalid_format").length
  const accuracy = count === 0 ? 0 : solved / count
  const avgRating =
    count === 0
      ? 0
      : average(rows.map((row) => Number(row.rating)).filter(Number.isFinite))
  const totalCost = sum(rows.map((row) => Number(row.cost_usd ?? 0)))

  return {
    model: model.id,
    accuracy: round(accuracy, 3),
    elo: estimateElo(avgRating, accuracy),
    // Extrapolated from a small sample, so it is emitted at whole-dollar precision.
    cost: round(count === 0 ? 0 : (totalCost / count) * 1000, 0),
    avgTokens: Math.round(
      average(
        rows.map((row) => Number(row.total_tokens)).filter(Number.isFinite)
      )
    ),
    avgMoveTime: round(
      average(
        rows.map((row) => Number(row.latency_ms_total)).filter(Number.isFinite)
      ) / 1000,
      1
    ),
    legalRate: round(count === 0 ? 0 : valid / count, 3),
  }
}

function buildCategoryStats(
  rows: ResultRow[],
  itemLookup: Map<string, LichessPuzzleBenchmarkItem>
): {
  scores: Record<CategoryId, number | null>
  sample: Record<CategoryId, number>
} {
  const scores = new Map<CategoryId, number | null>()
  const sample = new Map<CategoryId, number>()

  for (const category of categories) {
    const categoryRows = rows.filter((row) => {
      const item = itemLookup.get(row.item_id)
      return item ? category.matches(item) : false
    })

    sample.set(category.id, categoryRows.length)
    scores.set(
      category.id,
      categoryRows.length === 0
        ? null
        : round(
            categoryRows.filter((row) => row.solved === "true").length /
              categoryRows.length,
            3
          )
    )
  }

  return {
    scores: Object.fromEntries(scores) as Record<CategoryId, number | null>,
    sample: Object.fromEntries(sample) as Record<CategoryId, number>,
  }
}

async function loadDatasetSize(path: string, itemCount: number) {
  const manifest = JSON.parse(await readFile(path, "utf8")) as {
    selection?: { totalItems?: number }
  }
  const declared = manifest.selection?.totalItems

  if (typeof declared !== "number" || !Number.isFinite(declared)) {
    return itemCount
  }

  if (declared !== itemCount) {
    console.warn(
      `Manifest totalItems (${declared}) does not match ${itemsPath} row count (${itemCount}); using the row count.`
    )
    return itemCount
  }

  return declared
}

function resolveSampleSize() {
  const counts = models.map(
    (model) =>
      unique((rowsByModel.get(model.id) ?? []).map((row) => row.item_id)).length
  )
  const min = Math.min(...counts)
  const max = Math.max(...counts)

  if (min === max) {
    return min
  }

  console.warn(
    `Models were evaluated on different puzzle counts (min ${min}, max ${max}); emitting a range for META.sampleSize.`
  )

  return { min, max }
}

function buildPuzzle(
  item: LichessPuzzleBenchmarkItem,
  resultRows: Map<ModelId, ResultRow[]>
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
        const row = resultRows
          .get(model.id)
          ?.find((candidate) => candidate.item_id === item.id)
        return row ? buildAttempt(model.id, row) : null
      })
      .filter((attempt): attempt is NonNullable<typeof attempt> =>
        Boolean(attempt)
      ),
  }
}

function buildAttempt(model: ModelId, row: ResultRow) {
  const moves = parseJson<string[]>(row.submitted_player_moves, [])
  const playedMove = moves[0] ?? ""
  const turns = parseJson<Turn[]>(row.turns_json, [])

  return {
    model,
    correct: row.solved === "true",
    playedMove,
    movePretty: prettyMove(playedMove),
    thinkingMs: finiteNumber(row.latency_ms_total) ?? 0,
    thinkingTokens:
      finiteNumber(row.reasoning_tokens) ?? finiteNumber(row.total_tokens) ?? 0,
    transcript: buildTranscript(row, turns),
  }
}

function buildTranscript(row: ResultRow, turns: Turn[]): string {
  const header = [
    `# ${row.model} trace - ${row.item_id}`,
    `Run: ${row.run_id}`,
    `Generation: ${row.generation_id || "not recorded"}`,
    `Served provider: ${row.served_provider || "not recorded"}`,
    `Status: ${row.status}`,
    `Solved: ${row.solved}`,
    `Expected player line: ${parseJson<string[]>(
      row.expected_player_line,
      []
    ).join(" ")}`,
    `Submitted player moves: ${parseJson<string[]>(
      row.submitted_player_moves,
      []
    ).join(" ")}`,
    `Latency: ${row.latency_ms_total}ms`,
    `Tokens: ${row.total_tokens || "not recorded"}`,
    `Reasoning effort: ${row.reasoning_effort || "not recorded"}`,
    `Max output tokens: ${row.max_output_tokens || "not recorded"}`,
    `Reasoning tokens: ${row.reasoning_tokens || "not recorded"}`,
    `Cost USD: ${row.cost_usd || "not recorded"}`,
  ]

  const turnText = turns.flatMap((turn) => [
    "",
    `Turn ${turn.turnIndex + 1}`,
    "Prompt:",
    turn.prompt,
    "Raw answer:",
    turn.rawAnswer || "(empty)",
    `Parsed move: ${turn.parsedMove || "(none)"}`,
    `Expected move: ${turn.expectedMove}`,
    `Result: ${turn.result}`,
    ...(turn.errorMessage ? [`Error: ${turn.errorMessage}`] : []),
  ])

  return [...header, ...turnText].join("\n")
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

function prettyMove(uci: string) {
  if (!uci) {
    return ""
  }

  return `${uci.slice(0, 2)} -> ${uci.slice(2, 4)}${
    uci.length > 4 ? `=${uci[4]?.toUpperCase()}` : ""
  }`
}

function formatTheme(theme: string) {
  return theme
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (first) => first.toUpperCase())
}

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function estimateElo(avgRating: number, score: number) {
  const clamped = Math.max(0.01, Math.min(0.99, score))
  return Math.round(avgRating + 400 * Math.log10(clamped / (1 - clamped)))
}

function latestDate(rows: ResultRow[]) {
  return (
    rows
      .map((row) => row.created_at)
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

function finiteNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function unique<T>(values: T[]) {
  return [...new Set(values)]
}

function round(value: number, digits: number) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function toTs(value: unknown) {
  return JSON.stringify(value, null, 2)
}
