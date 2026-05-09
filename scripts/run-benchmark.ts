import { randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { generateText, type ModelMessage } from "ai"
import {
  selectDefaultLichessPuzzleItems,
  type LichessPuzzleBenchmarkItem,
} from "@/lib/benchmarks/lichess-puzzles"
import {
  runLichessPuzzleAttempt,
  type BenchmarkMessage,
  type LichessPuzzleAttemptRow,
} from "@/lib/benchmarks/local-runner"

type CliOptions = {
  models: string[]
  limit: number
  all: boolean
  canonical: string | null
}

const benchmarkId = "lichess-puzzles-v1"
const itemsPath = `data/benchmarks/${benchmarkId}/items.jsonl`
const localResultsDir = `data/results/local/${benchmarkId}`
const canonicalResultsDir = `data/results/canonical/${benchmarkId}`

const options = parseArgs(process.argv.slice(2))

if (options.models.length === 0) {
  throw new Error(
    "At least one --model is required, for example: --model openai/gpt-5-nano"
  )
}

if (options.canonical && !/^[a-z0-9][a-z0-9-]*$/.test(options.canonical)) {
  throw new Error(
    "--canonical must be a lowercase filename stem using letters, numbers, and hyphens"
  )
}

const runId = createRunId()
const items = await loadItems(itemsPath)
const selectedItems = options.all
  ? items
  : selectDefaultLichessPuzzleItems(items, options.limit)
const rows: LichessPuzzleAttemptRow[] = []

for (const model of options.models) {
  for (const item of selectedItems) {
    rows.push(
      await runLichessPuzzleAttempt({
        runId,
        model,
        item,
        generate: generateWithAiSdk,
      })
    )
  }
}

const localPath = join(localResultsDir, `${runId}.csv`)
await writeCsv(localPath, rows)

if (options.canonical) {
  for (const model of options.models) {
    const modelRows = rows.filter((row) => row.model === model)
    const canonicalPath = join(
      canonicalResultsDir,
      `${sanitizeModelId(model)}-${options.canonical}.csv`
    )
    await writeCsv(canonicalPath, modelRows)
  }
}

console.log(`Wrote ${rows.length} rows to ${localPath}`)

async function generateWithAiSdk({
  model,
  messages,
}: {
  model: string
  messages: BenchmarkMessage[]
}) {
  const startedAt = performance.now()
  const result = await generateText({
    model,
    messages: messages as ModelMessage[],
  })

  return {
    text: result.text,
    latencyMs: Math.round(performance.now() - startedAt),
    usage: {
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.totalTokens,
    },
  }
}

async function loadItems(path: string): Promise<LichessPuzzleBenchmarkItem[]> {
  const contents = await readFile(path, "utf8")

  return contents
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LichessPuzzleBenchmarkItem)
}

function parseArgs(args: string[]): CliOptions {
  const models: string[] = []
  let limit = 10
  let all = false
  let canonical: string | null = null

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === "--model") {
      models.push(readArgValue(args, index, "--model"))
      index += 1
      continue
    }

    if (arg === "--limit") {
      limit = Number(readArgValue(args, index, "--limit"))
      index += 1
      continue
    }

    if (arg === "--all") {
      all = true
      continue
    }

    if (arg === "--canonical") {
      canonical = readArgValue(args, index, "--canonical")
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("--limit must be a positive integer")
  }

  return {
    models,
    limit,
    all,
    canonical,
  }
}

function readArgValue(args: string[], index: number, name: string): string {
  const value = args[index + 1]

  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`)
  }

  return value
}

async function writeCsv(path: string, rows: LichessPuzzleAttemptRow[]) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, serializeRows(rows))
}

function serializeRows(rows: LichessPuzzleAttemptRow[]): string {
  const headers = [
    "run_id",
    "created_at",
    "benchmark",
    "prompt_template_id",
    "model",
    "item_id",
    "lichess_puzzle_id",
    "rating",
    "rating_band",
    "rating_bucket",
    "primary_theme",
    "status",
    "solved",
    "first_move_correct",
    "exact_player_line",
    "player_move_prefix_score",
    "expected_full_line",
    "expected_player_line",
    "submitted_player_moves",
    "revealed_opponent_moves",
    "invalid_turn_index",
    "error_message",
    "latency_ms_total",
    "input_tokens",
    "output_tokens",
    "total_tokens",
    "turns_json",
  ]

  return [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.runId,
        row.createdAt,
        row.benchmark,
        row.promptTemplateId,
        row.model,
        row.itemId,
        row.lichessPuzzleId,
        row.rating,
        row.ratingBand,
        row.ratingBucket,
        row.primaryTheme,
        row.status,
        row.solved,
        row.firstMoveCorrect,
        row.exactPlayerLine,
        row.playerMovePrefixScore,
        JSON.stringify(row.expectedFullLine),
        JSON.stringify(row.expectedPlayerLine),
        JSON.stringify(row.submittedPlayerMoves),
        JSON.stringify(row.revealedOpponentMoves),
        row.invalidTurnIndex ?? "",
        row.errorMessage,
        row.latencyMsTotal,
        row.inputTokens ?? "",
        row.outputTokens ?? "",
        row.totalTokens ?? "",
        JSON.stringify(row.turns),
      ]
        .map((value) => escapeCsv(value))
        .join(",")
    ),
  ].join("\n")
}

function escapeCsv(value: unknown): string {
  const text = String(value)

  if (!/[",\n\r]/.test(text)) {
    return text
  }

  return `"${text.replaceAll('"', '""')}"`
}

function createRunId(): string {
  const timestamp = new Date()
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "Z")
  const suffix = randomUUID().slice(0, 8)

  return `${timestamp}-${suffix}`
}

function sanitizeModelId(model: string): string {
  return model
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
