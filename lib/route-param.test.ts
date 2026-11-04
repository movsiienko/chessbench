import assert from "node:assert/strict"
import { test } from "node:test"
import { decodeRouteParam } from "./route-param"

test("ids round-trip through encodeURIComponent and one decode", () => {
  for (const id of ["lichess:wAIrQ", "a%2Fb", "50%25", "a/b?c#d"]) {
    assert.equal(decodeRouteParam(encodeURIComponent(id)), id)
  }
})

test("a malformed escape stays as typed", () => {
  assert.equal(decodeRouteParam("50%"), "50%")
})
