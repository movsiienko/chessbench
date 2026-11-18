// Step 1 of building lichess-puzzles-v2: keep the puzzles that pass the v2
// filters, are new since an older full dump, and come from a game created at
// or after a UTC threshold. Resumable: every stage caches to --cache, and
// fetched game dates are appended to game-dates.ndjson.
//
//   bun scripts/filter-lichess-puzzles-by-game-date.ts \
//     --source=<current dump .csv.zst> --baseline=<older full dump .csv.zst> \
//     --cache=<dir> --threshold=2026-06-01T00:00:00Z
//
// Both dumps need the .provenance.json sidecar written by
// download-lichess-puzzles.ts; their bytes and SHA-256 are checked against it.
// A puzzle already in the baseline dump cannot come from a game created after
// it, so those ids are dropped before any API call. Every remaining
// candidate's createdAt comes from the Lichess API; missing dates drop it.
import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import {
  appendFileSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import { createInterface } from "node:readline"
import { setTimeout as sleep } from "node:timers/promises"
import {
  buildPuzzleItem,
  parsePuzzleRow,
  RATING_BANDS,
  V2_QUALITY_FILTERS as filters,
} from "@/lib/benchmarks/lichess-puzzle-builder"
import { readHeader } from "@/lib/benchmarks/lichess-puzzle-sampler"
import { z } from "zod"

const sourcePath = requireOption("--source")
const baselinePath = requireOption("--baseline")
const cacheDir = requireOption("--cache")
const thresholdOption = requireOption("--threshold")
const threshold = Date.parse(thresholdOption)
const exportUrl =
  "https://lichess.org/api/games/export/_ids?moves=false&tags=false&clocks=false&evals=false&opening=false"
const exportedGame = z.object({ id: z.string(), createdAt: z.number().int() })
/** One game-dates.ndjson line; null when the export did not return the game. */
const gameDate = exportedGame.extend({
  createdAt: z.number().int().nullable(),
})
const batchSize = 300
const pauseMs = 2_000
const minBackoffMs = 60_000

if (!Number.isFinite(threshold) || !thresholdOption.endsWith("Z")) {
  throw new Error("--threshold must be an ISO timestamp in UTC (ending in Z).")
}

mkdirSync(cacheDir, { recursive: true })

const candidatesPath = join(cacheDir, "candidates.csv")
const candidateStatsPath = join(cacheDir, "candidates-stats.json")
const datesPath = join(cacheDir, "game-dates.ndjson")
const source = await verifiedProvenance(sourcePath)
const baseline = await verifiedProvenance(baselinePath)

if (!existsSync(candidatesPath)) {
  await writeCandidates()
}

const [header, ...candidates] = readFileSync(candidatesPath, "utf8")
  .trimEnd()
  .split("\n")
const columnCount = readHeader(header)
const dates = readDates()
const missing = [...new Set(candidates.map(gameIdOf))].filter(
  (id) => !dates.has(id)
)
console.log(
  `${candidates.length} candidates, ${dates.size} game dates cached, ${missing.length} to fetch`
)

for (let start = 0; start < missing.length; start += batchSize) {
  await fetchDates(missing.slice(start, start + batchSize))
  console.log(
    `${new Date().toISOString()} fetched ${Math.min(start + batchSize, missing.length)}/${missing.length}`
  )
  await sleep(pauseMs)
}

const qualifyingByBand = Object.fromEntries(
  RATING_BANDS.map((band) => [band.id, 0])
)
const excluded = { gameNotReturned: 0, beforeThreshold: 0 }
const qualifying = [header]

for (const line of candidates) {
  const createdAt = dates.get(gameIdOf(line))
  if (createdAt === null || createdAt === undefined) {
    excluded.gameNotReturned += 1
    continue
  }
  if (createdAt < threshold) {
    excluded.beforeThreshold += 1
    continue
  }
  const parsed = parsePuzzleRow(line, columnCount, filters)
  if ("rejected" in parsed) throw new Error(`Candidate rejected: ${line}`)
  qualifyingByBand[parsed.band.id] += 1
  qualifying.push(line)
}

writeFileSync(join(cacheDir, "qualifying.csv"), `${qualifying.join("\n")}\n`)

// Read by prepare-lichess-puzzles.ts for the v2 manifest.
const gate = {
  completedAt: new Date().toISOString(),
  thresholdUtc: new Date(threshold).toISOString(),
  source,
  baseline,
  dateSource: {
    endpoint: "POST https://lichess.org/api/games/export/_ids",
    field: "createdAt (epoch milliseconds, UTC)",
    requests: `at most ${batchSize} ids each, one at a time, ${pauseMs / 1000} s apart, at least ${minBackoffMs / 1000} s backoff on 429`,
  },
  funnel: {
    ...JSON.parse(readFileSync(candidateStatsPath, "utf8")),
    excludedGameNotReturned: excluded.gameNotReturned,
    excludedBeforeThreshold: excluded.beforeThreshold,
    qualifying: qualifying.length - 1,
    qualifyingByBand,
  },
}
writeFileSync(join(cacheDir, "gate.json"), `${JSON.stringify(gate, null, 2)}\n`)
console.log(JSON.stringify(gate.funnel, null, 2))

function gameIdOf(line: string) {
  const match = line.match(/,https:\/\/lichess\.org\/(?:game\/)?(\w{8})\b/)
  if (!match) throw new Error(`No game id in ${line}`)
  return match[1]
}

async function writeCandidates() {
  // ponytail: one in-memory Set of every baseline id (~6M short strings);
  // switch to a sorted-file merge if dumps outgrow the VM.
  const baselineIds = new Set<string>()
  let baselineHeader = true
  for await (const line of readZstdLines(baselinePath)) {
    if (baselineHeader) {
      readHeader(line)
      baselineHeader = false
      continue
    }
    baselineIds.add(line.slice(0, line.indexOf(",")))
  }

  const stats = {
    baselineIds: baselineIds.size,
    sourceRows: 0,
    rejectedInvalidColumns: 0,
    rejectedQuality: 0,
    rejectedMateIn1: 0,
    passingFilters: 0,
    inBaseline: 0,
    rejectedIllegal: 0,
    candidates: 0,
  }
  const rejectionStat = {
    invalidColumns: "rejectedInvalidColumns",
    quality: "rejectedQuality",
    mateIn1: "rejectedMateIn1",
  } as const
  const partial = `${candidatesPath}.part`
  const out = createWriteStream(partial)
  let count = 0

  for await (const line of readZstdLines(sourcePath)) {
    if (count === 0) {
      count = readHeader(line)
      out.write(`${line}\n`)
      continue
    }
    stats.sourceRows += 1
    const parsed = parsePuzzleRow(line, count, filters)
    if ("rejected" in parsed) {
      stats[rejectionStat[parsed.rejected]] += 1
      continue
    }
    stats.passingFilters += 1
    if (baselineIds.has(parsed.row.PuzzleId)) {
      stats.inBaseline += 1
      continue
    }
    if (buildPuzzleItem(parsed) === null) {
      stats.rejectedIllegal += 1
      continue
    }
    stats.candidates += 1
    out.write(`${line}\n`)
  }

  await new Promise<void>((resolve, reject) => {
    out.once("error", reject)
    out.end(() => resolve())
  })
  renameSync(partial, candidatesPath)
  writeFileSync(candidateStatsPath, `${JSON.stringify(stats, null, 2)}\n`)
}

/** The file's download sidecar, after checking its bytes and SHA-256. */
async function verifiedProvenance(path: string) {
  const provenance = JSON.parse(readFileSync(`${path}.provenance.json`, "utf8"))
  const hash = createHash("sha256")
  let bytes = 0
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk)
    bytes += chunk.length
  }
  if (bytes !== provenance.bytes || hash.digest("hex") !== provenance.sha256) {
    throw new Error(`${path} does not match its provenance sidecar.`)
  }
  return provenance
}

/** game id -> createdAt ms, or null when the export did not return the game. */
function readDates(): Map<string, number | null> {
  const map = new Map<string, number | null>()
  if (!existsSync(datesPath)) return map
  for (const line of readFileSync(datesPath, "utf8").split("\n")) {
    if (line) {
      const { id, createdAt } = gameDate.parse(JSON.parse(line))
      map.set(id, createdAt)
    }
  }
  return map
}

/** One request at a time; a batch is cached only once its stream completes. */
async function fetchDates(batch: string[]) {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(exportUrl, {
      method: "POST",
      headers: { Accept: "application/x-ndjson", "Content-Type": "text/plain" },
      body: batch.join(","),
    }).catch(() => undefined)
    const text = response?.ok ? await response.text().catch(() => null) : null

    if (text !== null) {
      const found = new Map<string, number>()
      for (const line of text.split("\n")) {
        if (!line) continue
        const game = exportedGame.parse(JSON.parse(line))
        found.set(game.id, game.createdAt)
      }
      const rows = batch.map((id) => {
        const createdAt = found.get(id) ?? null
        dates.set(id, createdAt)
        return JSON.stringify({ id, createdAt })
      })
      appendFileSync(datesPath, `${rows.join("\n")}\n`)
      return
    }

    const status = response?.status ?? "a network error"
    if (attempt >= 5) throw new Error(`Export failed 5 times: ${status}`)
    const retryAfter =
      (Number(response?.headers.get("retry-after")) || 0) * 1000
    const wait = Math.max(minBackoffMs, retryAfter)
    console.log(`Export returned ${status}; waiting ${wait / 1000}s`)
    await sleep(wait)
  }
}

async function* readZstdLines(path: string): AsyncGenerator<string> {
  const child = spawn("zstdcat", [path], {
    stdio: ["ignore", "pipe", "inherit"],
  })
  const closed = new Promise<number | null>((resolve) =>
    child.once("close", resolve)
  )
  for await (const line of createInterface({
    input: child.stdout,
    crlfDelay: Infinity,
  })) {
    yield line
  }
  if ((await closed) !== 0) throw new Error(`zstdcat failed on ${path}`)
}

function requireOption(name: string): string {
  const value = process.argv
    .find((argument) => argument.startsWith(`${name}=`))
    ?.slice(name.length + 1)
  if (!value) throw new Error(`Missing ${name}=`)
  return value
}
