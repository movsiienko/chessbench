import assert from "node:assert/strict"
import { test } from "node:test"
import type { LanguageModelV4GenerateResult } from "@ai-sdk/provider"
import { APICallError, customProvider } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { createGenerate } from "./generate"

// Moved from the deleted CLI runner's tests: provider metadata differs per
// provider and must never fail a paid call.
test("normalizes raw reasoning usage and ignores malformed optional metadata", async () => {
  const generate = createGenerate({
    reasoning: "medium",
    maxOutputTokens: null,
    gatewayTags: null,
  })

  for (const raw of [
    { output_tokens_details: { reasoning_tokens: "8" } },
    { output_tokens_details: { thinking_tokens: 8 } },
    { completion_tokens_details: { reasoning_tokens: 8 } },
    { thoughtsTokenCount: 8 },
  ]) {
    const result: LanguageModelV4GenerateResult = {
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
        "openai/test": new MockLanguageModelV4({
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

test("asks the model for the requested reasoning level, provider-neutrally", async () => {
  const model = new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: "e2e4" }],
      finishReason: { unified: "stop", raw: "stop" },
      warnings: [],
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
    }),
  })
  globalThis.AI_SDK_DEFAULT_PROVIDER = customProvider({
    languageModels: { "anthropic/test": model },
  })

  await createGenerate({
    reasoning: "low",
    maxOutputTokens: null,
    gatewayTags: null,
  })({
    model: "anthropic/test",
    messages: [{ role: "user", content: "Move?" }],
  })

  assert.equal(model.doGenerateCalls[0]?.reasoning, "low")
  // No provider-specific reasoning options: the SDK maps the level per provider.
  assert.equal(model.doGenerateCalls[0]?.providerOptions?.anthropic, undefined)
  globalThis.AI_SDK_DEFAULT_PROVIDER = undefined
})

test("leaves retries to the workflow: a provider error surfaces after one call", async () => {
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      throw new APICallError({
        message: "Overloaded",
        url: "https://gateway.test",
        requestBodyValues: {},
        statusCode: 529,
        isRetryable: true,
      })
    },
  })
  globalThis.AI_SDK_DEFAULT_PROVIDER = customProvider({
    languageModels: { "anthropic/test": model },
  })

  await assert.rejects(
    createGenerate({
      reasoning: "low",
      maxOutputTokens: null,
      gatewayTags: null,
    })({
      model: "anthropic/test",
      messages: [{ role: "user", content: "Move?" }],
    })
  )
  assert.equal(model.doGenerateCalls.length, 1)
  globalThis.AI_SDK_DEFAULT_PROVIDER = undefined
})
