import { join } from "node:path"
import { and, eq, sql } from "drizzle-orm"
import { db } from "../db/client"
import { attempts, runs } from "../db/schema"
import { createGenerate } from "./generate"
import {
  loadItems,
  MOVE_TIME_LIMIT_MS,
  PROTOCOL_ID,
  type LichessPuzzleBenchmarkItem,
} from "./lichess-puzzles"
import {
  attemptRow,
  nextTurnMessages,
  recordAnswer,
  recordFailure,
  startAttempt,
  type AttemptState,
} from "./local-runner"
import { reasoningLevelFor, type ReasoningEffort } from "./models"

const benchmarkId = "lichess-puzzles-v1"

export type BenchmarkRunRequest = {
  models: string[]
  itemIds: string[]
  reasoningEffort: ReasoningEffort
}

type AttemptKey = {
  runId: string
  model: string
  itemId: string
  reasoningEffort: ReasoningEffort
}

// ponytail: fixed batches wait for their slowest attempt; a sliding window
// would keep five calls busy, if provider rate limits allow it.
const ATTEMPTS_IN_PARALLEL = 5

/** One benchmark run: every requested model on every requested item. */
export async function benchmarkRun(request: BenchmarkRunRequest) {
  "use workflow"

  const runId = await createRun(request)
  const keys = request.models.flatMap((model) =>
    request.itemIds.map((itemId) => ({
      runId,
      model,
      itemId,
      reasoningEffort: request.reasoningEffort,
    }))
  )

  for (let start = 0; start < keys.length; start += ATTEMPTS_IN_PARALLEL) {
    await Promise.all(
      keys.slice(start, start + ATTEMPTS_IN_PARALLEL).map(playAttempt)
    )
  }

  await finishRun(runId)
  return { runId }
}

/**
 * One step per turn, so each paid model call fits a function invocation and
 * a retry repeats only the turn that failed.
 */
async function playAttempt(key: AttemptKey) {
  let state: AttemptState | null = null

  try {
    do {
      const turn: AttemptState | null = await playTurn(key, state)
      if (!turn) return
      state = turn
    } while (!state.done)
  } catch (error) {
    await recordPending(
      key,
      state,
      error instanceof Error ? error.message : String(error)
    )
  }
}

// ponytail: claims expire by age, not heartbeat. The longest legitimate attempt
// is about four turns of four tries at the move time limit (~72 minutes).
const STALE_CLAIM = "2 hours"

async function createRun(request: BenchmarkRunRequest) {
  "use step"

  // A run that died mid-attempt leaves its claims behind; release them so the
  // items are played again instead of being skipped forever.
  await db
    .delete(attempts)
    .where(
      and(
        eq(attempts.status, "running"),
        sql`${attempts.createdAt} < now() - ${STALE_CLAIM}::interval`
      )
    )

  const [run] = await db
    .insert(runs)
    .values({ request })
    .returning({ id: runs.id })
  return run!.id
}

/**
 * Plays the next turn of an attempt. The first turn claims the item; the turn
 * that ends the attempt records it. Returns null when the item is skipped.
 */
async function playTurn(key: AttemptKey, previous: AttemptState | null) {
  "use step"

  const attemptId = await claim(key)
  if (!attemptId) {
    return null
  }

  const item = await itemById(key.itemId)
  const state = previous ?? startAttempt()
  const generate = createGenerate({
    reasoningEffort: key.reasoningEffort,
    maxOutputTokens: null,
    gatewayTags: [`benchmark:${benchmarkId}`, `run:${key.runId}`],
  })
  const abortSignal = AbortSignal.timeout(MOVE_TIME_LIMIT_MS)
  let next: AttemptState

  try {
    const response = await generate({
      model: key.model,
      messages: nextTurnMessages(item, state),
      abortSignal,
    })
    next = recordAnswer(item, state, response)
  } catch (error) {
    const timedOut =
      abortSignal.aborted ||
      (error instanceof Error && error.name === "TimeoutError")
    if (!timedOut) {
      throw error // A provider error: the workflow retries this turn.
    }
    next = recordFailure(
      item,
      state,
      "timeout",
      `No answer within the ${MOVE_TIME_LIMIT_MS / 1000}s move time limit`
    )
  }

  if (next.done) {
    await record(attemptId, key, item, next)
  }
  return next
}

/** A turn failed through every retry: the attempt is pending for a later run. */
async function recordPending(
  key: AttemptKey,
  state: AttemptState | null,
  errorMessage: string
) {
  "use step"

  const attemptId = await claim(key)
  if (!attemptId) {
    return
  }

  const item = await itemById(key.itemId)
  await record(
    attemptId,
    key,
    item,
    recordFailure(item, state ?? startAttempt(), "error", errorMessage)
  )
}

async function finishRun(runId: string) {
  "use step"

  await db
    .update(runs)
    .set({ finishedAt: new Date() })
    .where(eq(runs.id, runId))

  // Refresh the public page on the production domain: this run stays pinned
  // to the deployment that started it, whose ISR cache may no longer be live.
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (host) {
    const response = await fetch(`https://${host}/api/revalidate`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.BENCHMARK_ADMIN_TOKEN ?? ""}`,
      },
    })
    if (!response.ok) {
      throw new Error(`Revalidation failed: ${response.status}`)
    }
  }
}

let itemsById: Map<string, LichessPuzzleBenchmarkItem> | undefined

async function itemById(itemId: string) {
  itemsById ??= new Map(
    (
      await loadItems(
        join(process.cwd(), "data/benchmarks", benchmarkId, "items.jsonl")
      )
    ).map((item) => [item.id, item])
  )
  const item = itemsById.get(itemId)

  if (!item) {
    throw new Error(`Unknown item ${itemId}`)
  }
  return item
}

function reasoningLevelOf(key: AttemptKey) {
  return reasoningLevelFor(key.model, key.reasoningEffort)
}

async function record(
  attemptId: string,
  key: AttemptKey,
  item: LichessPuzzleBenchmarkItem,
  state: AttemptState
) {
  const row = {
    ...attemptRow(
      {
        runId: key.runId,
        model: key.model,
        item,
        createdAt: new Date().toISOString(),
      },
      state
    ),
    reasoningEffort: reasoningLevelOf(key),
    maxOutputTokens: null,
  }

  await db
    .update(attempts)
    .set({ status: row.status, solved: row.solved, record: row })
    .where(eq(attempts.id, attemptId))
}

/**
 * Claims the item for this run before any paid call, through the one-result
 * index: a finished attempt or another run's claim makes the insert a no-op
 * and the item is skipped (null). A later turn, or a retried step, finds its
 * own run's claim again.
 */
async function claim(key: AttemptKey) {
  const reasoningLevel = reasoningLevelOf(key)
  const [inserted] = await db
    .insert(attempts)
    .values({
      runId: key.runId,
      benchmark: benchmarkId,
      protocol: PROTOCOL_ID,
      model: key.model,
      reasoningLevel,
      itemId: key.itemId,
      status: "running",
      solved: false,
    })
    .onConflictDoNothing({
      target: [
        attempts.benchmark,
        attempts.protocol,
        attempts.model,
        attempts.reasoningLevel,
        attempts.itemId,
      ],
      where: sql`${attempts.status} <> 'error'`,
    })
    .returning({ id: attempts.id })

  if (inserted) {
    return inserted.id
  }

  const [own] = await db
    .select({ id: attempts.id })
    .from(attempts)
    .where(
      and(
        eq(attempts.runId, key.runId),
        eq(attempts.benchmark, benchmarkId),
        eq(attempts.protocol, PROTOCOL_ID),
        eq(attempts.model, key.model),
        eq(attempts.reasoningLevel, reasoningLevel),
        eq(attempts.itemId, key.itemId),
        eq(attempts.status, "running")
      )
    )
  return own?.id ?? null
}
