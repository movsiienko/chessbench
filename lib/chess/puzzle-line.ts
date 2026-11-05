import { resolveMove, type PlayedMove } from "./moves"

type PuzzleFeedback =
  | { result: "correct" | "solved"; san: string }
  // `played` is the solver move the reply answered, announced with it so the
  // "correct" message is not cut off by the reply that follows.
  | { result: "reply"; san: string; played: string }
  // `before` is the position the wrong move was played from, so Show solution
  // can take it back. The expected move is deliberately not stored here: a
  // miss must not give the answer away.
  | {
      result: "miss"
      san: string
      before: Pick<PuzzleLineState, "fen" | "lastMove">
    }
  // The solver asked for the move instead of finding it.
  | { result: "shown"; san: string }
  // Bad puzzle data: the scripted reply is not legal, so the line stops here.
  | { result: "invalid" }

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
  /** Show solution was used at least once, so the line is not a clean solve. */
  shown: boolean
}

export function startPuzzleLine(fen: string): PuzzleLineState {
  return { fen, lastMove: null, ply: 0, feedback: null, shown: false }
}

// ponytail: in memory, so progress is lost on reload; move to sessionStorage
// if it should survive one.
const savedLines = new Map<string, PuzzleLineState>()

/** The line as the solver left it on this puzzle, else a fresh one. */
export function restorePuzzleLine(id: string, fen: string): PuzzleLineState {
  return savedLines.get(id) ?? startPuzzleLine(fen)
}

/** Remember a line in progress so leaving the puzzle does not lose it. */
export function savePuzzleLine(id: string, state: PuzzleLineState) {
  if (state.lastMove) {
    savedLines.set(id, state)
  } else {
    savedLines.delete(id)
  }
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
        before: { fen: state.fen, lastMove: state.lastMove },
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

/**
 * Plays the expected solver move for the user, taking back a wrong move first.
 * Returns the same state when no solver move is due (reply pending, line over,
 * or bad puzzle data), so callers can compare by identity to disable the control.
 */
export function showSolution(
  state: PuzzleLineState,
  line: string[]
): PuzzleLineState {
  const base =
    state.feedback?.result === "miss"
      ? { ...state, ...state.feedback.before, feedback: null }
      : state
  const expected = line[base.ply]
  const move = expected && resolveMove(base.fen, expected)

  if (!move || isLineLocked(base, line)) {
    return state
  }

  const played = playSolverMove(base, line, move)
  return {
    ...played,
    shown: true,
    // Ending the line by asking is not a solve.
    feedback: { result: "shown", san: move.san },
  }
}

/**
 * The scripted opponent reply, or null when none is due. An illegal reply
 * stops the line with "invalid" feedback instead of leaving it waiting.
 */
export function playOpponentReply(
  state: PuzzleLineState,
  line: string[]
): PuzzleLineState | null {
  const reply = line[state.ply]

  if (
    state.feedback?.result === "miss" ||
    state.feedback?.result === "invalid" ||
    state.ply % 2 === 0 ||
    reply === undefined
  ) {
    return null
  }

  const move = resolveMove(state.fen, reply)

  if (!move) {
    return { ...state, feedback: { result: "invalid" } }
  }

  const ply = state.ply + 1
  return {
    ...state,
    fen: move.fen,
    lastMove: { from: move.from, to: move.to },
    ply,
    feedback:
      ply >= line.length
        ? { result: "solved", san: move.san }
        : { result: "reply", san: move.san, played: state.feedback?.san ?? "" },
  }
}
