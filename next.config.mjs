import { dirname } from "node:path"
import { withWorkflow } from "workflow/next"
import { fileURLToPath } from "node:url"

const appRoot = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: appRoot,
  },
  // Revalidation re-runs the page on a function, which reads the item set.
  outputFileTracingIncludes: {
    "/": ["./data/benchmarks/lichess-puzzles-v1/items.jsonl"],
  },
}

export default withWorkflow(nextConfig)
