import { Chess, type Move, type Square } from "chess.js"
import type { DrawShape } from "@lichess-org/chessground/draw"
import type * as cg from "@lichess-org/chessground/types"

const SQUARE = /^[a-h][1-8]$/
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/i

export type PlayedMove = {
  from: string
  to: string
  promotion?: string
  uci: string
  san: string
  fen: string
}

function uciToMoveObject(uci: string) {
  const normalized = uci.toLowerCase()

  return {
    from: normalized.slice(0, 2),
    to: normalized.slice(2, 4),
    promotion: normalized[4],
  }
}

function moveToUci(move: { from: string; to: string; promotion?: string }) {
  return `${move.from}${move.to}${move.promotion ?? ""}`.toLowerCase()
}

function played(chess: Chess, move: Move): PlayedMove {
  return {
    from: move.from,
    to: move.to,
    promotion: move.promotion,
    uci: moveToUci(move),
    san: move.san,
    fen: chess.fen(),
  }
}

/** Applies a UCI move in place. Returns false (and leaves the position untouched) if it is illegal. */
export function applyUciMove(chess: Chess, uci: string): boolean {
  try {
    chess.move(uciToMoveObject(uci))
    return true
  } catch {
    return false
  }
}

/** Resolves UCI (`g1f3`, `e7e8q`) or SAN (`Nf3`, `O-O`) text against a FEN. Null unless legal. */
export function resolveMove(fen: string, text: string): PlayedMove | null {
  try {
    const chess = new Chess(fen)
    const move = chess.move(UCI.test(text) ? uciToMoveObject(text) : text)
    return played(chess, move)
  } catch {
    return null
  }
}

/**
 * Applies a from/to pair (drag-and-drop or typed UCI). A pawn reaching the last
 * rank without a stated promotion becomes a queen, matching what the board does.
 */
export function playMove(
  fen: string,
  from: string,
  to: string,
  promotion?: string
): PlayedMove | null {
  try {
    const chess = new Chess(fen)
    const piece = chess.get(from as Square)
    const promotesTo =
      promotion ?? (piece?.type === "p" && /[18]$/.test(to) ? "q" : undefined)
    return played(chess, chess.move({ from, to, promotion: promotesTo }))
  } catch {
    return null
  }
}

/**
 * Model grammar: one move, optionally wrapped in code fences or backticks,
 * prefixed with a move number, or suffixed with punctuation. Anything with
 * internal whitespace is rejected. Returns the move as UCI.
 */
export function parseAcceptedMoveAnswer(
  answer: string,
  fen: string
): string | null {
  const normalized = normalizeMoveAnswer(answer)

  return normalized ? (resolveMove(fen, normalized)?.uci ?? null) : null
}

function normalizeMoveAnswer(answer: string): string {
  let normalized = answer
    .trim()
    .replaceAll("×", "x")
    .replaceAll("–", "-")
    .replaceAll("—", "-")

  const fenced = normalized.match(
    /^```(?:text|chess|pgn)?\s*([\s\S]*?)\s*```$/i
  )
  if (fenced?.[1]) {
    normalized = fenced[1].trim()
  }

  const wrapped = normalized.match(/^`([^`\n]+)`$/)
  if (wrapped?.[1]) {
    normalized = wrapped[1].trim()
  }

  normalized = normalized.replace(/^\d+\.(?:\.\.)?\s*/, "")
  normalized = normalized.replace(/[.!?]+$/g, "")

  if (/^0-0(?:-0)?[+#]?$/i.test(normalized)) {
    normalized = normalized.replaceAll("0", "O")
  }

  return /\s/.test(normalized) ? "" : normalized
}

const UCI_INPUT = /^([a-h][1-8])-?([a-h][1-8])([qrbn]?)$/
const CASTLE_INPUT = /^[o0](?:-?[o0]){1,2}$/i

/**
 * Human grammar: whitespace is ignored, `e2-e4` and `o-o`/`0-0-0` are accepted,
 * a lowercase piece letter is retried capitalised, and a UCI promotion defaults
 * to a queen. Everything still resolves through chess.js, so an illegal entry is
 * rejected exactly the way the board rejects an illegal drag.
 */
export function parseMoveInput(fen: string, input: string): PlayedMove | null {
  const text = input.replace(/\s+/g, "")

  if (!text) {
    return null
  }

  const uci = UCI_INPUT.exec(text.toLowerCase())

  if (uci) {
    return playMove(fen, uci[1], uci[2], uci[3] || undefined)
  }

  const san = CASTLE_INPUT.test(text)
    ? text.replace(/-/g, "").length === 3
      ? "O-O-O"
      : "O-O"
    : text

  // `bxc3` is a pawn capture and `Bxc3` a bishop capture, so the literal text is
  // always tried first; the capitalised form is only a fallback for people who
  // type `nf3`.
  return (
    resolveMove(fen, san) ??
    resolveMove(fen, san.charAt(0).toUpperCase() + san.slice(1))
  )
}

export function readableMove(uci: string) {
  if (!uci) {
    return ""
  }

  const { from, to, promotion } = uciToMoveObject(uci)

  if (!SQUARE.test(from) || !SQUARE.test(to)) {
    return uci
  }

  return `${from} to ${to}${promotion ? `, promote to ${promotion.toUpperCase()}` : ""}`
}

export function boardOnlyFen(fen: string) {
  return fen.split(" ")[0] ?? fen
}

export function turnColor(fen: string): cg.Color {
  try {
    return new Chess(fen).turn() === "w" ? "white" : "black"
  } catch {
    return "white"
  }
}

export function isCheck(fen: string) {
  try {
    return new Chess(fen).isCheck()
  } catch {
    return false
  }
}

export function legalDests(fen: string): cg.Dests {
  const dests: cg.Dests = new Map()

  try {
    for (const move of new Chess(fen).moves({ verbose: true })) {
      const existing = dests.get(move.from)

      if (existing) {
        existing.push(move.to)
      } else {
        dests.set(move.from, [move.to])
      }
    }
  } catch {
    // Invalid positions render as view-only with no legal destinations.
  }

  return dests
}

export function moveArrow(uci: string): DrawShape | null {
  const { from, to } = uciToMoveObject(uci)

  if (!SQUARE.test(from) || !SQUARE.test(to)) {
    return null
  }

  return {
    orig: from as cg.Key,
    dest: to as cg.Key,
    brush: "red",
    modifiers: { lineWidth: 12 },
  }
}

type BoardPiece = NonNullable<ReturnType<Chess["board"]>[number][number]>

const PIECE_NAMES: Record<string, string> = {
  k: "king",
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
  p: "pawn",
}

const PIECE_ORDER = ["k", "q", "r", "b", "n", "p"] as const

function describeSide(pieces: BoardPiece[]) {
  const groups = PIECE_ORDER.map((type) => {
    const squares = pieces
      .filter((piece) => piece.type === type)
      .map((piece) => piece.square)

    if (squares.length === 0) {
      return null
    }

    const name = PIECE_NAMES[type]
    return `${squares.length > 1 ? `${name}s` : name} ${squares.join(", ")}`
  }).filter((group): group is string => group !== null)

  return groups.length > 0 ? groups.join("; ") : "no pieces"
}

/**
 * A text alternative for the board: assistive tech otherwise gets an empty box
 * where the position should be. Pieces are grouped by type so a full position
 * reads as a short list instead of 32 separate squares.
 */
export function piecesSummary(fen: string) {
  let pieces: BoardPiece[]

  try {
    pieces = new Chess(fen)
      .board()
      .flat()
      .filter((square): square is BoardPiece => square !== null)
  } catch {
    return "position unavailable"
  }

  const white = describeSide(pieces.filter((piece) => piece.color === "w"))
  const black = describeSide(pieces.filter((piece) => piece.color === "b"))

  return `White: ${white}. Black: ${black}.`
}

export function boardSummary(fen: string) {
  const color = turnColor(fen)
  const check = isCheck(fen) ? ", in check" : ""

  return `Chess position. ${color === "white" ? "White" : "Black"} to move${check}. ${piecesSummary(fen)}`
}
