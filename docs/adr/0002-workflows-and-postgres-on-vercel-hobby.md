# Benchmark runs execute on Vercel Workflows and record to Postgres

Runs must start without a machine of ours, and a full run takes many hours of mostly waiting on providers. Benchmark runs therefore execute as Vercel Workflows, one step per turn, started from a token-protected endpoint that a GitHub Actions dispatch calls. Attempts are recorded in Neon Postgres through Drizzle, which is the source of truth for the published scoreboard; the CSVs in git are history only. Postgres was chosen over files in Blob because "has this model already finished this item?" is a unique constraint, and a claim row inserted before the paid call stops overlapping or resumed runs from paying twice.

## Considered Options

- Local runner writing CSVs committed to git: needs a machine for 12-25 hours per model and loses progress if it dies. The local CLI is removed; protocol experiments run on preview deployments against their own database branch.
- One Blob object per attempt with meaningful keys: encodes identity in paths, which breaks when the protocol gains a field, and makes "what is missing" a listing of thousands of objects.
- GitHub Actions as the runner: jobs stop at 6 hours.
