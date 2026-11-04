import { readableMove, resolveMove, type PlayedMove } from "./moves"

type PuzzleFeedback =
  | { result: "correct" | "solved"; san: string }
  // `played` is the solver move the reply answered, announced with it so the
  // "correct" message is not cut off by the reply that follows.
  | { result: "reply"; san: string; played: string }
  | { result: "miss"; san: string; expectedSan: string }

/**
 * Progress through a puzzle line. The line alternates solver and opponent
 * moves, starting with the solver, so an odd `ply` means the scripted reply is
 * due.
 */
export type PuzzleLineState = {
  fen: string
  lastMove: { from: string; to: string } | null
  ply: number
  feedback: PuzzleFeedback | null
}

export function startPuzzleLine(fen: string): PuzzleLineState {
  return { fen, lastMove: null, ply: 0, feedback: null }
}

/** The board takes no input after a miss, once solved, or while the reply is due. */
export function isLineLocked(state: PuzzleLineState, line: string[]) {
  return (
    state.feedback?.result === "miss" ||
    state.ply >= line.length ||
    state.ply % 2 === 1
  )
}

/** The solver's move. A wrong one is shown on the board and locks it. */
export function playSolverMove(
  state: PuzzleLineState,
  line: string[],
  move: PlayedMove
): PuzzleLineState {
  const expected = line[state.ply]

  if (isLineLocked(state, line) || !expected) {
    return state
  }

  const moved = {
    ...state,
    fen: move.fen,
    lastMove: { from: move.from, to: move.to },
  }

  if (move.uci.toLowerCase() !== expected.toLowerCase()) {
    return {
      ...moved,
      feedback: {
        result: "miss",
        san: move.san,
        // DESIGN.md forbids raw UCI in user-facing feedback when SAN is
        // available, so the expected move is resolved against the position the
        // user moved from.
        expectedSan:
          resolveMove(state.fen, expected)?.san ?? readableMove(expected),
      },
    }
  }

  return {
    ...moved,
    ply: state.ply + 1,
    feedback: {
      result: state.ply + 1 >= line.length ? "solved" : "correct",
      san: move.san,
    },
  }
}

/** The scripted opponent reply, or null when none is due (or it is illegal). */
export function playOpponentReply(
  state: PuzzleLineState,
  line: string[]
): PuzzleLineState | null {
  const reply = line[state.ply]

  if (state.feedback?.result === "miss" || state.ply % 2 === 0 || !reply) {
    return null
  }

  const move = resolveMove(state.fen, reply)

  if (!move) {
    return null
  }

  const ply = state.ply + 1
  return {
    fen: move.fen,
    lastMove: { from: move.from, to: move.to },
    ply,
    feedback:
      ply >= line.length
        ? { result: "solved", san: move.san }
        : { result: "reply", san: move.san, played: state.feedback?.san ?? "" },
  }
}
