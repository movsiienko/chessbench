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
  /** Brand hex, exactly as the lab publishes it. Never rendered unchanged. */
  brand: string
  releaseQ: string
}

type Rgb = { r: number; g: number; b: number }
type Oklch = { l: number; c: number; h: number }
type SeriesColors = { color: string; colorDark: string }

type CategoryScore = {
  accuracy: number | null
  n: number
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
const outputPath = "lib/benchmarks/dashboard-data.ts"

const models: ModelConfig[] = [
  {
    id: "gpt5",
    apiModel: "openai/gpt-5.5",
    file: "openai-gpt-5-5-single-move-v3-effort-only-20260605.csv",
    name: "GPT 5.5",
    vendor: "OpenAI",
    brand: "#10a37f",
    releaseQ: "v3 low reasoning",
  },
  {
    id: "claude45",
    apiModel: "anthropic/claude-opus-4.8",
    file: "anthropic-claude-opus-4-8-single-move-v3-thinking-low-20260606.csv",
    name: "Claude Opus 4.8",
    vendor: "Anthropic",
    brand: "#d97757",
    releaseQ: "v3 low thinking",
  },
  {
    id: "gem25",
    apiModel: "google/gemini-3.5-flash",
    file: "google-gemini-3-5-flash-single-move-v3-thinking-low-20260606.csv",
    name: "Gemini 3.5 Flash",
    vendor: "Google",
    brand: "#4285f4",
    releaseQ: "v3 low thinking",
  },
  {
    id: "ds35",
    apiModel: "deepseek/deepseek-v3.2-thinking",
    file: "deepseek-deepseek-v3-2-thinking-single-move-v3-thinking-low-20260606.csv",
    name: "DeepSeek V3.2 Thinking",
    vendor: "DeepSeek",
    brand: "#2563eb",
    releaseQ: "v3 low thinking",
  },
  {
    id: "grok4",
    apiModel: "xai/grok-4.1-fast-reasoning",
    file: "xai-grok-4-1-fast-reasoning-single-move-v3-thinking-low-20260606.csv",
    name: "Grok 4.1 Fast Reasoning",
    vendor: "xAI",
    brand: "#111827",
    releaseQ: "v3 low thinking",
  },
  {
    id: "qwen3",
    apiModel: "alibaba/qwen3-max-thinking",
    file: "alibaba-qwen3-max-thinking-single-move-v3-thinking-low-20260606.csv",
    name: "Qwen3 Max Thinking",
    vendor: "Alibaba",
    brand: "#8b5cf6",
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

/** `--card` in app/globals.css, light and dark. */
const LIGHT_SURFACE: Oklch = { l: 1, c: 0, h: 0 }
const DARK_SURFACE: Oklch = { l: 0.205, c: 0, h: 0 }
/** WCAG 1.4.11 asks 3:1 for graphical objects; the extra 0.5 is headroom. */
const SERIES_MIN_CONTRAST = 3.5
/**
 * A near-grey series has no hue to tell it apart, so it earns luminance
 * separation instead. This is also what the lab logos do: they invert.
 */
const NEUTRAL_SERIES_MIN_CONTRAST = 8
const ACHROMATIC_CHROMA = 0.04
const MIN_HUE_SEPARATION = 40

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

const seriesColors = buildSeriesPalette(models.map((model) => model.brand))
const dashboardModels = models.map(
  ({ id, apiModel, name, vendor, releaseQ }, index) => ({
    id,
    name,
    vendor,
    lab: resolveModelLab(apiModel, modelsDev),
    ...(seriesColors[index] as SeriesColors),
    releaseQ,
  })
)
/**
 * The emitted `DashboardLabId` union covers exactly the labs the configured
 * models belong to, never the full remote catalog: models.dev gains labs on its
 * own schedule, and widening the union from it would rewrite this file — and
 * break the `satisfies Record<DashboardLabId, ...>` check on `LAB_SVGS` — on
 * any day a third party shipped a lab nothing here uses. Derived this way the
 * union only moves when the model list above moves, and the exhaustiveness
 * check still fails the build when a lab the dashboard *does* render has no
 * logo.
 */
const usedLabIds = unique(dashboardModels.map((model) => model.lab)).sort()
const dashboardCategories = categories.map(({ id, label }) => ({ id, label }))
const scoreboard = models.map((model) =>
  buildScoreboardRow(model, rowsByModel.get(model.id) ?? [])
)
const categoryScores = Object.fromEntries(
  models.map((model) => [
    model.id,
    buildCategoryScores(rowsByModel.get(model.id) ?? [], itemsById),
  ])
) as Record<ModelId, Record<CategoryId, CategoryScore>>
const eloHistory = Object.fromEntries(
  scoreboard.map((row) => [row.model, [row.elo]])
) as Record<ModelId, number[]>
const puzzles = attemptedItems.map((item) => buildPuzzle(item, rowsByModel))

const sourceFiles = models.map((model) => model.file)
const contents = `// Generated by scripts/build-dashboard-data.ts from canonical benchmark CSVs.
// Do not edit this file by hand.

export type DashboardModelId = ${models.map((model) => JSON.stringify(model.id)).join(" | ")}
export type DashboardLabId = ${usedLabIds.map((lab) => JSON.stringify(lab)).join(" | ")}
export type DashboardCategoryId = ${categories.map((category) => JSON.stringify(category.id)).join(" | ")}

export type DashboardModel = {
  id: DashboardModelId
  name: string
  vendor: string
  lab: DashboardLabId
  /**
   * Chart series color for the light theme. Derived from the lab's brand hex:
   * hue is kept (rotated only to break a collision with an earlier series) and
   * lightness is moved until the color clears ${SERIES_MIN_CONTRAST}:1 against
   * the light \`--card\` surface, so it satisfies WCAG 1.4.11 as a graphical
   * object. Never assume the brand hex itself is safe on either surface.
   */
  color: string
  /** Same series, fitted to the dark \`--card\` surface. */
  colorDark: string
  releaseQ: string
}

export type DashboardScore = {
  model: DashboardModelId
  /** Puzzles this model was actually evaluated on. */
  n: number
  accuracy: number
  /** Derived from puzzle ratings and accuracy, not a played rating. */
  elo: number
  /** Extrapolated cost per 1,000 puzzles from the sampled rows. */
  cost: number
  avgTokens: number
  avgMoveTime: number
  legalRate: number
}

/**
 * Per-theme accuracy. \`accuracy\` is null when the sample contained no puzzle
 * in that bucket, so consumers must render an absence instead of a value.
 */
export type DashboardCategoryScore = {
  accuracy: number | null
  n: number
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

export const CATEGORY: Record<DashboardModelId, Record<DashboardCategoryId, DashboardCategoryScore>> = ${toTs(categoryScores)}

export const ELO_HISTORY: Record<DashboardModelId, number[]> = ${toTs(eloHistory)}

export const PUZZLES: DashboardPuzzleItem[] = ${toTs(puzzles)}

export const META = ${toTs({
  puzzleCount: attemptedItems.length,
  datasetSize: allItems.length,
  evaluations: totalRows,
  lastUpdated: latestCreatedAt.slice(0, 10),
  version: "0.8.0",
  benchmarkId,
  sourceFiles,
  rowsByModel: Object.fromEntries(
    models.map((model) => [model.id, rowsByModel.get(model.id)?.length ?? 0])
  ),
  maxOutputTokens: "uncapped",
})}
`

await writeFile(outputPath, contents)
console.log(`Wrote dashboard data to ${outputPath}`)

/* ------------------------------------------------------------------ *
 * Series palette
 *
 * Brand hexes are authored per model above and are only guaranteed to be
 * correct, not legible: xAI ships a near-black, Google and DeepSeek ship two
 * blues 3 degrees apart. Rendering them unchanged puts an invisible line on the
 * dark card (#111827 measures 1.0:1 there) and two indistinguishable series on
 * both. The palette below is therefore derived, not copied, and the derivation
 * lives in the generator so a model added tomorrow gets the same treatment
 * without anyone remembering to update an override map in the UI.
 * ------------------------------------------------------------------ */

function buildSeriesPalette(brands: string[]): SeriesColors[] {
  const source = brands.map((hex) => rgbToOklch(hexToRgb(hex)))
  const hues = separateHues(source)

  return source.map((base, index) => {
    const neutral = base.c < ACHROMATIC_CHROMA
    const target = neutral ? NEUTRAL_SERIES_MIN_CONTRAST : SERIES_MIN_CONTRAST
    const seed: Oklch = { ...base, h: hues[index] ?? base.h }

    return {
      color: rgbToHex(fitContrast(seed, LIGHT_SURFACE, target)),
      colorDark: rgbToHex(fitContrast(seed, DARK_SURFACE, target)),
    }
  })
}

/**
 * A series keeps its brand hue unless an earlier series already occupies it.
 * When it has to move it takes the smallest rotation that clears every earlier
 * series and, where one exists, every later brand hue as well, so resolving one
 * collision does not shunt the next series out of its own brand.
 */
function separateHues(source: Oklch[]): Array<number | null> {
  const brandHues = source.map((color) =>
    color.c < ACHROMATIC_CHROMA ? null : color.h
  )
  const resolved: Array<number | null> = []

  for (const [index, own] of brandHues.entries()) {
    if (own == null) {
      resolved.push(null)
      continue
    }

    const earlier = resolved.filter((hue): hue is number => hue != null)
    const later = brandHues
      .slice(index + 1)
      .filter((hue): hue is number => hue != null)
    const clears = (hue: number, others: number[]) =>
      others.every((other) => hueDistance(hue, other) >= MIN_HUE_SEPARATION)

    if (clears(own, earlier)) {
      resolved.push(own)
      continue
    }

    let best: number | null = null
    let fallback: number | null = null

    for (let step = 1; step <= 180 && best == null; step += 1) {
      for (const direction of [-1, 1]) {
        const candidate = (own + direction * step + 360) % 360

        if (!clears(candidate, earlier)) {
          continue
        }

        fallback ??= candidate

        if (clears(candidate, later)) {
          best = candidate
          break
        }
      }
    }

    resolved.push(best ?? fallback ?? own)
  }

  return resolved
}

/** Moves lightness away from the surface until the contrast target is met. */
function fitContrast(color: Oklch, surface: Oklch, target: number): Rgb {
  const backdrop = oklchToRgb(surface)
  const step = surface.l > 0.5 ? -0.005 : 0.005
  let lightness = color.l

  for (let i = 0; i <= 220; i += 1) {
    const candidate = clampToGamut({ ...color, l: lightness })

    if (contrastRatio(candidate, backdrop) >= target) {
      return candidate
    }

    lightness += step

    if (lightness < 0 || lightness > 1) {
      break
    }
  }

  return clampToGamut({ ...color, l: Math.min(1, Math.max(0, lightness)) })
}

function hueDistance(a: number, b: number) {
  const delta = Math.abs(a - b) % 360
  return delta > 180 ? 360 - delta : delta
}

function srgbToLinear(value: number) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function linearToSrgb(value: number) {
  return value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055
}

function hexToRgb(hex: string): Rgb {
  const digits = hex.replace("#", "")
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((digit) => digit + digit)
          .join("")
      : digits

  return {
    r: Number.parseInt(full.slice(0, 2), 16) / 255,
    g: Number.parseInt(full.slice(2, 4), 16) / 255,
    b: Number.parseInt(full.slice(4, 6), 16) / 255,
  }
}

function rgbToHex({ r, g, b }: Rgb) {
  const channel = (value: number) =>
    Math.round(Math.min(1, Math.max(0, value)) * 255)
      .toString(16)
      .padStart(2, "0")

  return `#${channel(r)}${channel(g)}${channel(b)}`
}

function rgbToOklch({ r, g, b }: Rgb): Oklch {
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)
  const long = Math.cbrt(
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  )
  const medium = Math.cbrt(
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  )
  const short = Math.cbrt(
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb
  )
  const lightness =
    0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short
  const greenRed =
    1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short
  const blueYellow =
    0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short
  const chroma = Math.hypot(greenRed, blueYellow)

  return {
    l: lightness,
    c: chroma,
    h:
      chroma < 1e-6
        ? 0
        : ((Math.atan2(blueYellow, greenRed) * 180) / Math.PI + 360) % 360,
  }
}

function oklchToRgb({ l, c, h }: Oklch): Rgb {
  const radians = (h * Math.PI) / 180
  const greenRed = c * Math.cos(radians)
  const blueYellow = c * Math.sin(radians)
  const long = (l + 0.3963377774 * greenRed + 0.2158037573 * blueYellow) ** 3
  const medium = (l - 0.1055613458 * greenRed - 0.0638541728 * blueYellow) ** 3
  const short = (l - 0.0894841775 * greenRed - 1.291485548 * blueYellow) ** 3

  return {
    r: linearToSrgb(
      4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short
    ),
    g: linearToSrgb(
      -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short
    ),
    b: linearToSrgb(
      -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short
    ),
  }
}

function inGamut({ r, g, b }: Rgb) {
  return [r, g, b].every((value) => value >= -1e-4 && value <= 1 + 1e-4)
}

/** Bisects chroma down until the color is representable in sRGB. */
function clampToGamut(color: Oklch): Rgb {
  if (inGamut(oklchToRgb(color))) {
    return oklchToRgb(color)
  }

  let low = 0
  let high = color.c

  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2

    if (inGamut(oklchToRgb({ ...color, c: mid }))) {
      low = mid
    } else {
      high = mid
    }
  }

  return oklchToRgb({ ...color, c: low })
}

function relativeLuminance({ r, g, b }: Rgb) {
  const channel = (value: number) =>
    srgbToLinear(Math.min(1, Math.max(0, value)))

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrastRatio(a: Rgb, b: Rgb) {
  const first = relativeLuminance(a)
  const second = relativeLuminance(b)

  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

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
    n: count,
    accuracy: round(accuracy, 3),
    elo: estimateElo(avgRating, accuracy),
    cost: round(count === 0 ? 0 : (totalCost / count) * 1000, 2),
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

function buildCategoryScores(
  rows: ResultRow[],
  itemLookup: Map<string, LichessPuzzleBenchmarkItem>
): Record<CategoryId, CategoryScore> {
  return Object.fromEntries(
    categories.map((category) => {
      const categoryRows = rows.filter((row) => {
        const item = itemLookup.get(row.item_id)
        return item ? category.matches(item) : false
      })

      // An empty bucket is an absence of measurement, never a stand-in score.
      if (categoryRows.length === 0) {
        return [category.id, { accuracy: null, n: 0 }]
      }

      return [
        category.id,
        {
          accuracy: round(
            categoryRows.filter((row) => row.solved === "true").length /
              categoryRows.length,
            3
          ),
          n: categoryRows.length,
        },
      ]
    })
  ) as Record<CategoryId, CategoryScore>
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
