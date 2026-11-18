import { createHash } from "node:crypto"
import { createWriteStream, existsSync, mkdirSync, renameSync } from "node:fs"
import { writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { Transform } from "node:stream"
import { pipeline } from "node:stream/promises"
import { verifiedProvenance } from "./lichess-files"

const sourceUrl = "https://database.lichess.org/lichess_db_puzzle.csv.zst"
const destination =
  process.argv
    .find((arg) => arg.startsWith("--out="))
    ?.slice("--out=".length) ?? "data/raw/lichess/lichess_db_puzzle.csv.zst"
const force = process.argv.includes("--force")

const sidecar = `${destination}.provenance.json`

// An existing dump counts only if it matches its sidecar; a pair left
// mismatched by an interrupted --force download fails here.
if (existsSync(destination) && !force) {
  await verifiedProvenance(destination).catch((error: Error) => {
    throw new Error(`${error.message} Pass --force to download it again.`)
  })
  console.log(`${destination} already exists. Pass --force to replace it.`)
  process.exit(0)
}

mkdirSync(dirname(destination), { recursive: true })

const retrievalStartedAt = new Date().toISOString()
const response = await fetch(sourceUrl)

if (!response.ok || response.body === null) {
  throw new Error(`Failed to download ${sourceUrl}: ${response.status}`)
}

console.log(`Downloading ${response.url}`)

const hash = createHash("sha256")
let bytes = 0
// Per process, so concurrent downloads never share a staging file.
const partial = `${destination}.${process.pid}.part`

await pipeline(
  response.body,
  new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk)
      bytes += chunk.length
      callback(null, chunk)
    },
  }),
  createWriteStream(partial)
)

const contentLength = response.headers.get("content-length")

if (contentLength !== null && Number(contentLength) !== bytes) {
  throw new Error(`Expected ${contentLength} bytes, received ${bytes}.`)
}

// Read by prepare-lichess-puzzles.ts so each manifest records the provenance
// of the file it was built from, not of an earlier download.
const provenance = {
  sourceUrl,
  finalUrl: response.url,
  retrievalStartedAt,
  retrievalFinishedAt: new Date().toISOString(),
  lastModified: response.headers.get("last-modified"),
  etag: response.headers.get("etag"),
  contentLength: contentLength === null ? null : Number(contentLength),
  bytes,
  sha256: hash.digest("hex"),
}

await writeFile(sidecar, `${JSON.stringify(provenance, null, 2)}\n`)
renameSync(partial, destination)

console.log(JSON.stringify(provenance, null, 2))
