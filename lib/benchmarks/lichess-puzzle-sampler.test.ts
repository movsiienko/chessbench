import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, test } from "node:test"
import { escapeCsv } from "./csv"
import { LICHESS_PUZZLE_COLUMNS } from "./lichess-puzzle-builder"
import { sampleLichessPuzzles } from "./lichess-puzzle-sampler"
import type { LichessPuzzleBenchmarkItem } from "./lichess-puzzles"

const header = LICHESS_PUZZLE_COLUMNS.join(",")
const seed = "sampling-regression"
const ratings = [1000, 1400, 1800, 2200, 2600]
const bands = ["under-1200", "1200-1599", "1600-1999", "2000-2399", "2400-plus"]
const legalMoves = "g2e4 c2c4 b5c4 b3c4 d5c4 e3e4"
const sourceRows = ratings.flatMap((rating) =>
  Array.from({ length: 6 }, (_, index) => ({
    id: `puzzle-${rating}-${index}`,
    rating,
  }))
)

function csvRow(id: string, rating: number, moves = legalMoves) {
  return [
    id,
    "8/p5pp/5p2/1p1k4/4P1PB/1P2K3/P1P3bP/8 b - - 0 30",
    moves,
    rating,
    87,
    93,
    508,
    "bishopEndgame crushing endgame long",
    "https://lichess.org/m4QTuikA/black#60",
    "",
  ]
    .map(escapeCsv)
    .join(",")
}

function priority(id: string, samplingSeed = seed) {
  return createHash("sha256").update(`${samplingSeed}:${id}`).digest("hex")
}

function expectedIds(samplingSeed: string, perBand: number) {
  // An independent full sort is the oracle for the streaming selection.
  return ratings.flatMap((rating) =>
    sourceRows
      .filter((row) => row.rating === rating)
      .sort((left, right) =>
        priority(left.id, samplingSeed).localeCompare(
          priority(right.id, samplingSeed)
        )
      )
      .slice(0, perBand)
      .map((row) => `lichess:${row.id}`)
  )
}

describe("sampleLichessPuzzles", () => {
  test("selects seeded membership and order across bands and input orders", async () => {
    const rows = sourceRows.map((row) => csvRow(row.id, row.rating))
    const forward = await sampleLichessPuzzles([header, ...rows], {
      seed,
      perBand: 2,
    })
    const reversed = await sampleLichessPuzzles(
      [header, ...rows.toReversed()],
      {
        seed,
        perBand: 2,
      }
    )
    async function* interleavedLines() {
      yield header
      for (let index = 0; index < rows.length; index += 2) {
        yield rows[index + 1]
        yield rows[index]
      }
    }
    const streamed = await sampleLichessPuzzles(interleavedLines(), {
      seed,
      perBand: 2,
    })

    assert.deepEqual(
      forward.items.map((item) => item.id),
      expectedIds(seed, 2)
    )
    assert.deepEqual(reversed.items, forward.items)
    assert.deepEqual(streamed.items, forward.items)
    assert.deepEqual(
      forward.ratingBands.map((band) => band.id),
      bands
    )
    assert.deepEqual(reversed.ratingBands, forward.ratingBands)
    for (const band of forward.ratingBands) {
      assert.equal(band.eligible, 6)
      assert.equal(band.selected, 2)
    }
    assert.equal(forward.sourceStats.rowsSeen, 30)
    assert.equal(forward.sourceStats.rowsPassingFilters, 30)

    const anotherSeed = "a-different-sample"
    const changed = await sampleLichessPuzzles([header, ...rows], {
      seed: anotherSeed,
      perBand: 3,
    })
    assert.deepEqual(
      changed.items.map((item) => item.id),
      expectedIds(anotherSeed, 3)
    )
    assert.notDeepEqual(expectedIds(anotherSeed, 2), expectedIds(seed, 2))
  })

  test("filters before sampling and cannot evict a legal item with an illegal line", async () => {
    const ranked = sourceRows
      .filter((row) => row.rating === 1000)
      .sort((left, right) =>
        priority(left.id).localeCompare(priority(right.id))
      )
    const legal = [ranked[3], ranked[2]].map((row) =>
      csvRow(row.id, row.rating)
    )
    const competitiveIllegal = csvRow(
      ranked[0].id,
      1000,
      legalMoves.replace("e3e4", "e3e5")
    )
    const uncompetitiveIllegal = csvRow(
      ranked[5].id,
      1000,
      legalMoves.replace("e3e4", "e3e5")
    )
    const sample = await sampleLichessPuzzles(
      [
        header,
        ...legal,
        competitiveIllegal,
        uncompetitiveIllegal,
        "wrong,column,count",
        csvRow("low-quality", 1000).replace(",87,93,508,", ",87,79,508,"),
        csvRow("mate-in-one", 1000).replace("bishopEndgame", "mateIn1"),
      ],
      { seed, perBand: 2 }
    )

    assert.deepEqual(
      sample.items.map((item) => item.id),
      [`lichess:${ranked[2].id}`, `lichess:${ranked[3].id}`]
    )
    assert.deepEqual(sample.sourceStats, {
      rowsSeen: 7,
      rowsParsed: 6,
      rowsPassingFilters: 4,
      rowsBuilt: 2,
      rowsWithInvalidColumns: 1,
      rowsRejectedByQuality: 1,
      rowsRejectedAsMateInOne: 1,
      rowsRejectedAsIllegal: 1,
    })
    assert.equal(sample.ratingBands[0].eligible, 4)
    assert.equal(sample.ratingBands[0].selected, 2)
    assert.ok(sample.ratingBands.slice(1).every((band) => band.selected === 0))

    const illegalFirst = await sampleLichessPuzzles(
      [header, competitiveIllegal, ...legal],
      {
        seed,
        perBand: 2,
      }
    )
    assert.deepEqual(illegalFirst.items, sample.items)
  })

  test("reproduces all 500 tracked items and their order byte for byte", async () => {
    const original = await readFile(
      new URL(
        "../../data/benchmarks/lichess-puzzles-v1/items.jsonl",
        import.meta.url
      ),
      "utf8"
    )
    const lines = original.trim().split("\n")
    assert.equal(lines.length, 500)
    const source = lines.toReversed().map((line) => {
      // SAFETY: the tracked dataset contains one LichessPuzzleBenchmarkItem per line.
      const { position, expected, metadata } = JSON.parse(
        line
      ) as LichessPuzzleBenchmarkItem
      return [
        metadata.lichessPuzzleId,
        position.triggerFen,
        [position.triggerMove, ...expected.uciLine].join(" "),
        metadata.rating,
        metadata.ratingDeviation,
        metadata.popularity,
        metadata.nbPlays,
        metadata.themes.join(" "),
        metadata.lichessGameUrl,
        metadata.openingTags.join(" "),
      ]
        .map(escapeCsv)
        .join(",")
    })
    const sample = await sampleLichessPuzzles([header, ...source], {
      seed: "lichess-puzzles-v1",
      perBand: 100,
    })
    assert.equal(
      sample.items.map((item) => JSON.stringify(item)).join("\n") + "\n",
      original
    )
    assert.ok(sample.ratingBands.every((band) => band.selected === 100))
  })

  test("rejects invalid capacity, missing headers, and interrupted sources", async () => {
    for (const perBand of [0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      await assert.rejects(
        sampleLichessPuzzles([header], { seed, perBand }),
        /positive integer/
      )
    }
    await assert.rejects(
      sampleLichessPuzzles([], { seed, perBand: 1 }),
      /Missing.*header/
    )
    await assert.rejects(
      sampleLichessPuzzles(["wrong,header"], { seed, perBand: 1 }),
      /Unexpected CSV header/
    )
    async function* interruptedLines() {
      yield header
      yield csvRow("valid", 1000)
      throw new Error("source interrupted")
    }
    await assert.rejects(
      sampleLichessPuzzles(interruptedLines(), { seed, perBand: 1 }),
      /source interrupted/
    )
  })

  test("the preparation CLI writes the sampled items and matching manifest", async () => {
    const directory = await mkdtemp(join(tmpdir(), "chessbench-sampling-"))
    try {
      const sourcePath = join(directory, "source.csv")
      const outDir = join(directory, "dataset")
      const rows = sourceRows.map((row) => csvRow(row.id, row.rating))
      const csv = [header, ...rows].join("\n") + "\n"
      await writeFile(sourcePath, csv)
      const result = spawnSync(
        process.execPath,
        [
          "scripts/prepare-lichess-puzzles.ts",
          `--source=${sourcePath}`,
          `--out=${outDir}`,
          "--per-band=2",
          `--seed=${seed}`,
        ],
        {
          cwd: new URL("../../", import.meta.url),
          encoding: "utf8",
          timeout: 30_000,
        }
      )
      assert.equal(result.status, 0, result.stderr || result.error?.message)
      const sample = await sampleLichessPuzzles([header, ...rows], {
        seed,
        perBand: 2,
      })
      assert.equal(
        await readFile(join(outDir, "items.jsonl"), "utf8"),
        sample.items.map((item) => JSON.stringify(item)).join("\n") + "\n"
      )
      const manifest = JSON.parse(
        await readFile(join(outDir, "manifest.json"), "utf8")
      )
      assert.equal(manifest.selection.seed, seed)
      assert.equal(manifest.selection.targetPerRatingBand, 2)
      assert.equal(manifest.selection.totalItems, 10)
      assert.deepEqual(manifest.selection.ratingBands, sample.ratingBands)
      assert.deepEqual(manifest.sourceStats, sample.sourceStats)
      assert.equal(manifest.source.localRawBytes, Buffer.byteLength(csv))
      assert.equal(
        manifest.source.localRawSha256,
        createHash("sha256").update(csv).digest("hex")
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
