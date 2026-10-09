import assert from "node:assert/strict"
import { test } from "node:test"
import type { LanguageModelV3GenerateResult } from "@ai-sdk/provider"
import { customProvider } from "ai"
import { MockLanguageModelV3 } from "ai/test"
import { createGenerate } from "./generate"

// Moved from the deleted CLI runner's tests: provider metadata differs per
// provider and must never fail a paid call.
test("normalizes raw reasoning usage and ignores malformed optional metadata", async () => {
  const generate = createGenerate({
    reasoningEffort: "medium",
    maxOutputTokens: null,
    gatewayTags: null,
  })

  for (const raw of [
    { output_tokens_details: { reasoning_tokens: "8" } },
    { output_tokens_details: { thinking_tokens: 8 } },
    { completion_tokens_details: { reasoning_tokens: 8 } },
    { thoughtsTokenCount: 8 },
  ]) {
    const result: LanguageModelV3GenerateResult = {
      content: [{ type: "text", text: "e2e4" }],
      finishReason: { unified: "stop", raw: "stop" },
      warnings: [],
      usage: {
        inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 10, text: 10, reasoning: undefined },
        raw,
      },
      providerMetadata: {
        gateway: { gatewayCost: "bad", cost: "0.1", routing: false },
      },
    }
    globalThis.AI_SDK_DEFAULT_PROVIDER = customProvider({
      languageModels: {
        "openai/test": new MockLanguageModelV3({
          doGenerate: async () => result,
        }),
      },
    })

    const response = await generate({
      model: "openai/test",
      messages: [{ role: "user", content: "Move?" }],
    })

    assert.equal(response.usage?.reasoningTokens, 8)
    assert.equal(response.costUsd, 0.1)
    assert.equal(response.servedProvider, undefined)
  }
  globalThis.AI_SDK_DEFAULT_PROVIDER = undefined
})
