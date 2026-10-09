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

/**
 * Provider-neutral reasoning levels, sent as the AI SDK's `reasoning` option.
 * Each provider maps a level to its own control: an effort setting on
 * effort-based models, a share of max output tokens on budget-based ones.
 * `provider-default` sends nothing and leaves the provider's default.
 */
export const REASONING_LEVELS = [
  "provider-default",
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const
export type ReasoningLevel = (typeof REASONING_LEVELS)[number]
