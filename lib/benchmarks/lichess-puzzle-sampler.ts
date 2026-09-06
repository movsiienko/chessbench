import { createHash } from "node:crypto"
import { parseCsvRecords } from "./csv"
import {
  buildPuzzleItem,
  LICHESS_PUZZLE_COLUMNS,
  parsePuzzleRow,
  RATING_BANDS,
} from "./lichess-puzzle-builder"
import type {
  LichessPuzzleBenchmarkItem,
  RatingBandId,
} from "./lichess-puzzles"

type Candidate = {
  hashKey: string
  item: LichessPuzzleBenchmarkItem
}

type SamplingOptions = {
  seed: string
  perBand: number
}

/** Select the lowest seeded hashes per band, retaining only legally built items. */
export async function sampleLichessPuzzles(
  lines: Iterable<string> | AsyncIterable<string>,
  { seed, perBand }: SamplingOptions
) {
  if (!Number.isInteger(perBand) || perBand < 1) {
    throw new Error("perBand must be a positive integer.")
  }

  const selectedByBand = new Map<RatingBandId, Candidate[]>(
    RATING_BANDS.map((band) => [band.id, []])
  )
  const passingFiltersByBand = new Map<RatingBandId, number>(
    RATING_BANDS.map((band) => [band.id, 0])
  )
  const sourceStats = {
    rowsSeen: 0,
    rowsParsed: 0,
    rowsPassingFilters: 0,
    rowsBuilt: 0,
    rowsWithInvalidColumns: 0,
    rowsRejectedByQuality: 0,
    rowsRejectedAsMateInOne: 0,
    rowsRejectedAsIllegal: 0,
  }
  const rejectionStat = {
    invalidColumns: "rowsWithInvalidColumns",
    quality: "rowsRejectedByQuality",
    mateIn1: "rowsRejectedAsMateInOne",
  } as const

  let headerVerified = false

  for await (const line of lines) {
    if (!headerVerified) {
      if (
        parseCsvRecords(line)[0]?.join(",") !== LICHESS_PUZZLE_COLUMNS.join(",")
      ) {
        throw new Error(`Unexpected CSV header: ${line}`)
      }
      headerVerified = true
      continue
    }

    sourceStats.rowsSeen += 1
    const parsed = parsePuzzleRow(line)

    if ("rejected" in parsed) {
      if (parsed.rejected !== "invalidColumns") {
        sourceStats.rowsParsed += 1
      }
      sourceStats[rejectionStat[parsed.rejected]] += 1
      continue
    }

    sourceStats.rowsParsed += 1
    sourceStats.rowsPassingFilters += 1
    const bandId = parsed.band.id
    passingFiltersByBand.set(
      bandId,
      (passingFiltersByBand.get(bandId) ?? 0) + 1
    )

    const candidates = selectedByBand.get(bandId) ?? []
    const hashKey = createHash("sha256")
      .update(`${seed}:${parsed.row.PuzzleId}`)
      .digest("hex")
    const slot = candidateSlot(candidates, hashKey, perBand)

    if (slot < 0) {
      continue
    }

    // Validate only competitive candidates, and never evict a legal item
    // until the replacement's complete line has passed chess.js validation.
    const item = buildPuzzleItem(parsed)

    if (item === null) {
      sourceStats.rowsRejectedAsIllegal += 1
      continue
    }

    sourceStats.rowsBuilt += 1
    candidates[slot] = { hashKey, item }
  }

  if (!headerVerified) {
    throw new Error("Missing Lichess puzzle CSV header.")
  }

  const items = RATING_BANDS.flatMap((band) =>
    [...(selectedByBand.get(band.id) ?? [])]
      .sort((left, right) => left.hashKey.localeCompare(right.hashKey))
      .map((candidate) => candidate.item)
  )

  return {
    items,
    // Build/rejection counts describe work performed; only competitive rows
    // undergo legality checks, so these counts can depend on input order.
    sourceStats,
    ratingBands: RATING_BANDS.map((band) => ({
      id: band.id,
      label: band.label,
      min: band.min,
      max: Number.isFinite(band.max) ? band.max : null,
      eligible: passingFiltersByBand.get(band.id) ?? 0,
      selected: selectedByBand.get(band.id)?.length ?? 0,
    })),
  }
}

function candidateSlot(
  retained: Candidate[],
  hashKey: string,
  capacity: number
): number {
  if (retained.length < capacity) {
    return retained.length
  }

  let worst = 0

  for (let index = 1; index < retained.length; index += 1) {
    if (retained[index].hashKey > retained[worst].hashKey) {
      worst = index
    }
  }

  return hashKey < retained[worst].hashKey ? worst : -1
}
