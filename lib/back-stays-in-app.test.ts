import assert from "node:assert/strict"
import { test } from "node:test"
import { backStaysInApp, isNewPushedEntry } from "./back-stays-in-app"

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

test("without it, a pushed entry at the landing path goes back", () => {
  assert.equal(
    backStaysInApp(undefined, `${site}/tags/fork`, `${site}/tags/fork`, true),
    true
  )
  assert.equal(
    backStaysInApp(0, `${site}/tags/fork`, `${site}/tags/fork`, true),
    false
  )
})

test("only a later mount on a new, non-traversed entry is a push", () => {
  const landing = {}
  const pushed = {}
  const href = `${site}/tags/fork`
  assert.equal(isNewPushedEntry(undefined, landing, undefined, href), false)
  assert.equal(isNewPushedEntry(landing, landing, undefined, href), false)
  assert.equal(isNewPushedEntry(landing, pushed, href, href), false)
  assert.equal(isNewPushedEntry(landing, pushed, `${site}/puzzles`, href), true)
  assert.equal(isNewPushedEntry(landing, pushed, undefined, href), true)
})
