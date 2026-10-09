import { customProvider } from "ai"
import { MockLanguageModelV3 } from "ai/test"
import { getRun, start } from "workflow/api"
import { beforeAll, describe, expect, test } from "vitest"
import { benchmarkRun } from "@/lib/benchmarks/benchmark-workflow"
import { loadDashboardData } from "@/lib/benchmarks/dashboard-load"
import {
  loadItems,
  selectDefaultLichessPuzzleItems,
} from "@/lib/benchmarks/lichess-puzzles"
import { POST } from "./route"

const items = await loadItems("data/benchmarks/lichess-puzzles-v1/items.jsonl")
const sample = selectDefaultLichessPuzzleItems(items, 2)

/** A model that always answers with an illegal move: one call per attempt. */
function wrongModel() {
  return new MockLanguageModelV3({
    doGenerate: async () => ({
      content: [{ type: "text", text: "a1a1" }],
      finishReason: { unified: "stop", raw: "stop" },
      warnings: [],
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
    }),
  })
}

const token = "t".repeat(48)

/** A run request as a client sends it, valid or not. */
type RunRequestBody = {
  models: string[]
  items: { limit?: number; ids?: string[]; bands?: string[] }
  reasoningEffort: string
  dryRun?: boolean
}

function post(body: RunRequestBody, authorization = `Bearer ${token}`) {
  return POST(
    new Request("https://chessbench.test/api/benchmark-runs", {
      method: "POST",
      headers: { authorization, "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  )
}

beforeAll(() => {
  process.env.BENCHMARK_ADMIN_TOKEN = token
})

describe("POST /api/benchmark-runs", () => {
  test("hides itself from requests without the admin token", async () => {
    const response = await post(
      {
        models: ["openai/gpt-5.5"],
        items: { limit: 1 },
        reasoningEffort: "low",
      },
      "Bearer wrong"
    )
    expect(response.status).toBe(404)
  })

  test("rejects models outside the registry and malformed requests", async () => {
    const unknown = await post({
      models: ["openai/gpt-unlisted"],
      items: { limit: 1 },
      reasoningEffort: "low",
    })
    expect(unknown.status).toBe(400)
    expect(await unknown.text()).toContain("openai/gpt-unlisted")

    const malformed = await post({
      models: [],
      items: {},
      reasoningEffort: "max",
    })
    expect(malformed.status).toBe(400)
  })

  test("a dry run plans the attempts a run would make, without calling a model", async () => {
    const model = wrongModel()
    globalThis.AI_SDK_DEFAULT_PROVIDER = customProvider({
      languageModels: { "openai/gpt-5.5": model },
    })
    const seeded = await start(benchmarkRun, [
      {
        models: ["openai/gpt-5.5"],
        itemIds: [sample[0]!.id],
        reasoningEffort: "low",
      },
    ])
    await seeded.returnValue
    const calls = model.doGenerateCalls.length

    const response = await post({
      models: ["openai/gpt-5.5", "google/gemini-3.5-flash"],
      items: { limit: 2 },
      reasoningEffort: "low",
      dryRun: true,
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ toRun: 3, skipped: 1 })
    expect(model.doGenerateCalls).toHaveLength(calls)
  })

  test("starts a run over the planned items and returns its id", async () => {
    globalThis.AI_SDK_DEFAULT_PROVIDER = customProvider({
      languageModels: { "deepseek/deepseek-v3.2-thinking": wrongModel() },
    })

    const response = await post({
      models: ["deepseek/deepseek-v3.2-thinking"],
      items: { ids: [sample[1]!.id] },
      reasoningEffort: "high",
    })

    expect(response.status).toBe(202)
    const body = await response.json()
    expect(body).toMatchObject({ toRun: 1, skipped: 0 })
    await getRun(body.runId).returnValue

    const data = await loadDashboardData()
    const entry = data.scoreboard.find((row) =>
      row.model.startsWith("deepseek")
    )
    expect(entry).toMatchObject({ n: 1, accuracy: 0 })
  })

  test("rejects item ids outside the benchmark", async () => {
    const response = await post({
      models: ["openai/gpt-5.5"],
      items: { ids: ["lichess:nope"] },
      reasoningEffort: "low",
    })
    expect(response.status).toBe(400)
    expect(await response.text()).toContain("lichess:nope")
  })

  test("a band filter spends the whole limit inside the chosen bands", async () => {
    const response = await post({
      models: ["xai/grok-4.1-fast-reasoning"],
      items: { limit: 7, bands: ["under-1200"] },
      reasoningEffort: "low",
      dryRun: true,
    })
    expect(await response.json()).toEqual({ toRun: 7, skipped: 0 })
  })

  test("counts a model listed twice once", async () => {
    const response = await post({
      models: ["xai/grok-4.1-fast-reasoning", "xai/grok-4.1-fast-reasoning"],
      items: { limit: 2 },
      reasoningEffort: "low",
      dryRun: true,
    })
    expect(await response.json()).toEqual({ toRun: 2, skipped: 0 })
  })
})
