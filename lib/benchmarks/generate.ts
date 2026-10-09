import { generateText, type LanguageModelUsage } from "ai"
import { z } from "zod"
import type { GenerateBenchmarkText } from "./local-runner"
import type { ReasoningLevel } from "./models"

/**
 * The AI SDK adapter for one model call. String model ids resolve through the
 * AI SDK's default provider: the Gateway in production, a scripted provider
 * in tests.
 */
export function createGenerate({
  reasoning,
  maxOutputTokens,
  gatewayTags,
}: {
  reasoning: ReasoningLevel
  maxOutputTokens: number | null
  /**
   * Non-null runs on Gateway system credentials: the empty request-scoped
   * BYOK overrides cached BYOK so Gateway falls back to system keys.
   */
  gatewayTags: string[] | null
}): GenerateBenchmarkText {
  return async ({ model, messages, abortSignal }) => {
    const startedAt = performance.now()
    const result = await generateText({
      model,
      messages,
      abortSignal,
      // The workflow retries a failed turn as a whole; SDK retries would
      // multiply paid calls and hide time inside the move time limit.
      maxRetries: 0,
      reasoning,
      maxOutputTokens: maxOutputTokens ?? undefined,
      providerOptions: gatewayTags
        ? { gateway: { byok: {}, tags: gatewayTags } }
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
      // How each provider honored the request, such as a reasoning level
      // mapped to a different provider setting.
      warnings: result.warnings?.map((warning) => JSON.stringify(warning)),
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
    raw?.output_tokens_details?.reasoning_tokens ??
    raw?.output_tokens_details?.thinking_tokens ??
    raw?.completion_tokens_details?.reasoning_tokens ??
    raw?.thoughtsTokenCount
  )
}
