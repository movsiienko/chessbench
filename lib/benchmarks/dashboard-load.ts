import { join } from "node:path"
import { and, eq, inArray, sql } from "drizzle-orm"
import { db } from "../db/client"
import { attempts, FINISHED_STATUSES } from "../db/schema"
import type { AttemptSummary } from "./attempt-evidence"
import { buildDashboardData, entriesFrom } from "./dashboard-build"
import { loadItems, PROTOCOL_ID } from "./lichess-puzzles"

const benchmarkId = "lichess-puzzles-v1"

/** Server-only: every current-protocol entry, summarized for the dashboard. */
export async function loadDashboardData() {
  const items = await loadItems(
    join(process.cwd(), "data/benchmarks", benchmarkId, "items.jsonl")
  )
  const stored = await db
    .select({
      attemptId: attempts.id,
      model: attempts.model,
      reasoningLevel: attempts.reasoningLevel,
      status: attempts.status,
      // Turns carry the reasoning text; transcripts fetch them on demand.
      record: sql<AttemptSummary>`${attempts.record} - 'turns'`,
    })
    .from(attempts)
    .where(
      and(
        eq(attempts.benchmark, benchmarkId),
        eq(attempts.protocol, PROTOCOL_ID),
        // Finished results plus pending errors; claims in progress are skipped.
        inArray(attempts.status, [...FINISHED_STATUSES, "error"])
      )
    )

  return buildDashboardData({
    ...entriesFrom(stored),
    items,
    datasetSize: items.length,
  })
}

export type DashboardData = Awaited<ReturnType<typeof loadDashboardData>>
