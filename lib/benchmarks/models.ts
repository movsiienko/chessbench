import type { ProviderOptions } from "@ai-sdk/provider-utils"

/**
 * The one place a benchmarked model is declared. The build derives
 * `DashboardModelId` from `id`, reads results from `file`, and the dashboard
 * gets `name`/`vendor`/`releaseQ` through the generated data file.
 */
export const MODELS = [
  {
    id: "gpt5",
    apiModel: "openai/gpt-5.5",
    file: "openai-gpt-5-5-single-move-v3-effort-only-20260605.csv",
    name: "GPT 5.5",
    vendor: "OpenAI",
    /** Brand hex, exactly as the lab publishes it. Never rendered unchanged. */
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
] as const

export type ModelId = (typeof MODELS)[number]["id"]

export const REASONING_EFFORTS = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
] as const
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number]
type ActiveReasoningEffort = Exclude<ReasoningEffort, "none">

export function isReasoningEffort(value: string): value is ReasoningEffort {
  return REASONING_EFFORTS.some((effort) => effort === value)
}

/**
 * Per-lab provider options for a gateway model id. `gatewayTags` non-null
 * means "use Gateway system credentials": the empty request-scoped BYOK
 * overrides cached BYOK so Gateway falls back to system keys; it does not
 * enable user-supplied BYOK.
 */
export function providerOptionsFor(
  model: string,
  effort: ReasoningEffort,
  gatewayTags: string[] | null = null
): ProviderOptions {
  const providerOptions: ProviderOptions = {}
  const activeEffort = activeReasoningEffort(effort)

  if (activeEffort && model.startsWith("openai/")) {
    providerOptions.openai = { reasoningEffort: activeEffort }
  }

  if (activeEffort && model.startsWith("anthropic/")) {
    providerOptions.anthropic = {
      thinking: { type: "adaptive" },
      output_config: { effort: reasoningEffortForAnthropic(activeEffort) },
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
    providerOptions.deepseek =
      effort === "none"
        ? { thinking: { type: "disabled" } }
        : {
            thinking: { type: "enabled" },
            reasoning_effort: reasoningEffortForDeepSeek(effort),
          }
  }

  if (gatewayTags) {
    providerOptions.gateway = { byok: {}, tags: gatewayTags }
  }

  return providerOptions
}

/** The `reasoning_effort` string recorded in the results CSV. */
export function reasoningEffortForModel(
  model: string,
  effort: ReasoningEffort
): string {
  if (model.startsWith("deepseek/")) {
    return reasoningEffortForDeepSeek(effort)
  }

  const activeEffort = activeReasoningEffort(effort)

  if (!activeEffort) {
    return ""
  }

  if (/(?:^|[-.])thinking(?:$|-)|(?:^|[-.])reasoning(?:$|-)/.test(model)) {
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

  return model.startsWith("openai/") ? activeEffort : ""
}

function activeReasoningEffort(
  effort: ReasoningEffort
): ActiveReasoningEffort | null {
  return effort === "none" ? null : effort
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

  return effort === "high" || effort === "medium" ? effort : "low"
}

function reasoningEffortForGoogle(
  effort: ActiveReasoningEffort
): "low" | "medium" | "high" {
  if (effort === "high" || effort === "xhigh") {
    return "high"
  }

  return effort === "medium" ? "medium" : "low"
}

function reasoningEffortForDeepSeek(effort: ReasoningEffort): string {
  if (effort === "none") {
    return "none"
  }

  return effort === "xhigh" ? "max" : "high"
}
