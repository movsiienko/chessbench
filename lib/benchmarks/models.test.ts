import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { MODELS } from "./models"

describe("model registry", () => {
  test("ids are unique and gateway ids are lab-prefixed", () => {
    assert.equal(new Set(MODELS.map((m) => m.id)).size, MODELS.length)
    for (const model of MODELS) {
      assert.match(model.id, /^[a-z]+\/./)
    }
  })
})
