import { sql } from "drizzle-orm"
import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import type { LichessPuzzleAttemptRow } from "../benchmarks/local-runner"

/** Attempt outcomes that are results; `error` is pending, `running` a claim. */
export const FINISHED_STATUSES = [
  "ok",
  "wrong_move",
  "invalid_format",
  "timeout",
]

export const runs = pgTable("runs", {
  id: uuid().primaryKey().defaultRandom(),
  request: jsonb().notNull(),
  startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp({ withTimezone: true }),
})

export const attempts = pgTable(
  "attempts",
  {
    id: uuid().primaryKey().defaultRandom(),
    runId: uuid()
      .notNull()
      .references(() => runs.id),
    benchmark: text().notNull(),
    protocol: text().notNull(),
    model: text().notNull(),
    reasoningLevel: text().notNull(),
    itemId: text().notNull(),
    status: text().notNull(),
    solved: boolean().notNull(),
    // Null while the attempt is claimed (`running`) and not yet finished.
    record: jsonb().$type<LichessPuzzleAttemptRow>(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One finished attempt per item and entry; pending (error) attempts don't block a retry.
    uniqueIndex("attempts_one_result")
      .on(
        table.benchmark,
        table.protocol,
        table.model,
        table.reasoningLevel,
        table.itemId
      )
      .where(sql`${table.status} <> 'error'`),
  ]
)
