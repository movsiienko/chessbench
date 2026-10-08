import { randomUUID } from "node:crypto"
import { appendFile, mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { generateText, type LanguageModel, type LanguageModelUsage } from "ai"
import { z } from "zod"
import { ATTEMPT_CSV_HEADER, serializeAttemptRow } from "./csv"
import { loadItems, selectDefaultLichessPuzzleItems } from "./lichess-puzzles"
import {
  runLichessPuzzleAttempt,
  type GenerateBenchmarkText,
  type LichessPuzzleAttemptRow,
} from "./local-runner"
import {
  providerOptionsFor,
  reasoningEffortForModel,
  type ReasoningEffort,
} from "./models"

export type BenchmarkRunOptions = {
  models: string[]
  limit: number
  all: boolean
  canonical: string | null
  reasoningEffort: ReasoningEffort
  maxOutputTokens: number | null
  gatewaySystemCredentials: boolean
  /** Dataset and results root; defaults to the workspace data directory. */
  dataDirectory?: string
}

type BenchmarkRunDependencies = {
  /** The SDK's model seam: Gateway ids in production, local models in tests. */
  resolveModel?: (id: string) => LanguageModel
  onProgress?: (progress: {
    row: LichessPuzzleAttemptRow
    completed: number
    total: number
  }) => void | Promise<void>
}

/** Owns one invocation, from dataset selection through incremental archival. */
export async function runLichessPuzzleBenchmark(
  options: BenchmarkRunOptions,
  { resolveModel = (id) => id, onProgress }: BenchmarkRunDependencies = {}
) {
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
  if (options.canonical) {
    const modelsByFilename = new Map<string, string>()
    for (const model of options.models) {
      const filename = sanitizeModelId(model)
      const previous = modelsByFilename.get(filename)
      if (previous !== undefined && previous !== model) {
        throw new Error(
          `Models "${previous}" and "${model}" share canonical filename "${filename}-${options.canonical}.csv"`
        )
      }
      modelsByFilename.set(filename, model)
    }
  }
  if (!Number.isInteger(options.limit) || options.limit < 1) {
    throw new Error("--limit must be a positive integer")
  }
  if (
    options.maxOutputTokens !== null &&
    (!Number.isInteger(options.maxOutputTokens) || options.maxOutputTokens < 1)
  ) {
    throw new Error("--max-output-tokens must be a positive integer")
  }

  const benchmarkId = "lichess-puzzles-v1"
  const dataDirectory = options.dataDirectory ?? "data"
  const runId = createRunId()
  const items = await loadItems(
    join(dataDirectory, "benchmarks", benchmarkId, "items.jsonl")
  )
  const selectedItems = options.all
    ? items
    : selectDefaultLichessPuzzleItems(items, options.limit)
  const localPath = join(
    dataDirectory,
    "results/local",
    benchmarkId,
    `${runId}.csv`
  )
  const canonicalStartedModels = new Set<string>()
  const total = options.models.length * selectedItems.length
  let completed = 0

  const generate: GenerateBenchmarkText = async ({ model, messages }) => {
    const startedAt = performance.now()
    const providerOptions = providerOptionsFor(
      model,
      options.reasoningEffort,
      options.gatewaySystemCredentials
        ? [`benchmark:${benchmarkId}`, `run:${runId}`]
        : null
    )
    const result = await generateText({
      model: resolveModel(model),
      messages,
      maxOutputTokens: options.maxOutputTokens ?? undefined,
      providerOptions: Object.keys(providerOptions).length
        ? providerOptions
        : undefined,
    })
    const gateway = gatewayMetadataSchema.parse(
      result.providerMetadata?.gateway
    )
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

  for (const model of options.models) {
    for (const item of selectedItems) {
      const row: LichessPuzzleAttemptRow = {
        ...(await runLichessPuzzleAttempt({ runId, model, item, generate })),
        reasoningEffort: reasoningEffortForModel(
          model,
          options.reasoningEffort
        ),
        maxOutputTokens: options.maxOutputTokens,
      }
      await writeCsvRow(localPath, row, completed > 0)
      if (options.canonical) {
        const canonicalPath = join(
          dataDirectory,
          "results/canonical",
          benchmarkId,
          `${sanitizeModelId(model)}-${options.canonical}.csv`
        )
        await writeCsvRow(canonicalPath, row, canonicalStartedModels.has(model))
        canonicalStartedModels.add(model)
      }
      completed += 1
      await onProgress?.({ row, completed, total })
    }
  }
  return { runId, localPath, attemptCount: completed }
}

async function writeCsvRow(
  path: string,
  row: LichessPuzzleAttemptRow,
  append: boolean
) {
  await mkdir(dirname(path), { recursive: true })
  const contents = `${append ? "" : `${ATTEMPT_CSV_HEADER}\n`}${serializeAttemptRow(row)}\n`
  if (append) await appendFile(path, contents)
  else await writeFile(path, contents)
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
