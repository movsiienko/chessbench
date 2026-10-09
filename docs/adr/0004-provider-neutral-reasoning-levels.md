# Reasoning levels are provider-neutral and mapped by the AI SDK

Results are keyed by the requested reasoning level, sent as the AI SDK's `reasoning` option, and each provider maps it to its own control. We first keyed results by the setting each provider received, through our own per-lab table of provider options. That table silently failed for two labs: Anthropic's effort and DeepSeek's reasoning effort went out under keys the SDK drops, so Claude ran at its default `high` effort while recorded as `low`. Migration 0003 relabels those results with what actually ran.

## Consequences

- On effort-based models (Claude Opus 4.6+, GPT-5, Grok, Gemini 3) a level is a soft effort setting, not a token budget; `max_tokens` would truncate the answer rather than shorten thinking, so we leave it at the provider default. On budget-based models the SDK budgets a share of max output tokens.
- Two levels a provider collapses to one setting, such as xAI's `medium` and `low`, are separate entries and can be paid for twice. The SDK's mapping warning is recorded on each turn, so such collapses are visible.
