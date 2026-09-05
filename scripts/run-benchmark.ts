import { randomUUID } from "node:crypto"
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { generateText, type LanguageModelUsage } from "ai"
import { z } from "zod"
import type { ProviderOptions } from "@ai-sdk/provider-utils"
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
  reasoningEffort: ReasoningEffort
  maxOutputTokens: number | null
  gatewaySystemCredentials: boolean
}

type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh"
type ActiveReasoningEffort = Exclude<ReasoningEffort, "none">

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
const localPath = join(localResultsDir, `${runId}.csv`)
const canonicalStartedModels = new Set<string>()
const totalAttempts = options.models.length * selectedItems.length
let completedAttempts = 0

for (const model of options.models) {
  for (const item of selectedItems) {
    const row = await runLichessPuzzleAttempt({
      runId,
      model,
      item,
      generate: generateWithAiSdk,
    })

    rows.push(row)
    completedAttempts += 1

    await writeCsvRow(localPath, row, {
      append: rows.length > 1,
      includeHeader: rows.length === 1,
    })
    await writeCanonicalCsvRow(row)

    console.log(
      [
        `[${completedAttempts}/${totalAttempts}]`,
        model,
        item.id,
        row.status,
        `solved=${row.solved}`,
        row.costUsd === null ? "" : `cost=${row.costUsd.toFixed(6)}`,
      ]
        .filter(Boolean)
        .join(" ")
    )
  }
}

console.log(`Wrote ${rows.length} rows to ${localPath}`)

async function writeCanonicalCsvRow(row: LichessPuzzleAttemptRow) {
  if (!options.canonical) {
    return
  }

  const canonicalPath = join(
    canonicalResultsDir,
    `${sanitizeModelId(row.model)}-${options.canonical}.csv`
  )
  const append = canonicalStartedModels.has(row.model)

  await writeCsvRow(canonicalPath, row, {
    append,
    includeHeader: !append,
  })
  canonicalStartedModels.add(row.model)
}

async function generateWithAiSdk({
  model,
  messages,
}: {
  model: string
  messages: BenchmarkMessage[]
}) {
  const startedAt = performance.now()
  const providerOptions = providerOptionsFor(model)
  const result = await generateText({
    model,
    messages,
    maxOutputTokens: options.maxOutputTokens ?? undefined,
    providerOptions: Object.keys(providerOptions).length
      ? providerOptions
      : undefined,
  })
  const gateway = gatewayMetadataSchema.parse(result.providerMetadata?.gateway)
  const usage = result.usage

  return {
    text: result.text,
    reasoningText: result.reasoningText,
    reasoning: result.reasoning,
    latencyMs: Math.round(performance.now() - startedAt),
    usage: {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      reasoningTokens: reasoningTokensFromUsage(usage),
      raw: usage.raw,
    },
    costUsd: gateway?.gatewayCost ?? gateway?.cost,
    generationId: gateway?.generationId,
    servedProvider: gateway?.routing?.finalProvider,
  }
}

async function loadItems(path: string): Promise<LichessPuzzleBenchmarkItem[]> {
  const contents = await readFile(path, "utf8")

  // SAFETY: items.jsonl is written by prepare-lichess-puzzles.ts as one LichessPuzzleBenchmarkItem per line.
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
  let reasoningEffort: ReasoningEffort = "low"
  let maxOutputTokens: number | null = null
  let gatewaySystemCredentials = false

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

    if (arg === "--reasoning-effort") {
      const value = readArgValue(args, index, "--reasoning-effort")
      if (!isReasoningEffort(value)) {
        throw new Error(
          "--reasoning-effort must be one of none, minimal, low, medium, high, or xhigh"
        )
      }
      reasoningEffort = value
      index += 1
      continue
    }

    if (arg === "--max-output-tokens") {
      maxOutputTokens = Number(readArgValue(args, index, "--max-output-tokens"))
      index += 1
      continue
    }

    if (arg === "--gateway-system-credentials") {
      gatewaySystemCredentials = true
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("--limit must be a positive integer")
  }

  if (
    maxOutputTokens !== null &&
    (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 1)
  ) {
    throw new Error("--max-output-tokens must be a positive integer")
  }

  return {
    models,
    limit,
    all,
    canonical,
    reasoningEffort,
    maxOutputTokens,
    gatewaySystemCredentials,
  }
}

function readArgValue(args: string[], index: number, name: string): string {
  const value = args[index + 1]

  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`)
  }

  return value
}

async function writeCsvRow(
  path: string,
  row: LichessPuzzleAttemptRow,
  {
    append,
    includeHeader,
  }: {
    append: boolean
    includeHeader: boolean
  }
) {
  await mkdir(dirname(path), { recursive: true })
  const contents = [
    ...(includeHeader ? [csvHeaders.join(",")] : []),
    serializeRow(row),
  ].join("\n")
  const payload = `${contents}\n`

  if (append) {
    await appendFile(path, payload)
  } else {
    await writeFile(path, payload)
  }
}

const csvHeaders = [
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
  "reasoning_effort",
  "max_output_tokens",
  "reasoning_tokens",
  "cost_usd",
  "served_provider",
  "generation_id",
  "turns_json",
]

function serializeRow(row: LichessPuzzleAttemptRow): string {
  return [
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
    reasoningEffortForModel(row.model),
    options.maxOutputTokens ?? "",
    row.reasoningTokens ?? "",
    row.costUsd ?? "",
    row.servedProvider,
    row.generationId,
    JSON.stringify(row.turns),
  ]
    .map((value) => escapeCsv(value))
    .join(",")
}

function providerOptionsFor(model: string): ProviderOptions {
  const providerOptions: ProviderOptions = {}
  const activeEffort = activeReasoningEffort(options.reasoningEffort)

  if (activeEffort && model.startsWith("openai/")) {
    providerOptions.openai = { reasoningEffort: activeEffort }
  }

  if (activeEffort && model.startsWith("anthropic/")) {
    providerOptions.anthropic = {
      thinking: {
        type: "adaptive",
      },
      output_config: {
        effort: reasoningEffortForAnthropic(activeEffort),
      },
    }
  }

  if (activeEffort && model.startsWith("google/")) {
    providerOptions.google = {
      thinkingConfig: {
        thinkingLevel: reasoningEffortForGoogle(activeEffort),
        includeThoughts: true,
      },
    }
  }

  const xaiReasoningEffort = reasoningEffortForXai(activeEffort)
  if (xaiReasoningEffort && model.startsWith("xai/")) {
    providerOptions.xai = { reasoningEffort: xaiReasoningEffort }
  }

  if (model.startsWith("deepseek/")) {
    providerOptions.deepseek = providerOptionsForDeepSeek(
      options.reasoningEffort
    )
  }

  if (options.gatewaySystemCredentials) {
    providerOptions.gateway = {
      // Empty request-scoped BYOK overrides cached BYOK so Gateway falls back
      // to system credentials; this is not enabling user-supplied BYOK keys.
      byok: {},
      tags: [`benchmark:${benchmarkId}`, `run:${runId}`],
    }
  }

  return providerOptions
}

function reasoningEffortForModel(model: string): string {
  if (model.startsWith("deepseek/")) {
    return reasoningEffortForDeepSeek(options.reasoningEffort)
  }

  const activeEffort = activeReasoningEffort(options.reasoningEffort)

  if (!activeEffort) {
    return ""
  }

  if (modelIdImpliesThinking(model)) {
    return "model-thinking"
  }

  if (model.startsWith("anthropic/")) {
    return reasoningEffortForAnthropic(activeEffort)
  }

  if (model.startsWith("google/")) {
    return reasoningEffortForGoogle(activeEffort)
  }

  if (model.startsWith("xai/")) {
    return reasoningEffortForXai(activeEffort) ?? ""
  }

  if (!model.startsWith("openai/")) {
    return ""
  }

  return activeEffort
}

function activeReasoningEffort(
  effort: ReasoningEffort
): ActiveReasoningEffort | null {
  if (effort === "none") {
    return null
  }

  return effort
}

function reasoningEffortForXai(
  effort: ActiveReasoningEffort | null
): "low" | "high" | null {
  if (!effort) {
    return null
  }

  return effort === "high" || effort === "xhigh" ? "high" : "low"
}

function reasoningEffortForAnthropic(
  effort: ActiveReasoningEffort
): "low" | "medium" | "high" | "max" {
  if (effort === "xhigh") {
    return "max"
  }

  if (effort === "high") {
    return "high"
  }

  if (effort === "medium") {
    return "medium"
  }

  return "low"
}

function reasoningEffortForGoogle(
  effort: ActiveReasoningEffort
): "low" | "medium" | "high" {
  if (effort === "high" || effort === "xhigh") {
    return "high"
  }

  if (effort === "medium") {
    return "medium"
  }

  return "low"
}

function providerOptionsForDeepSeek(effort: ReasoningEffort) {
  if (effort === "none") {
    return { thinking: { type: "disabled" } }
  }

  return {
    thinking: { type: "enabled" },
    reasoning_effort: effort === "xhigh" ? "max" : "high",
  }
}

function reasoningEffortForDeepSeek(effort: ReasoningEffort | null): string {
  if (!effort || effort === "none") {
    return "none"
  }

  return effort === "xhigh" ? "max" : "high"
}

function modelIdImpliesThinking(model: string): boolean {
  return /(?:^|[-.])thinking(?:$|-)|(?:^|[-.])reasoning(?:$|-)/.test(model)
}

function isReasoningEffort(value: string): value is ReasoningEffort {
  return ["none", "minimal", "low", "medium", "high", "xhigh"].includes(value)
}

/**
 * Provider metadata is best-effort and differs per provider, so every field is
 * read leniently: missing or oddly typed values become undefined instead of
 * failing a paid benchmark run.
 */
function lenient<T extends z.ZodType>(schema: T) {
  return schema.optional().catch(undefined)
}

const numeric = lenient(
  z.union([z.number(), z.string().pipe(z.coerce.number())])
)
const text = lenient(z.string())

const gatewayMetadataSchema = lenient(
  z.object({
    gatewayCost: numeric,
    cost: numeric,
    generationId: text,
    routing: lenient(z.object({ finalProvider: text })),
  })
)

const rawUsageSchema = lenient(
  z.object({
    output_tokens_details: lenient(
      z.object({ reasoning_tokens: numeric, thinking_tokens: numeric })
    ),
    completion_tokens_details: lenient(z.object({ reasoning_tokens: numeric })),
    thoughtsTokenCount: numeric,
  })
)

function reasoningTokensFromUsage(usage: LanguageModelUsage) {
  const raw = rawUsageSchema.parse(usage.raw)

  return (
    usage.outputTokenDetails?.reasoningTokens ??
    usage.reasoningTokens ??
    raw?.output_tokens_details?.reasoning_tokens ??
    raw?.output_tokens_details?.thinking_tokens ??
    raw?.completion_tokens_details?.reasoning_tokens ??
    raw?.thoughtsTokenCount
  )
}

function escapeCsv(value: string | number | boolean | null): string {
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
