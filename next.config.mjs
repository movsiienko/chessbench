import { dirname } from "node:path"
import { withWorkflow } from "workflow/next"
import { fileURLToPath } from "node:url"

const appRoot = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tag pages were folded into the Problems theme filter; keep old links alive.
  async redirects() {
    return [
      {
        source: "/tags/:tag",
        destination: "/puzzles?theme=:tag",
        permanent: true,
      },
    ]
  },
  turbopack: {
    root: appRoot,
  },
  // Types are checked once, by `bun run typecheck` in CI, not again in the build.
  typescript: {
    ignoreBuildErrors: true,
  },
  // Revalidation re-runs a page on a function, and every dashboard route reads
  // the item set and its manifest through the shared layout.
  outputFileTracingIncludes: {
    "/**": [
      "./data/benchmarks/lichess-puzzles-v1/items.jsonl",
      "./data/benchmarks/lichess-puzzles-v1/manifest.json",
    ],
  },
}

export default withWorkflow(nextConfig)
