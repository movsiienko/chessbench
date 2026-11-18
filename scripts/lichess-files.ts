// File helpers shared by the Lichess puzzle dataset scripts.
import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { createReadStream, existsSync, readFileSync } from "node:fs"
import { createInterface } from "node:readline"
import { z } from "zod"

/** Lines of a CSV, decompressing .zst through zstdcat. */
export async function* readLines(path: string): AsyncGenerator<string> {
  if (!path.endsWith(".zst")) {
    yield* createInterface({
      input: createReadStream(path),
      crlfDelay: Infinity,
    })
    return
  }

  const child = spawn("zstdcat", [path], {
    stdio: ["ignore", "pipe", "inherit"],
  })
  const closed = new Promise<number | null>((resolve) =>
    child.once("close", resolve)
  )
  yield* createInterface({ input: child.stdout, crlfDelay: Infinity })
  const exitCode = await closed
  if (exitCode !== 0) {
    throw new Error(`zstdcat exited with code ${exitCode} on ${path}`)
  }
}

const provenance = z
  .object({ bytes: z.number().int(), sha256: z.string() })
  .passthrough()

/** The file's download sidecar, after checking its bytes and SHA-256. */
export async function verifiedProvenance(path: string) {
  const sidecar = `${path}.provenance.json`
  if (!existsSync(sidecar)) {
    throw new Error(
      `Missing ${sidecar}. Download with "bun run datasets:lichess:download".`
    )
  }
  const recorded = provenance.parse(JSON.parse(readFileSync(sidecar, "utf8")))
  const hash = createHash("sha256")
  let bytes = 0
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk)
    bytes += chunk.length
  }
  if (bytes !== recorded.bytes || hash.digest("hex") !== recorded.sha256) {
    throw new Error(`${path} does not match ${sidecar}.`)
  }
  return recorded
}

/** The game id in a Lichess game URL, or in a CSV row holding one. */
export function gameIdOf(text: string): string {
  const id = text.match(/lichess\.org\/(?:game\/)?(\w{8})\b/)?.[1]
  if (!id) throw new Error(`No Lichess game id in ${text}`)
  return id
}

const gameDate = z.object({
  id: z.string(),
  createdAt: z.number().int().nullable(),
})

/** game-dates.ndjson: game id -> createdAt ms, or null when Lichess did not return the game. */
export function readGameDates(path: string): Map<string, number | null> {
  const dates = new Map<string, number | null>()
  if (!existsSync(path)) return dates
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (line) {
      const { id, createdAt } = gameDate.parse(JSON.parse(line))
      dates.set(id, createdAt)
    }
  }
  return dates
}
