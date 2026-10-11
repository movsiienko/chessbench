-- The first workflow run (2026-10-09) recorded two Claude Opus 4.8 move time
-- limit timeouts while the AI SDK still retried failed calls silently inside
-- the limit (fixed in #25: maxRetries 0), so they may not reflect the model's
-- own thinking time. Remove them so the next run plays both items again.
DELETE FROM "attempts"
WHERE "id" IN (
  '3949175c-c1c5-4096-916f-9efeab25a255',
  'a58abb3a-07db-4b78-adc7-bd00628d7c2f'
) AND "status" = 'timeout';
