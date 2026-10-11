import { start } from "workflow/api"
import { z } from "zod"
import { isAdminRequest } from "@/lib/admin-token"
import { benchmarkRun } from "@/lib/benchmarks/benchmark-workflow"
import { RATING_BAND_IDS } from "@/lib/benchmarks/lichess-puzzles"
import { MODELS, REASONING_LEVELS } from "@/lib/benchmarks/models"
import { planRun, type ItemSelection } from "@/lib/benchmarks/run-plan"

const registered = new Set<string>(MODELS.map((model) => model.id))

const runRequestSchema = z.object({
  models: z
    .array(
      z.string().refine((id) => registered.has(id), {
        error: (issue) => `${String(issue.input)} is not in the model registry`,
      })
    )
    .min(1)
    .transform((ids) => [...new Set(ids)]),
  // Either explicit ids, or the deterministic sample (optionally by band).
  items: z
    .object({
      ids: z.array(z.string()).min(1).optional(),
      // The benchmark has 500 items; more would read as a typo.
      limit: z.number().int().positive().max(500).optional(),
      bands: z
        .array(
          z.enum(RATING_BAND_IDS, {
            error: (issue) =>
              `${String(issue.input)} is not a rating band (${RATING_BAND_IDS.join(", ")})`,
          })
        )
        .min(1)
        .optional(),
    })
    .strict()
    .refine(
      (items) => (items.ids === undefined) !== (items.limit === undefined),
      {
        error: "Give either items.ids or items.limit",
      }
    )
    .refine((items) => items.ids === undefined || items.bands === undefined, {
      error:
        "items.bands narrows items.limit and cannot be used with items.ids",
    })
    .transform(
      ({ ids, limit, bands }): ItemSelection =>
        ids ? { ids } : { limit: limit ?? 0, bands }
    ),
  reasoning: z.enum(REASONING_LEVELS),
  dryRun: z.boolean().default(false),
})

/** Starts a benchmark run. Spends money, so it answers only the admin. */
export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return new Response("Not found", { status: 404 })
  }

  const parsed = runRequestSchema.safeParse(
    await request.json().catch(() => null)
  )

  if (!parsed.success) {
    return new Response(z.prettifyError(parsed.error), { status: 400 })
  }

  let plan: Awaited<ReturnType<typeof planRun>>
  try {
    plan = await planRun(parsed.data)
  } catch (error) {
    if (error instanceof RangeError) {
      return new Response(error.message, { status: 400 })
    }
    throw error
  }

  if (parsed.data.dryRun) {
    return Response.json({ toRun: plan.toRun, skipped: plan.skipped })
  }

  const run = await start(benchmarkRun, [
    {
      models: parsed.data.models,
      itemIds: plan.itemIds,
      reasoning: parsed.data.reasoning,
    },
  ])

  return Response.json(
    { runId: run.runId, toRun: plan.toRun, skipped: plan.skipped },
    { status: 202 }
  )
}
