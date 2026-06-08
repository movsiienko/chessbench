import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { parseCsvRecords } from "./csv"

describe("CSV parsing", () => {
  test("preserves quoted commas, quotes, and embedded newlines", () => {
    const records = parseCsvRecords(
      [
        "id,message,turns_json",
        'row-1,"first line',
        'second line","[{""rawAnswer"":""Rxa6""}]"',
      ].join("\n")
    )

    assert.deepEqual(records, [
      ["id", "message", "turns_json"],
      ["row-1", "first line\nsecond line", '[{"rawAnswer":"Rxa6"}]'],
    ])
  })
})
