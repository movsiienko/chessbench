import type { LichessPuzzleAttemptRow } from "./local-runner"

export function parseCsvRecords(contents: string): string[][] {
  const records: string[][] = []
  let record: string[] = []
  let field = ""
  let quoted = false
  let fieldStarted = false

  const pushField = () => {
    record.push(field)
    field = ""
    fieldStarted = false
  }

  const pushRecord = () => {
    pushField()

    if (record.length > 1 || record.some((value) => value.length > 0)) {
      records.push(record)
    }

    record = []
  }

  for (let index = 0; index < contents.length; index += 1) {
    const char = contents[index]

    if (quoted) {
      if (char === '"' && contents[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
      continue
    }

    if (char === ",") {
      pushField()
    } else if (char === "\r" || char === "\n") {
      if (char === "\r" && contents[index + 1] === "\n") {
        index += 1
      }
      pushRecord()
    } else if (char === '"' && !fieldStarted && field.length === 0) {
      quoted = true
      fieldStarted = true
    } else {
      field += char
      fieldStarted = true
    }
  }

  if (quoted) {
    throw new Error("Unclosed quoted CSV field")
  }

  if (field.length > 0 || fieldStarted || record.length > 0) {
    pushRecord()
  }

  return records
}

export function escapeCsv(value: string | number): string {
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

type CellKind = "string" | "number" | "boolean" | "json"

// On-disk column order of data/results/**/*.csv. Append only; never reorder.
const ATTEMPT_COLUMNS: [string, keyof LichessPuzzleAttemptRow, CellKind][] = [
  ["run_id", "runId", "string"],
  ["created_at", "createdAt", "string"],
  ["benchmark", "benchmark", "string"],
  ["prompt_template_id", "promptTemplateId", "string"],
  ["model", "model", "string"],
  ["item_id", "itemId", "string"],
  ["lichess_puzzle_id", "lichessPuzzleId", "string"],
  ["rating", "rating", "number"],
  ["rating_band", "ratingBand", "string"],
  ["rating_bucket", "ratingBucket", "string"],
  ["primary_theme", "primaryTheme", "string"],
  ["status", "status", "string"],
  ["solved", "solved", "boolean"],
  ["first_move_correct", "firstMoveCorrect", "boolean"],
  ["exact_player_line", "exactPlayerLine", "boolean"],
  ["player_move_prefix_score", "playerMovePrefixScore", "number"],
  ["expected_full_line", "expectedFullLine", "json"],
  ["expected_player_line", "expectedPlayerLine", "json"],
  ["submitted_player_moves", "submittedPlayerMoves", "json"],
  ["revealed_opponent_moves", "revealedOpponentMoves", "json"],
  ["invalid_turn_index", "invalidTurnIndex", "number"],
  ["error_message", "errorMessage", "string"],
  ["latency_ms_total", "latencyMsTotal", "number"],
  ["input_tokens", "inputTokens", "number"],
  ["output_tokens", "outputTokens", "number"],
  ["total_tokens", "totalTokens", "number"],
  ["reasoning_effort", "reasoningEffort", "string"],
  ["max_output_tokens", "maxOutputTokens", "number"],
  ["reasoning_tokens", "reasoningTokens", "number"],
  ["cost_usd", "costUsd", "number"],
  ["served_provider", "servedProvider", "string"],
  ["generation_id", "generationId", "string"],
  ["turns_json", "turns", "json"],
]

export const ATTEMPT_CSV_HEADER = ATTEMPT_COLUMNS.map(
  ([header]) => header
).join(",")

export function serializeAttemptRow(row: LichessPuzzleAttemptRow): string {
  return ATTEMPT_COLUMNS.map(([, key, kind]) => {
    const value = row[key]
    return escapeCsv(
      kind === "json" ? JSON.stringify(value) : String(value ?? "")
    )
  }).join(",")
}

export function parseAttemptRows(contents: string): LichessPuzzleAttemptRow[] {
  const [headers, ...records] = parseCsvRecords(contents)
  if (!headers) return []

  // Looked up by name, so older files missing trailing columns decode as "" / null.
  // SAFETY: every ATTEMPT_COLUMNS key is set below, so the object has the full LichessPuzzleAttemptRow shape; cell kinds match the field types.
  return records.map(
    (cells) =>
      Object.fromEntries(
        ATTEMPT_COLUMNS.map(([header, key, kind]) => [
          key,
          decodeCell(cells[headers.indexOf(header)] ?? "", kind),
        ])
      ) as LichessPuzzleAttemptRow
  )
}

function decodeCell(cell: string, kind: CellKind) {
  switch (kind) {
    case "string":
      return cell
    case "number":
      return cell === "" ? null : Number(cell)
    case "boolean":
      return cell === "true"
    case "json":
      return JSON.parse(cell)
  }
}
