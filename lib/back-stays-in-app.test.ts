import assert from "node:assert/strict"
import { test } from "node:test"
import { backStaysInApp } from "./back-stays-in-app"

const site = "https://chessbench.test"

test("the Navigation API index decides when present", () => {
  assert.equal(
    backStaysInApp(0, `${site}/puzzles/a`, `${site}/tags/fork`),
    false
  )
  assert.equal(
    backStaysInApp(2, `${site}/tags/fork`, `${site}/tags/fork`),
    true
  )
})

test("without it, a page reached after landing goes back", () => {
  assert.equal(
    backStaysInApp(undefined, `${site}/puzzles/a?x=1`, `${site}/tags/fork`),
    true
  )
})

test("without it, the landing path follows the link", () => {
  assert.equal(
    backStaysInApp(undefined, `${site}/tags/fork`, `${site}/tags/fork?sort=1`),
    false
  )
  assert.equal(backStaysInApp(undefined, undefined, `${site}/tags/fork`), false)
})
