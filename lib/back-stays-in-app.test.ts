import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import {
  backStaysInApp,
  isNewPushedEntry,
  keepPushedMark,
  NEXT_ENTRY,
  PUSHED_ENTRY,
} from "./back-stays-in-app"

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

test("a Next.js replace keeps the entry's mark; other writes don't get one", () => {
  const next = { [NEXT_ENTRY]: true, tree: 1 }
  assert.deepEqual(keepPushedMark({ [PUSHED_ENTRY]: true }, next), {
    ...next,
    [PUSHED_ENTRY]: true,
  })
  assert.equal(keepPushedMark({}, next), next)
  assert.equal(keepPushedMark(null, next), next)
  const other = { [NEXT_ENTRY]: false, tree: 1 }
  assert.equal(keepPushedMark({ [PUSHED_ENTRY]: true }, other), other)
  assert.equal(keepPushedMark({ [PUSHED_ENTRY]: true }, null), null)
})

test("the installed Next.js app router still tags its history writes", () => {
  const source = readFileSync(
    createRequire(import.meta.url).resolve(
      "next/dist/client/components/app-router.js"
    ),
    "utf8"
  )
  assert.ok(
    source.includes(`${NEXT_ENTRY}: true`),
    `Next.js no longer writes ${NEXT_ENTRY}; update NEXT_ENTRY (JUS-66)`
  )
})
