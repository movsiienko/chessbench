-- Before the AI SDK's provider-neutral `reasoning` option, results carried the
-- level we asked for, not what the provider received: Anthropic's effort and
-- DeepSeek's reasoning effort went out under keys the SDK dropped, Alibaba got
-- no reasoning option at all, `none` sent nothing to OpenAI, Google, xAI and
-- Alibaba, and xAI results were labelled "model-thinking". Relabel every
-- result with what ran, using the run's request where the label lost it (the
-- imported Grok set was run at `low`). See docs/adr/0004.
CREATE TEMP TABLE "relabel" AS
SELECT a."id",
  CASE
    WHEN a."model" LIKE 'anthropic/%' THEN
      -- No thinking parameter without an effort; otherwise the API default.
      CASE WHEN a."reasoning_level" = 'none' THEN 'none' ELSE 'high' END
    WHEN a."model" LIKE 'deepseek/%' THEN
      -- Thinking was disabled correctly; the effort was dropped.
      CASE WHEN a."reasoning_level" = 'none' THEN 'none' ELSE 'provider-default' END
    WHEN a."model" LIKE 'alibaba/%' THEN 'provider-default'
    WHEN a."model" LIKE 'xai/%' THEN
      CASE
        WHEN a."reasoning_level" = 'none' THEN 'provider-default'
        WHEN r."request"->>'reasoningEffort' IN ('high', 'xhigh') THEN 'high'
        ELSE 'low'
      END
    WHEN a."reasoning_level" = 'none' THEN 'provider-default'
    ELSE a."reasoning_level"
  END AS "level"
FROM "attempts" a
LEFT JOIN "runs" r ON r."id" = a."run_id";
--> statement-breakpoint
-- Each item contributes one finished attempt per entry. Where two results
-- now share an entry and item, keep the earliest.
DELETE FROM "attempts"
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT a."id", row_number() OVER (
      PARTITION BY a."benchmark", a."protocol", a."model", x."level", a."item_id"
      ORDER BY a."created_at", a."id"
    ) AS "n"
    FROM "attempts" a
    JOIN "relabel" x ON x."id" = a."id"
    WHERE a."status" <> 'error'
  ) ranked
  WHERE ranked."n" > 1
);
--> statement-breakpoint
UPDATE "attempts" a
SET "reasoning_level" = x."level"
FROM "relabel" x
WHERE x."id" = a."id" AND a."reasoning_level" <> x."level";
--> statement-breakpoint
-- The record names the field for the level, not the provider control.
UPDATE "attempts"
SET "record" = ("record" - 'reasoningEffort')
  || jsonb_build_object('reasoningLevel', "reasoning_level")
WHERE "record" IS NOT NULL;
--> statement-breakpoint
DROP TABLE "relabel";
