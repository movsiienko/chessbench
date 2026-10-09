import { join } from "node:path"
import { and, count, eq, inArray, ne } from "drizzle-orm"
import { db } from "../db/client"
import { attempts } from "../db/schema"
import {
  loadItems,
  PROTOCOL_ID,
  selectDefaultLichessPuzzleItems,
} from "./lichess-puzzles"
import { reasoningLevelFor, type ReasoningEffort } from "./models"

const benchmarkId = "lichess-puzzles-v1"

export type ItemSelection =
  | { ids: string[] }
  | { limit: number; bands?: string[] }

/**
 * What a run would do: the selected items, and how many model × item
 * attempts it would make versus skip because they are finished or claimed.
 */
export async function planRun({
  models,
  items,
  reasoningEffort,
}: {
  models: string[]
  items: ItemSelection
  reasoningEffort: ReasoningEffort
}) {
  const all = await loadItems(
    join(process.cwd(), "data/benchmarks", benchmarkId, "items.jsonl")
  )
  let itemIds: string[]

  if ("ids" in items) {
    const known = new Set(all.map((item) => item.id))
    const unknown = items.ids.filter((id) => !known.has(id))
    if (unknown.length > 0) {
      throw new RangeError(`Unknown items: ${unknown.join(", ")}`)
    }
    itemIds = [...new Set(items.ids)]
  } else {
    const { bands } = items
    const pool = bands
      ? all.filter((item) => bands.includes(item.metadata.ratingBand))
      : all
    itemIds = selectDefaultLichessPuzzleItems(pool, items.limit).map(
      (item) => item.id
    )
  }

  let skipped = 0
  for (const model of models) {
    const [row] = await db
      .select({ done: count() })
      .from(attempts)
      .where(
        and(
          eq(attempts.benchmark, benchmarkId),
          eq(attempts.protocol, PROTOCOL_ID),
          eq(attempts.model, model),
          eq(
            attempts.reasoningLevel,
            reasoningLevelFor(model, reasoningEffort)
          ),
          inArray(attempts.itemId, itemIds),
          ne(attempts.status, "error")
        )
      )
    skipped += row?.done ?? 0
  }

  return { itemIds, toRun: models.length * itemIds.length - skipped, skipped }
}
