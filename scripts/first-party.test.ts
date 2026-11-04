import assert from "node:assert/strict"
import { test } from "node:test"
import { isFirstParty } from "./first-party"

const preview = "https://chessbench-git-x-justmykyta.vercel.app/"

test("the target's own host and local hosts are first-party", () => {
  assert.ok(isFirstParty(`${preview}_next/static/a.js`, preview))
  assert.ok(isFirstParty("http://localhost:3001/hmr", "http://localhost:3000"))
})

test("Vercel's toolbar is allowed only on a Vercel preview", () => {
  const toolbar = "https://vercel.live/_next-live/feedback/feedback.js"
  assert.ok(isFirstParty(toolbar, preview))
  assert.ok(!isFirstParty(toolbar, "http://localhost:3000"))
})

test("real third parties still fail, on previews too", () => {
  for (const url of [
    "https://www.googletagmanager.com/gtag/js",
    "https://fonts.googleapis.com/css",
    "https://other-app.vercel.app/x.js",
    "https://vercel.live.evil.com/x.js",
  ])
    assert.ok(!isFirstParty(url, preview), url)
})
