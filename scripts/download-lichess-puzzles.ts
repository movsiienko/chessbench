import { createWriteStream, existsSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import type { ReadableStream as NodeReadableStream } from "node:stream/web"

const sourceUrl = "https://database.lichess.org/lichess_db_puzzle.csv.zst"
const destination =
  process.argv
    .find((arg) => arg.startsWith("--out="))
    ?.slice("--out=".length) ?? "data/raw/lichess/lichess_db_puzzle.csv.zst"
const force = process.argv.includes("--force")

if (existsSync(destination) && !force) {
  console.log(`${destination} already exists. Pass --force to replace it.`)
  process.exit(0)
}

mkdirSync(dirname(destination), { recursive: true })

const response = await fetch(sourceUrl)

if (!response.ok || response.body === null) {
  throw new Error(`Failed to download ${sourceUrl}: ${response.status}`)
}

console.log(`Downloading ${sourceUrl}`)
console.log(`Writing ${destination}`)

await pipeline(
  Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>),
  createWriteStream(destination)
)

console.log("Download complete.")
