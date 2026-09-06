import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { MODELS, providerOptionsFor, reasoningEffortForModel } from "./models"

describe("model registry", () => {
  test("ids are unique and gateway ids are lab-prefixed", () => {
    assert.equal(new Set(MODELS.map((m) => m.id)).size, MODELS.length)
    for (const model of MODELS) {
      assert.match(model.apiModel, /^[a-z]+\/./)
    }
  })
})

describe("providerOptionsFor / reasoningEffortForModel", () => {
  test("each lab at medium effort", () => {
    assert.deepEqual(providerOptionsFor("openai/gpt-5.5", "medium"), {
      openai: { reasoningEffort: "medium" },
    })
    assert.equal(reasoningEffortForModel("openai/gpt-5.5", "medium"), "medium")

    assert.deepEqual(
      providerOptionsFor("anthropic/claude-opus-4.8", "medium"),
      {
        anthropic: {
          thinking: { type: "adaptive" },
          output_config: { effort: "medium" },
        },
      }
    )
    assert.equal(
      reasoningEffortForModel("anthropic/claude-opus-4.8", "medium"),
      "medium"
    )

    assert.deepEqual(providerOptionsFor("google/gemini-3.5-flash", "medium"), {
      google: {
        thinkingConfig: { thinkingLevel: "medium", includeThoughts: true },
      },
    })
    assert.equal(
      reasoningEffortForModel("google/gemini-3.5-flash", "medium"),
      "medium"
    )

    // xAI only knows low/high; medium collapses to low.
    assert.deepEqual(providerOptionsFor("xai/grok-4.1", "medium"), {
      xai: { reasoningEffort: "low" },
    })
    assert.equal(reasoningEffortForModel("xai/grok-4.1", "medium"), "low")

    assert.deepEqual(providerOptionsFor("deepseek/deepseek-v3.2", "medium"), {
      deepseek: { thinking: { type: "enabled" }, reasoning_effort: "high" },
    })
    assert.equal(
      reasoningEffortForModel("deepseek/deepseek-v3.2", "medium"),
      "high"
    )
  })

  test("none disables reasoning everywhere", () => {
    for (const model of ["openai/x", "anthropic/x", "google/x", "xai/x"]) {
      assert.deepEqual(providerOptionsFor(model, "none"), {})
      assert.equal(reasoningEffortForModel(model, "none"), "")
    }
    assert.deepEqual(providerOptionsFor("deepseek/x", "none"), {
      deepseek: { thinking: { type: "disabled" } },
    })
    assert.equal(reasoningEffortForModel("deepseek/x", "none"), "none")
  })

  test("thinking/reasoning suffix wins over the lab mapping, except deepseek", () => {
    assert.equal(
      reasoningEffortForModel("xai/grok-4.1-fast-reasoning", "low"),
      "model-thinking"
    )
    assert.equal(
      reasoningEffortForModel("alibaba/qwen3-max-thinking", "low"),
      "model-thinking"
    )
    assert.equal(
      reasoningEffortForModel("deepseek/deepseek-v3.2-thinking", "xhigh"),
      "max"
    )
  })

  test("gateway tags switch to system credentials", () => {
    assert.deepEqual(providerOptionsFor("openai/x", "none", ["run:1"]), {
      gateway: { byok: {}, tags: ["run:1"] },
    })
  })
})
