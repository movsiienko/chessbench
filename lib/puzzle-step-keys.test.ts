import assert from "node:assert/strict"
import { test } from "node:test"
import { puzzleStepForKey } from "./puzzle-step-keys"

const press = (key: string, extra: Partial<KeyboardEvent> = {}) =>
  puzzleStepForKey({
    key,
    code: "",
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    repeat: false,
    defaultPrevented: false,
    ...extra,
  })

test("arrows and J/K step through puzzles", () => {
  assert.equal(press("ArrowLeft"), -1)
  assert.equal(press("k"), -1)
  assert.equal(press("K"), -1) // Caps Lock
  assert.equal(press("ArrowRight"), 1)
  assert.equal(press("j"), 1)
  assert.equal(press("л", { code: "KeyK" }), -1) // Ukrainian layout
  assert.equal(press("о", { code: "KeyJ" }), 1)
})

test("other keys do nothing", () => {
  for (const key of ["ArrowUp", "ArrowDown", "h", "l", " ", "Enter"]) {
    assert.equal(press(key), null)
  }
})

test("modified, held and already-handled keys do nothing", () => {
  for (const extra of [
    { altKey: true },
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { repeat: true },
    { defaultPrevented: true },
  ]) {
    assert.equal(press("ArrowRight", extra), null)
    assert.equal(press("j", extra), null)
  }
})
