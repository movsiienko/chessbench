import { readFile } from "node:fs/promises"
import { asc } from "drizzle-orm"
import { describe, expect, test } from "vitest"
import { PROTOCOL_ID } from "../benchmarks/lichess-puzzles"
import { db } from "./client"
import { attempts, runs } from "./schema"

// Rows as the pre-0003 code labelled them, with what each provider actually
// received. Migration 0003 must relabel them with what ran.
const cases = [
  // model, stored level, run request effort, expected label
  ["anthropic/claude-opus-4.8", "low", "low", "high"],
  ["anthropic/claude-opus-4.8", "max", "xhigh", "high"],
  ["anthropic/claude-opus-4.8", "none", "none", "none"],
  ["deepseek/deepseek-v3.2-thinking", "high", "medium", "provider-default"],
  ["deepseek/deepseek-v3.2-thinking", "none", "none", "none"],
  ["alibaba/qwen3-max-thinking", "model-thinking", "low", "provider-default"],
  ["alibaba/qwen3-max-thinking", "none", "none", "provider-default"],
  ["xai/grok-4.1-fast-reasoning", "model-thinking", "low", "low"],
  ["xai/grok-4.1-fast-reasoning", "model-thinking", "xhigh", "high"],
  ["xai/grok-4.1-fast-reasoning", "none", "none", "provider-default"],
  ["openai/gpt-5.5", "medium", "medium", "medium"],
  ["openai/gpt-5.5", "none", "none", "provider-default"],
  ["google/gemini-3.5-flash", "low", "minimal", "low"],
  ["google/gemini-3.5-flash", "none", "none", "provider-default"],
] as const

async function insertOld(
  model: string,
  storedLevel: string,
  requestedEffort: string,
  itemId: string,
  createdAt = new Date()
) {
  const [run] = await db
    .insert(runs)
    .values({ request: { reasoningEffort: requestedEffort } })
    .returning({ id: runs.id })
  await db.insert(attempts).values({
    runId: run!.id,
    benchmark: "lichess-puzzles-v1",
    protocol: PROTOCOL_ID,
    model,
    reasoningLevel: storedLevel,
    itemId,
    status: "wrong_move",
    solved: false,
    // SAFETY: only the label fields matter to the migration.
    record: { reasoningEffort: storedLevel } as never,
    createdAt,
  })
}

async function migrate0003() {
  const sql = await readFile(
    "drizzle/0003_relabel-reasoning-levels.sql",
    "utf8"
  )
  for (const statement of sql.split("--> statement-breakpoint")) {
    if (statement.replace(/--.*$/gm, "").trim()) {
      await globalThis.chessbenchPglite!.exec(statement)
    }
  }
}

describe("migration 0003", () => {
  test("relabels every result with the reasoning level that actually ran", async () => {
    for (const [index, [model, stored, requested]] of cases.entries()) {
      await insertOld(model, stored, requested, `lichess:case${index}`)
    }

    await migrate0003()

    const rows = await db
      .select({
        itemId: attempts.itemId,
        level: attempts.reasoningLevel,
        record: attempts.record,
      })
      .from(attempts)
      .orderBy(asc(attempts.itemId))
    for (const [index, [model, , , expected]] of cases.entries()) {
      const row = rows.find((r) => r.itemId === `lichess:case${index}`)
      expect({ model, level: row?.level }).toEqual({ model, level: expected })
      expect(row?.record).toEqual({ reasoningLevel: expected })
    }
  })

  test("keeps the earliest result when two relabel onto one entry and item", async () => {
    await db.delete(attempts)
    await insertOld(
      "anthropic/claude-opus-4.8",
      "low",
      "low",
      "lichess:dup",
      new Date(1)
    )
    await insertOld(
      "anthropic/claude-opus-4.8",
      "high",
      "high",
      "lichess:dup",
      new Date(2)
    )

    await migrate0003()

    const rows = await db.select().from(attempts)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      reasoningLevel: "high",
      createdAt: new Date(1),
    })
  })
})
