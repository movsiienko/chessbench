import type { LanguageModelV4CallOptions } from "@ai-sdk/provider"
import { customProvider } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { start } from "workflow/api"
import { beforeEach, describe, expect, test } from "vitest"
import { benchmarkRun } from "./benchmark-workflow"
import { loadDashboardData } from "./dashboard-load"
import { db } from "../db/client"
import { attempts, runs } from "../db/schema"
import { loadItems, PROTOCOL_ID } from "./lichess-puzzles"

const items = await loadItems("data/benchmarks/lichess-puzzles-v1/items.jsonl")
const item = items.find(
  (candidate) => candidate.expected.playerUciMoves.length > 1
)!

/**
 * A model that answers each turn with `answers[turn]` and counts its calls.
 * `fail(call)` can throw instead, to simulate provider errors.
 */
function scriptedModel(
  answers: string[],
  fail: (call: number) => Error | undefined = () => undefined
) {
  let calls = 0
  return new MockLanguageModelV4({
    doGenerate: async ({ prompt }: LanguageModelV4CallOptions) => {
      const error = fail(calls++)
      if (error) throw error
      const turn =
        prompt.filter((message) => message.role === "user").length - 1
      return {
        content: [{ type: "text", text: answers[turn] ?? "resign" }],
        finishReason: { unified: "stop", raw: "stop" },
        warnings: [],
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 2, text: 2, reasoning: 0 },
        },
      }
    },
  })
}

function useModels(models: Record<string, MockLanguageModelV4>) {
  globalThis.AI_SDK_DEFAULT_PROVIDER = customProvider({
    languageModels: models,
  })
}

beforeEach(() => {
  globalThis.AI_SDK_DEFAULT_PROVIDER = undefined
})

describe("benchmark run", () => {
  test("a finished run appears as a scoreboard entry", async () => {
    useModels({ "openai/gpt-5.5": scriptedModel(item.expected.playerUciMoves) })

    const run = await start(benchmarkRun, [
      {
        models: ["openai/gpt-5.5"],
        itemIds: [item.id],
        reasoning: "low",
      },
    ])
    await run.returnValue

    const data = await loadDashboardData()
    expect(data.models.map((model) => model.name)).toEqual(["GPT 5.5 · low"])
    expect(data.scoreboard[0]).toMatchObject({ n: 1, accuracy: 1, pending: 0 })
  })

  test("a later run skips items the entry has finished, without calling the model", async () => {
    const first = scriptedModel(["a1a1"])
    useModels({ "openai/gpt-5.5": first })
    await runToEnd({
      models: ["openai/gpt-5.5"],
      itemIds: [item.id],
      reasoning: "medium",
    })

    const second = scriptedModel(item.expected.playerUciMoves)
    useModels({ "openai/gpt-5.5": second })
    await runToEnd({
      models: ["openai/gpt-5.5"],
      itemIds: [item.id],
      reasoning: "medium",
    })

    expect(second.doGenerateCalls).toHaveLength(0)
    const data = await loadDashboardData()
    const medium = data.scoreboard.find((row) => row.model.endsWith("-medium"))
    expect(medium).toMatchObject({ n: 1, accuracy: 0 })
  })

  test("overlapping runs pay for each item once", async () => {
    const model = scriptedModel(item.expected.playerUciMoves)
    useModels({ "anthropic/claude-opus-4.8": model })
    const request = {
      models: ["anthropic/claude-opus-4.8"],
      itemIds: [item.id],
      reasoning: "high" as const,
    }

    await Promise.all([runToEnd(request), runToEnd(request)])

    expect(model.doGenerateCalls).toHaveLength(
      item.expected.playerUciMoves.length
    )
    const data = await loadDashboardData()
    const entry = data.scoreboard.find((row) =>
      row.model.startsWith("anthropic")
    )
    expect(entry).toMatchObject({ n: 1, accuracy: 1 })
  })

  test("a transient provider error is retried within the run", async () => {
    const model = scriptedModel(item.expected.playerUciMoves, (call) =>
      call === 1 ? new Error("503 upstream") : undefined
    )
    useModels({ "google/gemini-3.5-flash": model })

    await runToEnd({
      models: ["google/gemini-3.5-flash"],
      itemIds: [item.id],
      reasoning: "low",
    })

    const data = await loadDashboardData()
    const entry = data.scoreboard.find((row) => row.model.startsWith("google"))
    expect(entry).toMatchObject({ n: 1, accuracy: 1, pending: 0 })
    // The retry repeats only the failed turn, not the turns already paid for.
    expect(model.doGenerateCalls).toHaveLength(
      item.expected.playerUciMoves.length + 1
    )
  })

  test("a persistent provider error leaves the item pending for the next run", async () => {
    const request = {
      models: ["xai/grok-4.1-fast-reasoning"],
      itemIds: [item.id],
      reasoning: "low" as const,
    }
    const down = scriptedModel([], () => new Error("503 upstream"))
    useModels({ "xai/grok-4.1-fast-reasoning": down })
    await runToEnd(request)

    const grok = () =>
      loadDashboardData().then((data) =>
        data.scoreboard.find((row) => row.model.startsWith("xai"))
      )
    expect(await grok()).toMatchObject({ n: 0, pending: 1 })

    useModels({
      "xai/grok-4.1-fast-reasoning": scriptedModel(
        item.expected.playerUciMoves
      ),
    })
    await runToEnd(request)
    expect(await grok()).toMatchObject({ n: 1, accuracy: 1, pending: 0 })
  })

  test("exceeding the move time limit fails the turn without a retry", async () => {
    // What AbortSignal.timeout raises when the limit passes mid-call.
    const slow = scriptedModel(
      [],
      () => new DOMException("The operation timed out.", "TimeoutError")
    )
    useModels({ "alibaba/qwen3-max-thinking": slow })

    await runToEnd({
      models: ["alibaba/qwen3-max-thinking"],
      itemIds: [item.id],
      reasoning: "low",
    })

    expect(slow.doGenerateCalls).toHaveLength(1)
    const data = await loadDashboardData()
    const entry = data.scoreboard.find((row) => row.model.startsWith("alibaba"))
    expect(entry).toMatchObject({ n: 1, accuracy: 0, pending: 0 })
    const attempt = data.puzzles[0]?.attempts.find((a) =>
      a.record.model.startsWith("alibaba")
    )
    expect(attempt?.outcome).toBe("Move time limit exceeded on turn 1")
  })

  test("plays different items of a run concurrently", async () => {
    const [a, b] = items
    let inFlight = 0
    let release!: () => void
    const bothStarted = new Promise<void>((resolve) => (release = resolve))
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        // Answers only once two calls are open at the same time; a run that
        // plays items one after another never gets here and times out.
        if (++inFlight === 2) release()
        await bothStarted
        return {
          content: [{ type: "text", text: "a1a1" }],
          finishReason: { unified: "stop", raw: "stop" },
          warnings: [],
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 1, text: 1, reasoning: 0 },
          },
        }
      },
    })
    useModels({ "openai/gpt-5.5": model })

    await runToEnd({
      models: ["openai/gpt-5.5"],
      itemIds: [a!.id, b!.id],
      reasoning: "high",
    })

    const data = await loadDashboardData()
    const high = data.scoreboard.find((row) => row.model.endsWith("-high"))
    expect(high).toMatchObject({ n: 2, accuracy: 0 })
  }, 15_000)

  test("a claim left by a run that died long ago does not block the item", async () => {
    // Arranged directly: no public path produces a crashed run's claim.
    const [dead] = await db
      .insert(runs)
      .values({ request: {} })
      .returning({ id: runs.id })
    await db.insert(attempts).values({
      runId: dead!.id,
      benchmark: "lichess-puzzles-v1",
      protocol: PROTOCOL_ID,
      model: "anthropic/claude-opus-4.8",
      reasoningLevel: "low",
      itemId: item.id,
      status: "running",
      solved: false,
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    })
    const model = scriptedModel(item.expected.playerUciMoves)
    useModels({ "anthropic/claude-opus-4.8": model })

    await runToEnd({
      models: ["anthropic/claude-opus-4.8"],
      itemIds: [item.id],
      reasoning: "low",
    })

    expect(model.doGenerateCalls.length).toBeGreaterThan(0)
    const data = await loadDashboardData()
    const low = data.scoreboard.find(
      (row) => row.model === "anthropic-claude-opus-4-8-low"
    )
    expect(low).toMatchObject({ n: 1, accuracy: 1 })
  })
})

async function runToEnd(request: Parameters<typeof benchmarkRun>[0]) {
  const run = await start(benchmarkRun, [request])
  return run.returnValue
}
