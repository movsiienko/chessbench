import { start } from "workflow/api"
import { z } from "zod"
import { isAdminRequest } from "@/lib/admin-token"
import { benchmarkRun } from "@/lib/benchmarks/benchmark-workflow"
import { MODELS, REASONING_EFFORTS } from "@/lib/benchmarks/models"
import { planRun } from "@/lib/benchmarks/run-plan"

const registered = new Set<string>(MODELS.map((model) => model.id))

const runRequestSchema = z.object({
  models: z
    .array(
      z.string().refine((id) => registered.has(id), {
        error: (issue) => `${String(issue.input)} is not in the model registry`,
      })
    )
    .min(1),
  items: z.union([
    z.object({ ids: z.array(z.string()).min(1) }).strict(),
    z
      .object({
        limit: z.number().int().positive(),
        bands: z.array(z.string()).min(1).optional(),
      })
      .strict(),
  ]),
  reasoningEffort: z.enum(REASONING_EFFORTS),
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
      reasoningEffort: parsed.data.reasoningEffort,
    },
  ])

  return Response.json(
    { runId: run.runId, toRun: plan.toRun, skipped: plan.skipped },
    { status: 202 }
  )
}
