import type { ProviderOptions } from "@ai-sdk/provider-utils"

/**
 * The one place a benchmarked model is declared, keyed by Gateway ID. It is the
 * allowlist of models a benchmark run may request and the display metadata for
 * their scoreboard entries; the lab is the ID's prefix.
 *
 * `color`/`colorDark` are chart series colors fitted to the light and dark
 * `--card` surfaces (3.5:1 minimum, WCAG 1.4.11), not raw brand hexes: xAI
 * ships a near-black and Google/DeepSeek two blues 3 degrees apart. Pick a new
 * model's pair by hand with a contrast checker.
 */
export const MODELS = [
  {
    id: "openai/gpt-5.5",
    name: "GPT 5.5",
    vendor: "OpenAI",
    color: "#009b78",
    colorDark: "#10a37f",
  },
  {
    id: "anthropic/claude-opus-4.8",
    name: "Claude Opus 4.8",
    vendor: "Anthropic",
    color: "#cf6e4e",
    colorDark: "#d97757",
  },
  {
    id: "google/gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    vendor: "Google",
    color: "#4285f4",
    colorDark: "#4285f4",
  },
  {
    id: "deepseek/deepseek-v3.2-thinking",
    name: "DeepSeek V3.2 Thinking",
    vendor: "DeepSeek",
    color: "#007d98",
    colorDark: "#007d98",
  },
  {
    id: "xai/grok-4.1-fast-reasoning",
    name: "Grok 4.1 Fast Reasoning",
    vendor: "xAI",
    color: "#111827",
    colorDark: "#a4aec3",
  },
  {
    id: "alibaba/qwen3-max-thinking",
    name: "Qwen3 Max Thinking",
    vendor: "Alibaba",
    color: "#9a56ed",
    colorDark: "#9a56ed",
  },
] as const

export type ModelId = (typeof MODELS)[number]["id"]
export type LabId = ModelId extends `${infer Lab}/${string}` ? Lab : never

export function labOf(model: ModelId): LabId {
  // SAFETY: every registry ID is `<lab>/<name>`, which is what LabId extracts.
  return model.split("/")[0] as LabId
}

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

// Each lab's effort scale, indexed by our minimal..xhigh ladder.
const EFFORT_LADDER: ActiveReasoningEffort[] = [
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
]
const LAB_EFFORTS = {
  xai: ["low", "low", "low", "high", "high"],
  anthropic: ["low", "low", "medium", "high", "max"],
  google: ["low", "low", "medium", "high", "high"],
} as const

function labEffort<L extends keyof typeof LAB_EFFORTS>(
  lab: L,
  effort: ActiveReasoningEffort
): (typeof LAB_EFFORTS)[L][number] {
  return LAB_EFFORTS[lab][EFFORT_LADDER.indexOf(effort)]
}

function reasoningEffortForXai(effort: ActiveReasoningEffort | null) {
  return effort && labEffort("xai", effort)
}

function reasoningEffortForAnthropic(effort: ActiveReasoningEffort) {
  return labEffort("anthropic", effort)
}

function reasoningEffortForGoogle(effort: ActiveReasoningEffort) {
  return labEffort("google", effort)
}

function reasoningEffortForDeepSeek(effort: ReasoningEffort): string {
  if (effort === "none") {
    return "none"
  }

  return effort === "xhigh" ? "max" : "high"
}
