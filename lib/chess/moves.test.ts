import assert from "node:assert/strict"
import { describe, test } from "node:test"
import {
  applyUciMove,
  parseAcceptedMoveAnswer,
  parseMoveInput,
  readableMove,
} from "./moves"
import { Chess } from "chess.js"

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
const CASTLING = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"
const PROMOTION = "7k/4P3/8/8/8/8/8/4K3 w - - 0 1"

describe("model move grammar", () => {
  test("rejects illegal UCI-shaped moves", () => {
    assert.equal(
      parseAcceptedMoveAnswer("a1b3", "8/8/8/8/8/8/8/R3K2k w - - 0 1"),
      null
    )
  })

  test("parses SAN captures against the supplied position", () => {
    assert.equal(
      parseAcceptedMoveAnswer("Rxa6", "8/8/r7/8/8/8/8/R3K2k w - - 0 1"),
      "a1a6"
    )
  })

  test("parses SAN edge-case notation", () => {
    const cases: Array<{
      answer: string
      fen: string
      expected: string
    }> = [
      {
        answer: "O-O",
        fen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
        expected: "e1g1",
      },
      {
        answer: "```chess\n0-0!\n```",
        fen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
        expected: "e1g1",
      },
      {
        answer: "0-0-0?",
        fen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
        expected: "e1c1",
      },
      {
        answer: "e8=Q+",
        fen: "7k/4P3/8/8/8/8/8/4K3 w - - 0 1",
        expected: "e7e8q",
      },
      {
        answer: "Nbd2",
        fen: "7k/8/8/8/8/5N2/8/1N2K3 w - - 0 1",
        expected: "b1d2",
      },
      {
        answer: "N1d2",
        fen: "7k/8/8/8/8/5N2/8/5NK1 w - - 0 1",
        expected: "f1d2",
      },
      {
        answer: "Raxe6",
        fen: "7k/8/R3p2R/8/8/8/8/4K3 w - - 0 1",
        expected: "a6e6",
      },
      {
        answer: "exd6",
        fen: "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1",
        expected: "e5d6",
      },
      {
        answer: "Qh4#",
        fen: "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2",
        expected: "d8h4",
      },
    ]

    for (const { answer, fen, expected } of cases) {
      assert.equal(parseAcceptedMoveAnswer(answer, fen), expected, answer)
    }
  })
})

describe("human move grammar", () => {
  test("accepts UCI with a dash and surrounding whitespace", () => {
    assert.equal(parseMoveInput(START, " e2 - e4 ")?.uci, "e2e4")
  })

  test("accepts castling spellings", () => {
    assert.equal(parseMoveInput(CASTLING, "o-o")?.uci, "e1g1")
    assert.equal(parseMoveInput(CASTLING, "0-0-0")?.uci, "e1c1")
  })

  test("retries a lowercase piece letter capitalised", () => {
    assert.equal(parseMoveInput(START, "nf3")?.san, "Nf3")
  })

  test("defaults a UCI promotion to a queen", () => {
    const move = parseMoveInput(PROMOTION, "e7e8")
    assert.equal(move?.uci, "e7e8q")
    assert.equal(move?.san, "e8=Q+")
    assert.equal(parseMoveInput(PROMOTION, "e7e8n")?.uci, "e7e8n")
  })

  test("rejects illegal and empty input", () => {
    assert.equal(parseMoveInput(START, "e2e5"), null)
    assert.equal(parseMoveInput(START, "Qxf7"), null)
    assert.equal(parseMoveInput(START, "   "), null)
  })
})

describe("UCI helpers", () => {
  test("applyUciMove reports legality without throwing", () => {
    const chess = new Chess(START)
    assert.equal(applyUciMove(chess, "E2E4"), true)
    assert.equal(applyUciMove(chess, "e2e4"), false)
    assert.equal(chess.turn(), "b")
  })

  test("readableMove spells out squares and promotions", () => {
    assert.equal(readableMove("c2c4"), "c2 to c4")
    assert.equal(readableMove("e7e8q"), "e7 to e8, promote to Q")
    assert.equal(readableMove("junk"), "junk")
    assert.equal(readableMove(""), "")
  })
})
