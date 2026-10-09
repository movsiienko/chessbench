import { generateText, type LanguageModelUsage } from "ai"
import { z } from "zod"
import type { GenerateBenchmarkText } from "./local-runner"
import { providerOptionsFor, type ReasoningEffort } from "./models"

/**
 * The AI SDK adapter for one model call. String model ids resolve through the
 * AI SDK's default provider: the Gateway in production, a scripted provider
 * in tests.
 */
export function createGenerate({
  reasoningEffort,
  maxOutputTokens,
  gatewayTags,
}: {
  reasoningEffort: ReasoningEffort
  maxOutputTokens: number | null
  gatewayTags: string[] | null
}): GenerateBenchmarkText {
  return async ({ model, messages, abortSignal }) => {
    const startedAt = performance.now()
    const providerOptions = providerOptionsFor(
      model,
      reasoningEffort,
      gatewayTags
    )
    const result = await generateText({
      model,
      messages,
      abortSignal,
      maxOutputTokens: maxOutputTokens ?? undefined,
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
