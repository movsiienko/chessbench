import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { playMove } from "./moves"
import {
  isLineLocked,
  playOpponentReply,
  playSolverMove,
  restorePuzzleLine,
  savePuzzleLine,
  startPuzzleLine,
  type PuzzleLineState,
} from "./puzzle-line"

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
const LINE = ["e2e4", "e7e5", "g1f3"]

function drag(state: PuzzleLineState, line: string[], uci: string) {
  const move = playMove(state.fen, uci.slice(0, 2), uci.slice(2, 4))
  assert.ok(move, uci)
  return playSolverMove(state, line, move)
}

describe("puzzle line", () => {
  test("matches a solution with an uppercase promotion letter", () => {
    const line = ["e7e8Q"]
    const state = drag(
      startPuzzleLine("8/4P3/8/8/8/8/k7/4K3 w - - 0 1"),
      line,
      "e7e8q"
    )
    assert.deepEqual(state.feedback, { result: "solved", san: "e8=Q" })
  })

  test("plays a multi-move line: move, opponent reply, next move", () => {
    let state = startPuzzleLine(START)
    assert.equal(isLineLocked(state, LINE), false)
    assert.equal(playOpponentReply(state, LINE), null)

    state = drag(state, LINE, "e2e4")
    assert.equal(state.ply, 1)
    assert.deepEqual(state.feedback, { result: "correct", san: "e4" })
    assert.deepEqual(state.lastMove, { from: "e2", to: "e4" })
    assert.equal(isLineLocked(state, LINE), true)
    // The board ignores input while the reply is due.
    assert.equal(drag(state, LINE, "e7e5"), state)

    const replied = playOpponentReply(state, LINE)
    assert.ok(replied)
    state = replied
    assert.equal(state.ply, 2)
    assert.deepEqual(state.feedback, {
      result: "reply",
      san: "e5",
      played: "e4",
    })
    assert.deepEqual(state.lastMove, { from: "e7", to: "e5" })
    assert.equal(isLineLocked(state, LINE), false)
    assert.equal(playOpponentReply(state, LINE), null)

    state = drag(state, LINE, "g1f3")
    assert.equal(state.ply, 3)
    assert.deepEqual(state.feedback, { result: "solved", san: "Nf3" })
    assert.equal(isLineLocked(state, LINE), true)
    assert.equal(playOpponentReply(state, LINE), null)
  })

  test("a line ending on the opponent's move is solved by the reply", () => {
    const line = ["e2e4", "e7e5"]
    const state = playOpponentReply(
      drag(startPuzzleLine(START), line, "e2e4"),
      line
    )
    assert.deepEqual(state?.feedback, { result: "solved", san: "e5" })
    assert.equal(state && isLineLocked(state, line), true)
  })

  test("a wrong move is shown, locks the board and names the puzzle move", () => {
    const state = drag(startPuzzleLine(START), LINE, "d2d4")
    assert.equal(state.ply, 0)
    assert.notEqual(state.fen, START)
    assert.deepEqual(state.lastMove, { from: "d2", to: "d4" })
    assert.deepEqual(state.feedback, {
      result: "miss",
      san: "d4",
      expectedSan: "e4",
    })
    assert.equal(isLineLocked(state, LINE), true)
    assert.equal(drag(state, LINE, "c7c5"), state)
    assert.equal(playOpponentReply(state, LINE), null)
  })

  test("reset (a fresh start) unlocks the board after a miss", () => {
    assert.equal(
      isLineLocked(drag(startPuzzleLine(START), LINE, "d2d4"), LINE),
      true
    )

    const state = startPuzzleLine(START)
    assert.deepEqual(state, {
      fen: START,
      lastMove: null,
      ply: 0,
      feedback: null,
    })
    assert.equal(isLineLocked(state, LINE), false)
    assert.equal(drag(state, LINE, "e2e4").feedback?.result, "correct")
  })

  test("an illegal scripted reply stops the line instead of waiting", () => {
    const line = ["e2e4", "e7e4", "g1f3"]
    const state = drag(startPuzzleLine(START), line, "e2e4")
    const stopped = playOpponentReply(state, line)
    assert.ok(stopped)
    assert.deepEqual(stopped, { ...state, feedback: { result: "invalid" } })
    assert.equal(isLineLocked(stopped, line), true)
    // Settled: nothing more is due, so the board no longer waits on a reply.
    assert.equal(playOpponentReply(stopped, line), null)
    // An empty entry (e.g. a stray space in the source) stops it the same way.
    assert.equal(
      playOpponentReply(state, ["e2e4", "", "g1f3"])?.feedback?.result,
      "invalid"
    )
  })

  test("an expected move illegal in the position falls back to readable text", () => {
    const state = drag(startPuzzleLine(START), ["e2e5"], "d2d4")
    assert.equal(
      state.feedback?.result === "miss" && state.feedback.expectedSan,
      "e2 to e5"
    )
  })

  test("a dragged promotion becomes a queen", () => {
    const fen = "7k/4P3/8/8/8/8/8/K7 w - - 0 1"

    assert.deepEqual(drag(startPuzzleLine(fen), ["e7e8q"], "e7e8").feedback, {
      result: "solved",
      san: "e8=Q+",
    })
    assert.deepEqual(drag(startPuzzleLine(fen), ["e7e8n"], "e7e8").feedback, {
      result: "miss",
      san: "e8=Q+",
      expectedSan: "e8=N",
    })
  })

  test("a line in progress is restored on return until it is reset", () => {
    const played = drag(startPuzzleLine(START), LINE, "e2e4")

    savePuzzleLine("p1", played)
    assert.deepEqual(restorePuzzleLine("p1", START), played)
    assert.deepEqual(restorePuzzleLine("p2", START), startPuzzleLine(START))

    savePuzzleLine("p1", startPuzzleLine(START))
    assert.deepEqual(restorePuzzleLine("p1", START), startPuzzleLine(START))
  })
})
