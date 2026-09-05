import { randomUUID } from "node:crypto"
import { appendFile, mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { generateText, type LanguageModelUsage } from "ai"
import { z } from "zod"
import { ATTEMPT_CSV_HEADER, serializeAttemptRow } from "@/lib/benchmarks/csv"
import {
  loadItems,
  selectDefaultLichessPuzzleItems,
} from "@/lib/benchmarks/lichess-puzzles"
import {
  runLichessPuzzleAttempt,
  type BenchmarkMessage,
  type LichessPuzzleAttemptRow,
} from "@/lib/benchmarks/local-runner"
import {
  isReasoningEffort,
  providerOptionsFor,
  reasoningEffortForModel,
  type ReasoningEffort,
} from "@/lib/benchmarks/models"

type CliOptions = {
  models: string[]
  limit: number
  all: boolean
  canonical: string | null
  reasoningEffort: ReasoningEffort
  maxOutputTokens: number | null
  gatewaySystemCredentials: boolean
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
const localPath = join(localResultsDir, `${runId}.csv`)
const canonicalStartedModels = new Set<string>()
const totalAttempts = options.models.length * selectedItems.length
let completedAttempts = 0

for (const model of options.models) {
  for (const item of selectedItems) {
    const row: LichessPuzzleAttemptRow = {
      ...(await runLichessPuzzleAttempt({
        runId,
        model,
        item,
        generate: generateWithAiSdk,
      })),
      reasoningEffort: reasoningEffortForModel(model, options.reasoningEffort),
      maxOutputTokens: options.maxOutputTokens,
    }

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
  const providerOptions = providerOptionsFor(
    model,
    options.reasoningEffort,
    options.gatewaySystemCredentials
      ? [`benchmark:${benchmarkId}`, `run:${runId}`]
      : null
  )
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
    ...(includeHeader ? [ATTEMPT_CSV_HEADER] : []),
    serializeAttemptRow(row),
  ].join("\n")
  const payload = `${contents}\n`

  if (append) {
    await appendFile(path, payload)
  } else {
    await writeFile(path, payload)
  }
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
