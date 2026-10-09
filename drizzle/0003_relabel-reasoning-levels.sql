-- Results recorded before the AI SDK's provider-neutral `reasoning` option
-- carry the level we asked for, not the one the provider received: the
-- Anthropic effort and the DeepSeek reasoning effort were sent under keys the
-- SDK dropped, Qwen got no reasoning option at all, and Grok was labelled
-- "model-thinking" although xAI received `low`. Relabel each entry with what
-- actually ran: Claude Opus 4.8 ran at the API default effort (`high`).
UPDATE "attempts"
SET "reasoning_level" = 'high',
  "record" = jsonb_set("record", '{reasoningEffort}', '"high"')
WHERE "model" = 'anthropic/claude-opus-4.8' AND "reasoning_level" = 'low';
--> statement-breakpoint
UPDATE "attempts"
SET "reasoning_level" = 'provider-default',
  "record" = jsonb_set("record", '{reasoningEffort}', '"provider-default"')
WHERE ("model" = 'deepseek/deepseek-v3.2-thinking' AND "reasoning_level" = 'high')
  OR ("model" = 'alibaba/qwen3-max-thinking' AND "reasoning_level" = 'model-thinking');
--> statement-breakpoint
UPDATE "attempts"
SET "reasoning_level" = 'low',
  "record" = jsonb_set("record", '{reasoningEffort}', '"low"')
WHERE "model" = 'xai/grok-4.1-fast-reasoning' AND "reasoning_level" = 'model-thinking';
