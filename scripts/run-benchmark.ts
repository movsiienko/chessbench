import {
  runLichessPuzzleBenchmark,
  type BenchmarkRunOptions,
} from "@/lib/benchmarks/benchmark-run"
import {
  isReasoningEffort,
  type ReasoningEffort,
} from "@/lib/benchmarks/models"

const result = await runLichessPuzzleBenchmark(
  parseArgs(process.argv.slice(2)),
  {
    onProgress: ({ row, completed, total }) => {
      console.log(
        [
          `[${completed}/${total}]`,
          row.model,
          row.itemId,
          row.status,
          `solved=${row.solved}`,
          row.costUsd === null ? "" : `cost=${row.costUsd.toFixed(6)}`,
        ]
          .filter(Boolean)
          .join(" ")
      )
    },
  }
)
console.log(`Wrote ${result.attemptCount} rows to ${result.localPath}`)

function parseArgs(args: string[]): BenchmarkRunOptions {
  const models: string[] = []
  let limit = 10
  let all = false
  let canonical: string | null = null
  let reasoningEffort: ReasoningEffort = "low"
  let maxOutputTokens: number | null = null
  let gatewaySystemCredentials = false

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === "--model") {
      models.push(readArgValue(args, index, "--model"))
      index += 1
      continue
    }

    if (arg === "--limit") {
      limit = Number(readArgValue(args, index, "--limit"))
      index += 1
      continue
    }

    if (arg === "--all") {
      all = true
      continue
    }

    if (arg === "--canonical") {
      canonical = readArgValue(args, index, "--canonical")
      index += 1
      continue
    }

    if (arg === "--reasoning-effort") {
      const value = readArgValue(args, index, "--reasoning-effort")
      if (!isReasoningEffort(value)) {
        throw new Error(
          "--reasoning-effort must be one of none, minimal, low, medium, high, or xhigh"
        )
      }
      reasoningEffort = value
      index += 1
      continue
    }

    if (arg === "--max-output-tokens") {
      maxOutputTokens = Number(readArgValue(args, index, "--max-output-tokens"))
      index += 1
      continue
    }

    if (arg === "--gateway-system-credentials") {
      gatewaySystemCredentials = true
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return {
    models,
    limit,
    all,
    canonical,
    reasoningEffort,
    maxOutputTokens,
    gatewaySystemCredentials,
  }
}

function readArgValue(args: string[], index: number, name: string): string {
  const value = args[index + 1]

  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`)
  }

  return value
}
