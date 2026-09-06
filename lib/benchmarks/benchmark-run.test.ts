import assert from "node:assert/strict"
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, test, type TestContext } from "node:test"
import type { LanguageModelV3GenerateResult } from "@ai-sdk/provider"
import { MockLanguageModelV3 } from "ai/test"
import {
  runLichessPuzzleBenchmark,
  type BenchmarkRunOptions,
} from "./benchmark-run"
import { ATTEMPT_CSV_HEADER, parseAttemptRows } from "./csv"
import { loadItems } from "./lichess-puzzles"

const [item] = await loadItems("data/benchmarks/lichess-puzzles-v1/items.jsonl")

async function setup(t: TestContext): Promise<BenchmarkRunOptions> {
  const dataDirectory = await mkdtemp(join(tmpdir(), "chessbench-run-"))
  t.after(() => rm(dataDirectory, { recursive: true, force: true }))
  const directory = join(dataDirectory, "benchmarks/lichess-puzzles-v1")
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, "items.jsonl"), `${JSON.stringify(item)}\n`)
  return {
    dataDirectory,
    models: ["openai/test"],
    limit: 1,
    all: false,
    canonical: "test",
    reasoningEffort: "medium",
    maxOutputTokens: 4096,
    gatewaySystemCredentials: true,
  }
}

function response(text: string): LanguageModelV3GenerateResult {
  return {
    content: [
      { type: "reasoning", text: "Recorded reasoning" },
      { type: "text", text },
    ],
    finishReason: { unified: "stop", raw: "stop" },
    warnings: [],
    usage: {
      inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 10, text: 7, reasoning: 3 },
    },
    providerMetadata: {
      gateway: {
        gatewayCost: "0.002",
        generationId: "generation",
        routing: { finalProvider: "provider" },
      },
    },
  }
}

describe("benchmark run", () => {
  test("rejects colliding canonical filenames before generation or archival", async (t) => {
    const options = await setup(t)
    options.models = ["provider/model_a", "provider/model-a"]
    const model = new MockLanguageModelV3({
      doGenerate: async () => response("not a move"),
    })
    await assert.rejects(
      runLichessPuzzleBenchmark(options, { resolveModel: () => model }),
      /share canonical filename "provider-model-a-test.csv"/
    )
    assert.equal(model.doGenerateCalls.length, 0)
    assert.deepEqual(await readdir(options.dataDirectory!), ["benchmarks"])

    // A local archive records model ids per row, so these ids are safe there.
    const run = await runLichessPuzzleBenchmark(
      { ...options, canonical: null },
      { resolveModel: () => model }
    )
    assert.deepEqual(
      parseAttemptRows(await readFile(run.localPath, "utf8")).map(
        (row) => row.model
      ),
      options.models
    )
  })

  test("runs the real SDK and archives each model before reporting progress", async (t) => {
    const options = await setup(t)
    options.models.push("anthropic/test")
    const calls = new Map<string, MockLanguageModelV3>()
    for (const id of options.models) {
      let turn = 0
      calls.set(
        id,
        new MockLanguageModelV3({
          doGenerate: async () =>
            response(item.expected.playerUciMoves[turn++]),
        })
      )
    }
    let progress = 0
    const result = await runLichessPuzzleBenchmark(options, {
      resolveModel: (id) => {
        const model = calls.get(id)
        assert.ok(model)
        return model
      },
      onProgress: async ({ row, completed, total }) => {
        assert.equal(completed, ++progress)
        assert.equal(total, 2)
        const canonical = join(
          options.dataDirectory!,
          "results/canonical/lichess-puzzles-v1",
          `${row.model.replace("/", "-")}-test.csv`
        )
        const archived = parseAttemptRows(await readFile(canonical, "utf8"))
        assert.equal(archived.length, 1)
        assert.equal(archived[0].solved, true)
      },
    })
    const csv = await readFile(result.localPath, "utf8")
    const rows = parseAttemptRows(csv)
    assert.equal(result.attemptCount, 2)
    assert.equal(csv.split(ATTEMPT_CSV_HEADER).length, 2)
    assert.deepEqual(
      rows.map((row) => row.model),
      options.models
    )
    for (const row of rows) {
      assert.equal(row.runId, result.runId)
      assert.equal(row.status, "ok")
      assert.equal(row.solved, true)
      assert.equal(row.reasoningEffort, "medium")
      assert.equal(row.maxOutputTokens, 4096)
      assert.equal(row.inputTokens, 300)
      assert.equal(row.outputTokens, 30)
      assert.equal(row.reasoningTokens, 9)
      assert.equal(row.costUsd, 0.006)
      assert.equal(row.turns[0].reasoningText, "Recorded reasoning")
      assert.equal(row.servedProvider, "provider")
    }
    const request = calls.get("openai/test")!.doGenerateCalls[0]
    assert.equal(request.maxOutputTokens, 4096)
    assert.deepEqual(request.providerOptions?.openai, {
      reasoningEffort: "medium",
    })
    assert.deepEqual(request.providerOptions?.gateway, {
      byok: {},
      tags: ["benchmark:lichess-puzzles-v1", `run:${result.runId}`],
    })
  })

  test("keeps a correct first turn when the next generation fails", async (t) => {
    const options = await setup(t)
    let turn = 0
    const model = new MockLanguageModelV3({
      doGenerate: async () => {
        if (turn++ > 0) throw new Error("Provider unavailable")
        return response(item.expected.playerUciMoves[0])
      },
    })
    const run = await runLichessPuzzleBenchmark(options, {
      resolveModel: () => model,
    })
    const [row] = parseAttemptRows(await readFile(run.localPath, "utf8"))
    assert.equal(row.status, "error")
    assert.equal(row.errorMessage, "Provider unavailable")
    assert.equal(row.firstMoveCorrect, true)
    assert.equal(row.solved, false)
    assert.equal(row.costUsd, 0.002)
    assert.deepEqual(
      row.turns.map((turn) => turn.result),
      ["correct", "error"]
    )
  })

  test("appends within a run and replaces the named snapshot on the next run", async (t) => {
    const options = await setup(t)
    options.all = true
    const second = { ...item, id: "lichess:second" }
    await writeFile(
      join(options.dataDirectory!, "benchmarks/lichess-puzzles-v1/items.jsonl"),
      [item, second].map((puzzle) => JSON.stringify(puzzle)).join("\n")
    )
    const model = new MockLanguageModelV3({
      doGenerate: async () => response("not a move"),
    })
    const first = await runLichessPuzzleBenchmark(options, {
      resolveModel: () => model,
    })
    const next = await runLichessPuzzleBenchmark(options, {
      resolveModel: () => model,
    })
    assert.notEqual(first.runId, next.runId)
    const canonical = await readFile(
      join(
        options.dataDirectory!,
        "results/canonical/lichess-puzzles-v1/openai-test-test.csv"
      ),
      "utf8"
    )
    const rows = parseAttemptRows(canonical)
    assert.equal(rows.length, 2)
    assert.ok(rows.every((row) => row.runId === next.runId))
    assert.equal(canonical.split(ATTEMPT_CSV_HEADER).length, 2)
    assert.equal(
      parseAttemptRows(await readFile(first.localPath, "utf8")).length,
      2
    )
  })

  test("normalizes raw reasoning usage and ignores malformed optional metadata", async (t) => {
    const options = await setup(t)
    options.canonical = null
    for (const raw of [
      { output_tokens_details: { reasoning_tokens: "8" } },
      { output_tokens_details: { thinking_tokens: 8 } },
      { completion_tokens_details: { reasoning_tokens: 8 } },
      { thoughtsTokenCount: 8 },
    ]) {
      const result = response("not a move")
      result.usage.outputTokens.reasoning = undefined
      result.usage.raw = raw
      result.providerMetadata = {
        gateway: { gatewayCost: "bad", cost: "0.1", routing: false },
      }
      const run = await runLichessPuzzleBenchmark(options, {
        resolveModel: () =>
          new MockLanguageModelV3({ doGenerate: async () => result }),
      })
      const [row] = parseAttemptRows(await readFile(run.localPath, "utf8"))
      assert.equal(row.status, "invalid_format")
      assert.equal(row.reasoningTokens, 8)
      assert.equal(row.costUsd, 0.1)
      assert.equal(row.servedProvider, "")
    }
    assert.deepEqual(await readdir(join(options.dataDirectory!, "results")), [
      "local",
    ])
  })
})
