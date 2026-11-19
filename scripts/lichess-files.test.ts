import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { verifiedProvenance } from "./lichess-files"

test("verifiedProvenance checks the file and a real retrieval time", async () => {
  const directory = await mkdtemp(join(tmpdir(), "chessbench-provenance-"))
  try {
    const path = join(directory, "dump.csv")
    await writeFile(path, "PuzzleId\n")
    const sidecar = {
      bytes: 9,
      sha256: createHash("sha256").update("PuzzleId\n").digest("hex"),
      lastModified: null,
      retrievalFinishedAt: "2026-11-06T12:16:50.581Z",
    }
    const withSidecar = (fields: Partial<typeof sidecar>) =>
      writeFile(
        `${path}.provenance.json`,
        JSON.stringify({ ...sidecar, ...fields })
      )

    await withSidecar({})
    assert.equal((await verifiedProvenance(path)).sha256, sidecar.sha256)

    await withSidecar({ retrievalFinishedAt: "not-a-date" })
    await assert.rejects(verifiedProvenance(path), /retrievalFinishedAt/)

    await withSidecar({ sha256: "0".repeat(64) })
    await assert.rejects(verifiedProvenance(path), /does not match/)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
