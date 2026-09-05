"use client"

import * as React from "react"
import { Chess, type Square } from "chess.js"
import { Chessground } from "@lichess-org/chessground"
import type { Api as ChessgroundApi } from "@lichess-org/chessground/api"
import type { Config as ChessgroundConfig } from "@lichess-org/chessground/config"
import type { DrawShape as BoardArrow } from "@lichess-org/chessground/draw"
import type * as cg from "@lichess-org/chessground/types"
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Filter,
  Moon,
  Puzzle,
  RotateCcw,
  Shuffle,
  Sun,
  Target,
  Trophy,
  X,
} from "lucide-react"
import { useTheme } from "next-themes"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ErrorBar,
  LabelList,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  Scatter,
  ScatterChart,
  Symbols,
  XAxis,
  YAxis,
  type SymbolType,
} from "recharts"

import {
  THEME_SHORTCUT,
  useThemeShortcutLabel,
} from "@/components/theme-provider"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { AnthropicBlack } from "@/components/ui/svgs/anthropicBlack"
import { AnthropicWhite } from "@/components/ui/svgs/anthropicWhite"
import { Deepseek } from "@/components/ui/svgs/deepseek"
import { Gemini } from "@/components/ui/svgs/gemini"
import { Openai } from "@/components/ui/svgs/openai"
import { OpenaiDark } from "@/components/ui/svgs/openaiDark"
import { QwenDark } from "@/components/ui/svgs/qwenDark"
import { QwenLight } from "@/components/ui/svgs/qwenLight"
import { XaiDark } from "@/components/ui/svgs/xaiDark"
import { XaiLight } from "@/components/ui/svgs/xaiLight"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  CATEGORY as REAL_CATEGORY,
  CATEGORY_SAMPLE as REAL_CATEGORY_SAMPLE,
  CATEGORIES as REAL_CATEGORIES,
  META as REAL_META,
  MODELS as REAL_MODELS,
  PUZZLES as REAL_PUZZLES,
  SCOREBOARD as REAL_SCOREBOARD,
  type DashboardCategoryId,
  type DashboardLabId,
  type DashboardModelId,
  type DashboardPuzzleItem,
  type DashboardSolutionAttempt,
} from "@/lib/benchmarks/dashboard-data"
import { usePreferReducedMotion } from "@/hooks/use-prefers-reduced-motion"
import { cn } from "@/lib/utils"

type View = "leaderboard" | "problems" | "docs"
type ModelId = DashboardModelId
type CategoryId = DashboardCategoryId
type PuzzleItem = DashboardPuzzleItem
type SolutionAttempt = DashboardSolutionAttempt

const MODELS = REAL_MODELS

type LabIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>
type LabLogo = {
  label: string
  /**
   * Vendored mark, as a light and a dark cut. Labs that publish a single mono
   * mark use it for both. Omit it entirely
   * and the lab falls back to a monogram.
   */
  icon?: { light: LabIcon; dark: LabIcon }
}

/**
 * Lab marks are vendored under `components/ui/svgs/` rather than fetched from
 * svgl.app or models.dev at render time: a third-party request per logo per
 * page load leaks visitors to hosts they did not choose, and leaves holes in
 * model identity whenever those hosts are slow, blocked, or offline.
 *
 * Sources are SVGL (https://svgl.app), whose own code is MIT; each mark stays
 * the trademark of the lab it names and is used here only to identify that
 * lab's model.
 *
 * `satisfies Record<DashboardLabId, ...>` is the guard that keeps this table
 * complete: `DashboardLabId` is generated from the labs the benchmarked models
 * actually belong to, so adding a model from a new lab fails `bun run
 * typecheck` until that lab is given an entry here.
 */
const LAB_SVGS = {
  alibaba: { label: "Alibaba", icon: { light: QwenLight, dark: QwenDark } },
  anthropic: {
    label: "Anthropic",
    icon: { light: AnthropicBlack, dark: AnthropicWhite },
  },
  deepseek: { label: "DeepSeek", icon: { light: Deepseek, dark: Deepseek } },
  google: { label: "Google", icon: { light: Gemini, dark: Gemini } },
  openai: { label: "OpenAI", icon: { light: Openai, dark: OpenaiDark } },
  xai: { label: "xAI", icon: { light: XaiLight, dark: XaiDark } },
} as const satisfies Record<DashboardLabId, LabLogo>

const CATEGORIES = REAL_CATEGORIES

const SCOREBOARD = REAL_SCOREBOARD

const CATEGORY = REAL_CATEGORY
const CATEGORY_SAMPLE = REAL_CATEGORY_SAMPLE

const PUZZLES = REAL_PUZZLES

const META = REAL_META

const subscribeMounted = () => () => undefined

/**
 * Series colors are theme-scoped, not fixed hex: the generator fits every
 * model's brand color to the light and the dark `--card` surface separately
 * (see `DashboardModel.color`). Handing both to `ChartStyle` lets CSS pick,
 * so nothing here has to know which theme is mounted.
 */
const modelChartConfig = MODELS.reduce<ChartConfig>((config, model) => {
  config[model.id] = {
    label: model.name,
    theme: { light: model.color, dark: model.colorDark },
  }
  return config
}, {})

/**
 * `ChartContainer` scopes `--color-<model>` to its own subtree, which leaves
 * legends and swatches rendered next to a chart with no way to reach the same
 * value. `SeriesScope` publishes the whole model palette on a shared wrapper so
 * a legend swatch and the mark it describes are painted from one declaration.
 */
const SERIES_SCOPE_ID = "cb-series"

function seriesColor(model: ModelId) {
  return `var(--color-${model})`
}

/**
 * The non-color half of series identity. Color alone fails WCAG 1.4.1, and six
 * hues on one axis is past what anyone can hold anyway, so every series also
 * owns a dash pattern (lines, radar edges) and a point shape (scatter). Both are
 * keyed off the model's index in `MODELS`, and the legend draws the same two
 * marks, so the legend is readable in greyscale.
 */
const SERIES_MARKS: Array<{
  dash?: string
  stroke: string
  symbol: SymbolType
}> = [
  { stroke: "solid", symbol: "circle" },
  { dash: "7 4", stroke: "dashed", symbol: "square" },
  { dash: "2 4", stroke: "dotted", symbol: "triangle" },
  { dash: "11 4 2 4", stroke: "dash-dot", symbol: "diamond" },
  { dash: "16 5", stroke: "long-dashed", symbol: "star" },
  { dash: "4 3 1 3", stroke: "dash-dot-dot", symbol: "cross" },
]

function seriesMark(model: ModelId) {
  const index = Math.max(
    0,
    MODELS.findIndex((entry) => entry.id === model)
  )

  return SERIES_MARKS[index % SERIES_MARKS.length]
}

/**
 * Shortest prefix of the model name that is still unique, for direct labels on
 * marks that have room for a word but not for "DeepSeek V3.2 Thinking".
 */
const SERIES_SHORT_NAMES: Record<string, string> = (() => {
  const names = MODELS.map((model) => model.name)

  return Object.fromEntries(
    MODELS.map((model) => {
      const words = model.name.split(" ")

      for (let length = 1; length < words.length; length += 1) {
        const candidate = words.slice(0, length).join(" ")

        if (names.filter((name) => name.startsWith(candidate)).length === 1) {
          return [model.id, candidate]
        }
      }

      return [model.id, model.name]
    })
  )
})()

/** Spoken form of the dash patterns, for a chart's `desc`. */
function describeStrokes(models: ModelId[]) {
  return (
    models
      // Naming the actual pattern, not just "dashed": five of the six series are
      // dashed, so collapsing them left a description that could not be used to
      // tell one line from another.
      .map((model) => `${modelById(model).name} ${seriesMark(model).stroke}`)
      .join(", ")
  )
}

function shortModelName(model: ModelId) {
  return SERIES_SHORT_NAMES[model] ?? modelById(model).name
}

function modelById(id: ModelId) {
  return MODELS.find((model) => model.id === id) ?? MODELS[0]
}

function categoryById(id: CategoryId) {
  return CATEGORIES.find((category) => category.id === id)
}

function pct(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`
}

// Scores come from a small per-model puzzle sample, so derived values are
// rendered at the precision that sample supports and stay marked as estimates
// until the sample is large enough to carry more digits.
const SAMPLE_SIZES = SCOREBOARD.map((score) => score.n)
const MIN_SAMPLE = SAMPLE_SIZES.length === 0 ? 0 : Math.min(...SAMPLE_SIZES)
const MAX_SAMPLE = SAMPLE_SIZES.length === 0 ? 0 : Math.max(...SAMPLE_SIZES)
const SAMPLE_LABEL =
  MIN_SAMPLE === MAX_SAMPLE ? `${MAX_SAMPLE}` : `${MIN_SAMPLE}-${MAX_SAMPLE}`
const FULL_PRECISION_SAMPLE = 100

function isPrecise(n: number) {
  return n >= FULL_PRECISION_SAMPLE
}

/** Percentage points a single puzzle moves an accuracy figure. */
function puzzleWeight(n: number) {
  return n === 0 ? 0 : 100 / n
}

function accuracyText(value: number, n: number) {
  return `${(value * 100).toFixed(isPrecise(n) ? 1 : 0)}%`
}

function eloText(elo: number, n: number) {
  return isPrecise(n) ? `${elo}` : `~${Math.round(elo / 10) * 10}`
}

function costText(cost: number, n: number) {
  return isPrecise(n) ? `$${cost.toFixed(2)}` : `~$${Math.round(cost)}`
}

function tokensText(tokens: number, n: number) {
  return isPrecise(n)
    ? tokens.toLocaleString()
    : `~${(Math.round(tokens / 100) * 100).toLocaleString()}`
}

function moveTimeText(seconds: number, n: number) {
  return isPrecise(n) ? `${seconds.toFixed(1)}s` : `~${seconds.toFixed(0)}s`
}

function categoryScore(model: ModelId, category: CategoryId) {
  // Master emits the reading and its sample size separately; callers here want
  // them together, because a percentage is meaningless without the n behind it.
  return {
    accuracy: CATEGORY[model][category],
    n: CATEGORY_SAMPLE[model][category],
  }
}

/** Largest measured bucket size across the given models. */
function bucketSize(category: CategoryId, models: ModelId[]) {
  return models.reduce(
    (largest, model) => Math.max(largest, categoryScore(model, category).n),
    0
  )
}

function categoryAxisLabel(
  category: (typeof CATEGORIES)[number],
  models: ModelId[]
) {
  return `${category.label} · n=${bucketSize(category.id, models)}`
}

/**
 * The generator's Elo estimate is `avgPuzzleRating + 400 * log10(p / (1 - p))`.
 * Re-deriving the rating anchor lets us show how far one solved or missed
 * puzzle moves the estimate at this sample size.
 */
function eloLogit(accuracy: number) {
  const clamped = Math.min(0.99, Math.max(0.01, accuracy))
  return 400 * Math.log10(clamped / (1 - clamped))
}

function eloBand(score: (typeof SCOREBOARD)[number]) {
  const anchor = score.elo - eloLogit(score.accuracy)
  const step = score.n === 0 ? 0 : 1 / score.n
  const low = Math.round(anchor + eloLogit(Math.max(0, score.accuracy - step)))
  const high = Math.round(anchor + eloLogit(Math.min(1, score.accuracy + step)))

  return { low, high }
}

const RATING_STEP = 50
const RATING_BOUNDS: [number, number] = (() => {
  const ratings = PUZZLES.map((puzzle) => puzzle.rating)

  if (ratings.length === 0) {
    return [0, 0]
  }

  return [
    Math.floor(Math.min(...ratings) / RATING_STEP) * RATING_STEP,
    Math.ceil(Math.max(...ratings) / RATING_STEP) * RATING_STEP,
  ]
})()

function downloadFile(filename: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const link = document.createElement("a")

  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  // Some browsers resolve the download asynchronously, after this task ends,
  // and fail if the object URL has already been revoked.
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function csvCell(value: string | number) {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function leaderboardCsv() {
  const header = [
    "model_id",
    "model_name",
    "vendor",
    "puzzles_evaluated",
    "solved_rate_measured",
    "legal_move_rate_measured",
    "avg_total_tokens_measured",
    "avg_move_seconds_measured",
    "elo_estimated",
    "usd_per_1k_puzzles_extrapolated",
  ]
  const rows = [...SCOREBOARD]
    .sort((a, b) => b.accuracy - a.accuracy)
    .map((score) => {
      const model = modelById(score.model)
      return [
        score.model,
        model.name,
        model.vendor,
        score.n,
        score.accuracy,
        score.legalRate,
        score.avgTokens,
        score.avgMoveTime,
        score.elo,
        score.cost,
      ]
    })

  return [header, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .concat("")
    .join("\n")
}

function attemptFilename(puzzleId: string, model: ModelId, extension: string) {
  return `chessbench-${puzzleId.replaceAll(":", "-")}-${model}.${extension}`
}

function attemptJson(puzzle: PuzzleItem, attempt: SolutionAttempt) {
  const model = modelById(attempt.model)

  return `${JSON.stringify(
    {
      benchmark: META.benchmarkId,
      generated: META.lastUpdated,
      puzzle: {
        id: puzzle.id,
        fen: puzzle.fen,
        rating: puzzle.rating,
        themes: puzzle.themes,
        sideToMove: puzzle.side,
        expectedPlayerMoves: puzzle.solution,
      },
      model: { id: model.id, name: model.name, vendor: model.vendor },
      attempt: {
        solved: attempt.correct,
        playedMove: attempt.playedMove,
        thinkingMs: attempt.thinkingMs,
        thinkingTokens: attempt.thinkingTokens,
        transcript: attempt.transcript,
      },
    },
    null,
    2
  )}\n`
}

function average(values: number[]) {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((a, b) => a - b)
  const midpoint = Math.floor(sorted.length / 2)

  return sorted.length % 2 === 0
    ? ((sorted[midpoint - 1] ?? 0) + (sorted[midpoint] ?? 0)) / 2
    : (sorted[midpoint] ?? 0)
}

function compactTokens(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`
  }

  return Math.round(value).toString()
}

function readableMove(uci: string) {
  if (!uci) {
    return ""
  }

  const from = uci.slice(0, 2)
  const to = uci.slice(2, 4)
  const promotion = uci[4] ? `, promote to ${uci[4].toUpperCase()}` : ""

  if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) {
    return uci
  }

  return `${from} to ${to}${promotion}`
}

function solutionsFor(puzzle: PuzzleItem): SolutionAttempt[] {
  return puzzle.attempts
}

function safeSquare(square: string) {
  // SAFETY: squares come from chess.js and Chessground, which only emit a1-h8.
  return square as Square
}

function safeKey(square: string) {
  // SAFETY: squares come from chess.js and Chessground, which only emit a1-h8.
  return square as cg.Key
}

function boardOnlyFen(fen: string) {
  return fen.split(" ")[0] ?? fen
}

function turnColor(fen: string): cg.Color {
  try {
    return new Chess(fen).turn() === "w" ? "white" : "black"
  } catch {
    return "white"
  }
}

function isCheck(fen: string) {
  try {
    return new Chess(fen).isCheck()
  } catch {
    return false
  }
}

function legalDests(fen: string): cg.Dests {
  const dests: cg.Dests = new Map()

  try {
    const chess = new Chess(fen)
    for (const move of chess.moves({ verbose: true })) {
      const from = safeKey(move.from)
      const to = safeKey(move.to)
      const existing = dests.get(from)

      if (existing) {
        existing.push(to)
      } else {
        dests.set(from, [to])
      }
    }
  } catch {
    // Invalid positions render as view-only with no legal destinations.
  }

  return dests
}

function moveArrow(uci: string): BoardArrow | null {
  const orig = uci.slice(0, 2)
  const dest = uci.slice(2, 4)

  if (!/^[a-h][1-8]$/.test(orig) || !/^[a-h][1-8]$/.test(dest)) {
    return null
  }

  return {
    orig: safeKey(orig),
    dest: safeKey(dest),
    brush: "red",
    modifiers: {
      lineWidth: 12,
    },
  }
}

const NO_ARROWS: BoardArrow[] = []

function useMounted() {
  return React.useSyncExternalStore(
    subscribeMounted,
    () => true,
    () => false
  )
}

function boardAnimation(reducedMotion: boolean, small: boolean) {
  return reducedMotion
    ? { enabled: false, duration: 0 }
    : { enabled: true, duration: small ? 80 : 160 }
}

type BoardPiece = NonNullable<ReturnType<Chess["board"]>[number][number]>

const PIECE_NAMES = {
  k: "king",
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
  p: "pawn",
}

const PIECE_ORDER = ["k", "q", "r", "b", "n", "p"] as const

function describeSide(pieces: BoardPiece[]) {
  const groups = PIECE_ORDER.map((type) => {
    const squares = pieces
      .filter((piece) => piece.type === type)
      .map((piece) => piece.square)

    if (squares.length === 0) {
      return null
    }

    const name = PIECE_NAMES[type]
    return `${squares.length > 1 ? `${name}s` : name} ${squares.join(", ")}`
  }).filter((group): group is string => group !== null)

  return groups.length > 0 ? groups.join("; ") : "no pieces"
}

/**
 * A text alternative for the board: assistive tech otherwise gets an empty box
 * where the position should be. Pieces are grouped by type so a full position
 * reads as a short list instead of 32 separate squares.
 */
function piecesSummary(fen: string) {
  let pieces: BoardPiece[]

  try {
    pieces = new Chess(fen)
      .board()
      .flat()
      .filter((square): square is BoardPiece => square !== null)
  } catch {
    return "position unavailable"
  }

  const white = describeSide(pieces.filter((piece) => piece.color === "w"))
  const black = describeSide(pieces.filter((piece) => piece.color === "b"))

  return `White: ${white}. Black: ${black}.`
}

function boardSummary(fen: string) {
  const color = turnColor(fen)
  const check = isCheck(fen) ? ", in check" : ""

  return `Chess position. ${color === "white" ? "White" : "Black"} to move${check}. ${piecesSummary(fen)}`
}

type PlayedMove = {
  from: string
  to: string
  san: string
  fen: string
  promotion?: string
}

/**
 * Single source of truth for applying a move, shared by the drag/drop path and
 * the typed path so both produce the same SAN, FEN, and promotion default.
 */
function playMove(
  fen: string,
  from: string,
  to: string,
  promotion?: string
): PlayedMove | null {
  try {
    const chess = new Chess(fen)
    const piece = chess.get(safeSquare(from))
    const promotesTo =
      promotion ??
      (piece?.type === "p" && (to[1] === "8" || to[1] === "1")
        ? "q"
        : undefined)
    const move = chess.move({ from, to, promotion: promotesTo })

    if (!move) {
      return null
    }

    return {
      from: move.from,
      to: move.to,
      san: move.san,
      fen: chess.fen(),
      promotion: move.promotion,
    }
  } catch {
    return null
  }
}

const UCI_INPUT = /^([a-h][1-8])-?([a-h][1-8])([qrbn]?)$/
const CASTLE_INPUT = /^[o0](?:-?[o0]){1,2}$/i

/**
 * Accepts UCI (`g1f3`, `e7e8q`) and SAN (`Nf3`, `exd5`, `O-O`, `0-0-0`), and
 * resolves both through chess.js so an illegal or ambiguous entry is rejected
 * exactly the way the board rejects an illegal drag.
 */
function parseMoveInput(fen: string, input: string): PlayedMove | null {
  const text = input.trim().replace(/\s+/g, "")

  if (!text) {
    return null
  }

  const uci = UCI_INPUT.exec(text.toLowerCase())

  if (uci) {
    return playMove(fen, uci[1], uci[2], uci[3] || undefined)
  }

  const san = CASTLE_INPUT.test(text)
    ? text.replace(/-/g, "").length === 3
      ? "O-O-O"
      : "O-O"
    : text

  // `bxc3` is a pawn capture and `Bxc3` a bishop capture, so the literal text is
  // always tried first; the capitalised form is only a fallback for people who
  // type `nf3`.
  for (const candidate of [san, san.charAt(0).toUpperCase() + san.slice(1)]) {
    try {
      const chess = new Chess(fen)
      const move = chess.move(candidate)

      return {
        from: move.from,
        to: move.to,
        san: move.san,
        fen: chess.fen(),
        promotion: move.promotion,
      }
    } catch {
      // Try the next spelling, then give up.
    }
  }

  return null
}

const MAIN_CONTENT_ID = "cb-main"

export function ChessBenchDashboard() {
  const [view, setView] = React.useState<View>("leaderboard")
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useMounted()
  const isDark = mounted && resolvedTheme === "dark"
  const shortcutLabel = useThemeShortcutLabel()

  return (
    <Tabs
      value={view}
      onValueChange={(value) => {
        // SAFETY: the only TabsTriggers rendered carry View values.
        setView(value as View)
      }}
      className="min-h-svh bg-background text-foreground"
    >
      {/*
        First thing in the tab order: the sticky header puts a wordmark, three
        tabs and the theme toggle ahead of the content on every keyboard entry,
        and the tablist has to be stepped through again after each view change.
      */}
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:ring-1 focus:ring-foreground/10 focus:outline-3 focus:outline-offset-2 focus:outline-ring/50"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1360px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2 font-medium tracking-tight">
            <Badge className="size-7 rounded-lg p-0 text-base" aria-hidden>
              ♞
            </Badge>
            <span className="truncate">ChessBench</span>
          </div>
          <TabsList
            variant="line"
            className="ml-4 h-10 gap-4 border-l border-border pl-4"
          >
            <TabsTrigger
              value="leaderboard"
              className="h-9 rounded-none px-0 text-xs font-semibold tracking-[0.12em] uppercase"
            >
              <Trophy data-icon="inline-start" />
              <span className="hidden sm:inline">Leaderboard</span>
            </TabsTrigger>
            <TabsTrigger
              value="problems"
              className="h-9 rounded-none px-0 text-xs font-semibold tracking-[0.12em] uppercase"
            >
              <Puzzle data-icon="inline-start" />
              <span className="hidden sm:inline">Problems</span>
            </TabsTrigger>
            <TabsTrigger
              value="docs"
              className="h-9 rounded-none px-0 text-xs font-semibold tracking-[0.12em] uppercase"
            >
              <BookOpen data-icon="inline-start" />
              <span className="hidden sm:inline">Docs</span>
            </TabsTrigger>
          </TabsList>
          <Tooltip>
            {/*
              `aria-keyshortcuts` takes the constant so the announced binding is
              the same string on the server and the client; the visible tooltip
              takes the hook, which swaps in mac glyphs after hydration.
            */}
            <TooltipTrigger
              render={
                <Button
                  className="ml-auto"
                  size="icon"
                  variant="ghost"
                  aria-label={
                    isDark ? "Switch to light mode" : "Switch to dark mode"
                  }
                  aria-keyshortcuts={THEME_SHORTCUT.label}
                  onClick={() => setTheme(isDark ? "light" : "dark")}
                >
                  {isDark ? <Sun /> : <Moon />}
                </Button>
              }
            />
            <TooltipContent>
              {isDark ? "Switch to light mode" : "Switch to dark mode"}
              <span className="text-background/70">{shortcutLabel}</span>
            </TooltipContent>
          </Tooltip>
        </div>
      </header>

      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="mx-auto w-full max-w-[1360px] px-4 py-6 outline-none sm:px-6 lg:px-8"
      >
        <TabsContent value="leaderboard">
          <LeaderboardView />
        </TabsContent>
        <TabsContent value="problems">
          <ProblemsView />
        </TabsContent>
        <TabsContent value="docs">
          <DocsView />
        </TabsContent>
      </main>
    </Tabs>
  )
}

function LeaderboardView() {
  const sorted = [...SCOREBOARD].sort((a, b) => b.accuracy - a.accuracy)
  const leader = sorted[0]
  const runnerUp = sorted[1]
  const leaderModel = modelById(leader.model)
  const avgTokens = average(sorted.map((score) => score.avgTokens))
  const medianMove = median(sorted.map((score) => score.avgMoveTime))
  const meanLegalRate = average(sorted.map((score) => score.legalRate))

  return (
    <div className="space-y-8">
      <section className="grid gap-2.5 border-b pb-4">
        <div className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          {META.benchmarkId} · {META.lastUpdated}
        </div>
        <h1 className="max-w-sm text-4xl leading-none font-semibold tracking-normal sm:text-5xl">
          Model chess benchmark.
        </h1>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 text-sm text-muted-foreground">
          <span>{MODELS.length} models</span>
          <span aria-hidden="true">·</span>
          <span>
            {META.puzzleCount.toLocaleString()} of{" "}
            {META.datasetSize.toLocaleString()} lichess puzzles sampled
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-2 text-foreground">
            <ModelDot model={leader.model} />
            {leaderModel.name} leads at{" "}
            {accuracyText(leader.accuracy, leader.n)}
          </span>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Every model answered the same {SAMPLE_LABEL} puzzles. At that sample
          size one puzzle is worth {puzzleWeight(MIN_SAMPLE).toFixed(0)}{" "}
          percentage points, so accuracy, Elo, cost and token figures are shown
          as estimates rather than exact measurements.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          icon={Target}
          label="Best accuracy"
          value={accuracyText(leader.accuracy, leader.n)}
          sub={
            runnerUp
              ? `${leaderModel.name} leads by ${((leader.accuracy - runnerUp.accuracy) * 100).toFixed(0)}pp`
              : `${leaderModel.name} is the only model in this run`
          }
          note={`measured on n = ${leader.n}`}
        />
        <SummaryCard
          icon={Brain}
          label="Avg thinking"
          value={compactTokens(avgTokens)}
          sub="tokens per attempted puzzle"
          note={`mean of ${MODELS.length} models, n = ${SAMPLE_LABEL} each`}
        />
        <SummaryCard
          icon={Clock}
          label="Median move"
          value={`${medianMove.toFixed(1)}s`}
          sub={`across ${MODELS.length} model families`}
          note="median of per-model means"
        />
        <SummaryCard
          icon={BarChart3}
          label="Legal moves"
          value={pct(meanLegalRate, 0)}
          sub="mean parse and legality rate"
          note={`${META.evaluations.toLocaleString()} evaluations total`}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardDescription>Headline metric</CardDescription>
            <CardTitle as="h2">Overall accuracy</CardTitle>
          </CardHeader>
          <CardContent>
            <OverallAccuracyChart sorted={sorted} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Capability breakdown</CardDescription>
            <CardTitle as="h2">Top-three capability radar</CardTitle>
          </CardHeader>
          <CardContent>
            <CapabilityRadar sorted={sorted.slice(0, 3)} />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardDescription>Per-category accuracy</CardDescription>
          <CardTitle as="h2">
            Theme buckets from the lichess puzzle set
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryBars />
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Derived rating</CardDescription>
            <CardTitle as="h2">Estimated Elo, single round</CardTitle>
          </CardHeader>
          <CardContent>
            <EloEstimateChart sorted={sorted} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Trade-offs</CardDescription>
            <CardTitle as="h2">Cost and reasoning vs. accuracy</CardTitle>
          </CardHeader>
          <CardContent>
            <TradeoffScatter />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div>
            <CardDescription>Full results</CardDescription>
            <CardTitle as="h2">Per-model breakdown</CardTitle>
          </div>
          <CardAction>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                downloadFile(
                  `chessbench-${META.benchmarkId}-leaderboard-${META.lastUpdated}.csv`,
                  leaderboardCsv(),
                  "text/csv;charset=utf-8"
                )
              }
            >
              <Download data-icon="inline-start" />
              CSV
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          <ResultsTable sorted={sorted} />
          <SampleNote>
            Measured columns come straight from the run; Elo and $ / 1k are
            derived from it. At n = {SAMPLE_LABEL} a single puzzle moves
            accuracy by {puzzleWeight(MIN_SAMPLE).toFixed(0)}pp, so derived
            figures are rounded to the precision the sample supports. The CSV
            export keeps full precision and labels each column measured,
            estimated, or extrapolated.
          </SampleNote>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Note: results are generated from local canonical benchmark CSV
        snapshots. ChessBench is not affiliated with any model provider.
      </p>
    </div>
  )
}

function Metric({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <div className="text-2xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums",
          mono && "font-mono"
        )}
      >
        {value}
      </div>
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  note,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub: string
  note?: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Icon className="size-4" />
          {label}
        </CardDescription>
        {/*
          The title slot here holds the measurement, not a section name: "62.0%"
          in a heading list is noise, and the label above it is the real name of
          the tile. Kept out of the outline on purpose.
        */}
        <CardTitle as="div" className="font-mono text-2xl tabular-nums">
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm text-muted-foreground">
        <div>{sub}</div>
        {note ? (
          <div className="font-mono text-xs text-muted-foreground">{note}</div>
        ) : null}
      </CardContent>
    </Card>
  )
}

/** Standing caveat printed next to any figure the sample cannot fully back. */
function SampleNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="max-w-prose text-xs leading-5 text-muted-foreground">
      {children}
    </p>
  )
}

/** Column or metric label that opens the derivation behind the number. */
/**
 * Column header for a figure that was derived rather than measured, with the
 * derivation in a tooltip.
 *
 * The trigger is a real `<button>`, not a styled `<span>`: a span is not in the
 * tab order, so the explanation of how Elo, token and cost figures were
 * produced was reachable by hover only. That explanation is the point of the
 * label, and it is exactly what a keyboard or screen-reader user needs most.
 */
function DerivedLabel({ label, hint }: { label: string; hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="cursor-help border-b border-dashed border-muted-foreground/60 font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {label}
            <span className="sr-only">. {hint}</span>
          </button>
        }
      />
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Wrapper that publishes `--color-<model>` for a chart and everything rendered
 * beside it. Nested `ChartContainer`s inherit these and can still override a
 * key of their own.
 */
function SeriesScope({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  // The style tag is a sibling of the layout container rather than a child of
  // it, so a `space-y` rhythm on `className` does not count it as a row.
  return (
    <div data-chart={SERIES_SCOPE_ID}>
      <ChartStyle id={SERIES_SCOPE_ID} config={modelChartConfig} />
      <div className={className}>{children}</div>
    </div>
  )
}

/** The mark a series is actually drawn with, at legend size. */
function SeriesSwatch({
  model,
  variant,
}: {
  model: ModelId
  variant: "bar" | "line" | "point"
}) {
  const mark = seriesMark(model)
  const color = seriesColor(model)

  if (variant === "line") {
    return (
      <svg viewBox="0 0 28 12" className="h-3 w-7 shrink-0" aria-hidden="true">
        <line
          x1="0"
          y1="6"
          x2="28"
          y2="6"
          strokeWidth="2.5"
          strokeDasharray={mark.dash}
          style={{ stroke: color }}
        />
      </svg>
    )
  }

  if (variant === "point") {
    return (
      <svg viewBox="0 0 16 16" className="size-4 shrink-0" aria-hidden="true">
        <Symbols
          type={mark.symbol}
          cx={8}
          cy={8}
          size={70}
          style={{ fill: color }}
        />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 16 12" className="h-3 w-4 shrink-0" aria-hidden="true">
      <rect x="0" y="0" width="16" height="12" rx="2" style={{ fill: color }} />
    </svg>
  )
}

/**
 * The color-to-model key the charts were missing. The lab logo stays, because
 * it is the fastest way to recognise a model, but the swatch is what makes the
 * row usable as a legend at all.
 */
function SeriesLegend({
  models,
  variant,
  note,
}: {
  models: ModelId[]
  variant: "bar" | "line" | "point"
  note?: string
}) {
  return (
    <div className="space-y-1.5">
      <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {models.map((model) => (
          <li key={model} className="inline-flex items-center gap-1.5 text-sm">
            <SeriesSwatch model={model} variant={variant} />
            <ModelDot model={model} />
            <span className="font-medium">{modelById(model).name}</span>
          </li>
        ))}
      </ul>
      {note ? (
        <p className="text-center text-xs text-muted-foreground">{note}</p>
      ) : null}
    </div>
  )
}

/**
 * Every number in these charts other than the axis ticks lives in a hover
 * tooltip, which a touch user cannot open and a screen reader user cannot find.
 * Each chart is paired with this table so the same values are readable without
 * a pointer. Unmeasured buckets say so rather than reporting a zero.
 */
function ChartTable({
  caption,
  columns,
  rows,
}: {
  caption: string
  columns: string[]
  rows: Array<{ key: string; header: string; cells: string[] }>
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th scope="row">{row.header}</th>
            {row.cells.map((cell, index) => (
              <td key={`${row.key}-${columns[index + 1] ?? index}`}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function OverallAccuracyChart({ sorted }: { sorted: typeof SCOREBOARD }) {
  const data = sorted.map((score) => {
    const model = modelById(score.model)
    return {
      model: model.name,
      accuracy: Number((score.accuracy * 100).toFixed(1)),
      solved: Math.round(score.accuracy * score.n),
      n: score.n,
      label: `${accuracyText(score.accuracy, score.n)} (${Math.round(
        score.accuracy * score.n
      )}/${score.n})`,
      fill: seriesColor(score.model),
    }
  })

  return (
    <SeriesScope className="space-y-4">
      <ChartContainer
        config={{ accuracy: { label: "Accuracy" } }}
        className="aspect-auto h-[300px] w-full"
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 10, right: 72, top: 8, bottom: 8 }}
          title="Overall accuracy by model"
          desc={`Horizontal bars, one per model, showing the share of the ${SAMPLE_LABEL} sampled puzzles each model solved. Each bar is labelled with its accuracy and the solved count. The same figures are in the accompanying data table.`}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
          />
          <YAxis
            dataKey="model"
            type="category"
            width={132}
            tickLine={false}
            axisLine={false}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name, item) => {
                  // SAFETY: recharts hands the formatter the row from `data` behind the hovered series entry.
                  const row = item?.payload as (typeof data)[number] | undefined

                  return (
                    <div className="flex w-full min-w-40 items-center justify-between gap-3 leading-none">
                      <span className="text-muted-foreground">
                        {row ? `${row.solved} of ${row.n} solved` : "Accuracy"}
                      </span>
                      <span className="font-mono font-medium text-foreground tabular-nums">
                        {accuracyText(
                          Number(value) / 100,
                          row?.n ?? MIN_SAMPLE
                        )}
                      </span>
                    </div>
                  )
                }}
              />
            }
          />
          <Bar dataKey="accuracy" radius={4}>
            {data.map((entry) => (
              <Cell key={entry.model} fill={entry.fill} />
            ))}
            <LabelList
              dataKey="label"
              position="right"
              className="fill-foreground font-mono text-xs"
            />
          </Bar>
        </BarChart>
      </ChartContainer>
      <ChartTable
        caption="Overall accuracy by model"
        columns={["Model", "Solved", "Puzzles", "Accuracy"]}
        rows={data.map((entry) => ({
          key: entry.model,
          header: entry.model,
          cells: [
            `${entry.solved}`,
            `${entry.n}`,
            accuracyText(entry.accuracy / 100, entry.n),
          ],
        }))}
      />
      <SampleNote>
        Solved puzzles out of the {SAMPLE_LABEL} each model was given. One
        puzzle is worth {puzzleWeight(MIN_SAMPLE).toFixed(0)} percentage points.
        Each bar is named on the axis beside it, so the color only repeats what
        the label already says.
      </SampleNote>
    </SeriesScope>
  )
}

function CategoryBars() {
  const sorted = [...SCOREBOARD].sort((a, b) => b.accuracy - a.accuracy)
  const shownModels = sorted.map((score) => score.model)
  const data = CATEGORIES.map((category) => {
    const row: Record<string, string | number | null> = {}
    row.category = categoryAxisLabel(category, shownModels)

    for (const score of sorted) {
      const bucket = categoryScore(score.model, category.id)
      // A bucket with no puzzles has no bar at all, so an absent measurement
      // reads as a gap instead of a zero.
      row[score.model] =
        bucket.accuracy === null
          ? null
          : Number((bucket.accuracy * 100).toFixed(1))
      row[`${score.model}__n`] = bucket.n
    }

    return row
  })
  const unmeasured = CATEGORIES.filter(
    (category) => bucketSize(category.id, shownModels) === 0
  )
  const barOrder = shownModels.map((model) => modelById(model).name).join(", ")

  return (
    <SeriesScope className="space-y-4">
      <ChartContainer
        config={modelChartConfig}
        className="aspect-auto h-[360px] w-full"
      >
        <BarChart
          data={data}
          margin={{ left: 0, right: 16, top: 12, bottom: 48 }}
          title="Accuracy per puzzle theme, by model"
          desc={`Grouped bars. Each theme on the horizontal axis carries one bar per model, in the order given by the legend: ${barOrder}. Themes with no puzzle in the sample are drawn as a gap. The full grid of values is in the accompanying data table.`}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="category"
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={-28}
            textAnchor="end"
            height={72}
          />
          {/* 44px, not 36: the widest tick ("100%") overflowed the chart's left
              edge by 4px and rendered clipped. */}
          <YAxis
            width={44}
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name, item) => {
                  // SAFETY: series dataKeys are model ids, so `name` is a ModelId.
                  const model = modelById(name as ModelId)
                  // SAFETY: recharts hands the formatter the row from `data` behind the hovered series entry.
                  const row = item?.payload as
                    | Record<string, string | number | null>
                    | undefined
                  const n = Number(row?.[`${String(name)}__n`] ?? 0)

                  return (
                    <div className="flex w-full min-w-44 items-center justify-between gap-3 leading-none">
                      <span className="text-muted-foreground">
                        {model.name}
                      </span>
                      <span className="font-mono font-medium text-foreground tabular-nums">
                        {value === null || n === 0
                          ? "no puzzles in sample"
                          : `${accuracyText(Number(value) / 100, n)} · n=${n}`}
                      </span>
                    </div>
                  )
                }}
              />
            }
          />
          {sorted.map((score) => (
            <Bar
              key={score.model}
              dataKey={score.model}
              fill={seriesColor(score.model)}
              radius={2}
            />
          ))}
        </BarChart>
      </ChartContainer>
      <SeriesLegend
        models={shownModels}
        variant="bar"
        note="Bars run left to right in this order inside every theme group."
      />
      <ChartTable
        caption="Accuracy per puzzle theme, by model"
        columns={[
          "Theme",
          ...shownModels.map((model) => modelById(model).name),
        ]}
        rows={CATEGORIES.map((category) => ({
          key: category.id,
          header: category.label,
          cells: shownModels.map((model) => {
            const bucket = categoryScore(model, category.id)

            return bucket.accuracy === null
              ? "no puzzles in sample"
              : `${accuracyText(bucket.accuracy, bucket.n)} of ${bucket.n} puzzles`
          }),
        }))}
      />
      <SampleNote>
        Each label carries the bucket size in this sample.
        {unmeasured.length > 0 ? (
          <>
            {" "}
            <span className="text-foreground">
              No puzzles in sample:{" "}
              {unmeasured.map((category) => category.label).join(", ")}
            </span>
            . Those buckets are drawn as gaps, not as zeros.
          </>
        ) : null}{" "}
        Buckets with n = 1 can only read 0% or 100%.
      </SampleNote>
    </SeriesScope>
  )
}

function CapabilityRadar({ sorted }: { sorted: typeof SCOREBOARD }) {
  const shownModels = sorted.map((score) => score.model)
  // A radar closes its polygon through every axis, so an unmeasured axis would
  // read as 0%. Unmeasured themes are dropped from the chart and named below.
  const measured = CATEGORIES.filter((category) =>
    shownModels.every(
      (model) => categoryScore(model, category.id).accuracy !== null
    )
  )
  const omitted = CATEGORIES.filter((category) => !measured.includes(category))
  // A radar stays readable to about eight spokes. Anything past that is cut,
  // but a *measured* theme disappearing has to be said out loud - unlike an
  // unmeasured one, it has a real value that simply is not on the chart. The
  // sample currently has exactly eight, so this is one theme away from firing.
  const AXIS_LIMIT = 8
  const axes = measured.slice(0, AXIS_LIMIT)
  const overflow = measured.slice(AXIS_LIMIT)
  const data = axes.map((category) => {
    const row: Record<string, string | number> = {}
    row.category = categoryAxisLabel(category, shownModels)

    for (const score of sorted) {
      const bucket = categoryScore(score.model, category.id)
      row[score.model] = Number(((bucket.accuracy ?? 0) * 100).toFixed(1))
      row[`${score.model}__n`] = bucket.n
    }

    return row
  })
  const strokeLegend = describeStrokes(shownModels)

  return (
    <SeriesScope className="space-y-4">
      <ChartContainer
        config={modelChartConfig}
        className="aspect-auto h-[300px] w-full"
      >
        <RadarChart
          data={data}
          outerRadius={98}
          title="Capability radar for the top three models"
          desc={`One polygon per model across ${axes.length} measured puzzle themes, each drawn with its own line style: ${strokeLegend}. Themes with no puzzle in the sample are left off the chart. The values are in the accompanying data table.`}
        >
          <PolarGrid />
          <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
          {/* The radius ticks sit halfway between two spokes rather than on the
              90 degree one, where they landed on top of the first theme's label
              ("Mate - n=3" and "100%" overlapped by 26x7px). */}
          <PolarRadiusAxis
            angle={90 - 180 / Math.max(axes.length, 1)}
            domain={[0, 100]}
            tickCount={4}
            tickFormatter={(value) => `${value}%`}
          />
          {sorted.map((score) => (
            <Radar
              key={score.model}
              dataKey={score.model}
              stroke={seriesColor(score.model)}
              strokeWidth={2}
              strokeDasharray={seriesMark(score.model).dash}
              fill={seriesColor(score.model)}
              fillOpacity={0.14}
              dot={{ r: 2.5 }}
            />
          ))}
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name, item) => {
                  // SAFETY: series dataKeys are model ids, so `name` is a ModelId.
                  const model = modelById(name as ModelId)
                  // SAFETY: recharts hands the formatter the row from `data` behind the hovered series entry.
                  const row = item?.payload as
                    | Record<string, string | number>
                    | undefined
                  const n = Number(row?.[`${String(name)}__n`] ?? 0)

                  return (
                    <div className="flex w-full min-w-44 items-center justify-between gap-3 leading-none">
                      <span className="text-muted-foreground">
                        {model.name}
                      </span>
                      <span className="font-mono font-medium text-foreground tabular-nums">
                        {accuracyText(Number(value) / 100, n)} · n={n}
                      </span>
                    </div>
                  )
                }}
              />
            }
          />
        </RadarChart>
      </ChartContainer>
      <SeriesLegend models={shownModels} variant="line" />
      {/*
        Rows come from every measured theme, not just the ones that fit on the
        chart. The axis cap exists because a radar stops being readable past
        about eight spokes; a table has no such limit, so capping it here too
        would drop a real reading from the one place it could still be read.
      */}
      <ChartTable
        caption="Capability radar for the top three models"
        columns={[
          "Theme",
          ...shownModels.map((model) => modelById(model).name),
        ]}
        rows={measured.map((category) => ({
          key: category.id,
          header: category.label,
          cells: shownModels.map((model) => {
            const bucket = categoryScore(model, category.id)

            return bucket.accuracy === null
              ? "no puzzles in sample"
              : `${accuracyText(bucket.accuracy, bucket.n)} of ${bucket.n} puzzles`
          }),
        }))}
      />
      <SampleNote>
        Axes show measured themes only, with the bucket size in the label.
        {omitted.length > 0 ? (
          <>
            {" "}
            <span className="text-foreground">
              Omitted, no puzzles in sample:{" "}
              {omitted.map((category) => category.label).join(", ")}
            </span>
            .
          </>
        ) : null}
        {overflow.length > 0 ? (
          <>
            {" "}
            <span className="text-foreground">
              Measured but not shown, the chart holds {AXIS_LIMIT} axes:{" "}
              {overflow.map((category) => category.label).join(", ")}
            </span>
            . Those readings are in the table below.
          </>
        ) : null}
      </SampleNote>
    </SeriesScope>
  )
}

function EloEstimateChart({ sorted }: { sorted: typeof SCOREBOARD }) {
  const data = [...sorted]
    .sort((a, b) => b.elo - a.elo)
    .map((score) => {
      const model = modelById(score.model)
      const { low, high } = eloBand(score)
      const swing: [number, number] = [score.elo - low, high - score.elo]

      return {
        model: model.name,
        elo: score.elo,
        n: score.n,
        low,
        high,
        swing,
        label: eloText(score.elo, score.n),
        fill: seriesColor(score.model),
      }
    })
  const lowest = Math.min(...data.map((entry) => entry.low))
  const highest = Math.max(...data.map((entry) => entry.high))

  return (
    <SeriesScope className="space-y-4">
      <ChartContainer
        config={{ elo: { label: "Elo" } }}
        className="aspect-auto h-[300px] w-full"
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 10, right: 48, top: 8, bottom: 8 }}
          title="Estimated Elo by model, with one-puzzle swing"
          desc={`Horizontal bars, one per model, each labelled with its estimated Elo. The whisker on each bar spans where that estimate lands if the model solves or misses one more puzzle out of ${SAMPLE_LABEL}. The same figures are in the accompanying data table.`}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis
            type="number"
            domain={[
              Math.floor((lowest - 50) / 100) * 100,
              Math.ceil((highest + 50) / 100) * 100,
            ]}
            allowDataOverflow
          />
          <YAxis
            dataKey="model"
            type="category"
            width={132}
            tickLine={false}
            axisLine={false}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name, item) => {
                  // SAFETY: recharts hands the formatter the row from `data` behind the hovered series entry.
                  const row = item?.payload as (typeof data)[number] | undefined

                  return (
                    <div className="grid w-full min-w-48 gap-1 leading-none">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">
                          Estimated Elo
                        </span>
                        <span className="font-mono font-medium text-foreground tabular-nums">
                          {eloText(Number(value), row?.n ?? MIN_SAMPLE)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">
                          ± 1 puzzle of {row?.n ?? MIN_SAMPLE}
                        </span>
                        <span className="font-mono text-muted-foreground tabular-nums">
                          {row?.low}-{row?.high}
                        </span>
                      </div>
                    </div>
                  )
                }}
              />
            }
          />
          <Bar dataKey="elo" radius={4}>
            {data.map((entry) => (
              <Cell key={entry.model} fill={entry.fill} />
            ))}
            <ErrorBar
              dataKey="swing"
              width={5}
              strokeWidth={1.5}
              stroke="var(--muted-foreground)"
            />
            <LabelList
              dataKey="label"
              position="right"
              offset={12}
              className="fill-foreground font-mono text-xs"
            />
          </Bar>
        </BarChart>
      </ChartContainer>
      <ChartTable
        caption="Estimated Elo by model, with the swing one puzzle would cause"
        columns={["Model", "Estimated Elo", "Puzzles", "Range for one puzzle"]}
        rows={data.map((entry) => ({
          key: entry.model,
          header: entry.model,
          cells: [
            eloText(entry.elo, entry.n),
            `${entry.n}`,
            `${entry.low} to ${entry.high}`,
          ],
        }))}
      />
      <SampleNote>
        Elo is estimated as the average rating of the puzzles a model faced,
        adjusted by its solve rate. It is not a played rating. The whisker shows
        where the estimate lands if that model solves or misses one more puzzle
        out of {SAMPLE_LABEL}. A progression chart replaces this card once a
        second benchmark round exists.
      </SampleNote>
    </SeriesScope>
  )
}

type TradeoffPoint = {
  id: ModelId
  model: string
  short: string
  accuracy: number
  cost: number
  tokens: number
  n: number
}

function TradeoffScatter() {
  const data: TradeoffPoint[] = SCOREBOARD.map((score) => ({
    id: score.model,
    model: modelById(score.model).name,
    short: shortModelName(score.model),
    accuracy: Number((score.accuracy * 100).toFixed(1)),
    cost: score.cost,
    tokens: score.avgTokens,
    n: score.n,
  }))

  return (
    <SeriesScope className="grid gap-4 lg:grid-cols-2">
      <TradeoffPlot
        metric="cost"
        data={data}
        note={
          <>
            Cost per 1,000 puzzles is the mean cost of {SAMPLE_LABEL} recorded
            attempts multiplied by 1,000, so it is an extrapolation of roughly
            two significant figures, not a quoted price.
          </>
        }
      />
      <TradeoffPlot
        metric="tokens"
        data={data}
        note={
          <>
            Mean total tokens per attempted puzzle across {SAMPLE_LABEL}
            attempts per model.
          </>
        }
      />
    </SeriesScope>
  )
}

/**
 * One point per model, so each model can carry its own shape as well as its own
 * color, and can be labelled on the plot instead of only in a tooltip.
 */
/**
 * A label centred on a point that sits against the left or right wall of the
 * plot overhangs the axis and lands on its tick labels. Anchoring it inward
 * keeps the text inside the plot area, which is where the empty space is.
 */
function edgeAnchor(
  point: TradeoffPoint,
  metricMax: number,
  metric: "cost" | "tokens"
): "start" | "middle" | "end" {
  if (metricMax === 0) return "middle"

  const share = point[metric] / metricMax

  if (share <= 0.12) return "start"
  if (share >= 0.88) return "end"
  return "middle"
}

function TradeoffPlot({
  metric,
  data,
  note,
}: {
  metric: "cost" | "tokens"
  data: TradeoffPoint[]
  note: React.ReactNode
}) {
  const isCost = metric === "cost"
  const heading = isCost
    ? "Cost / 1k puzzles · extrapolated"
    : "Thinking tokens / puzzle"
  const axisName = isCost ? "Cost" : "Tokens"
  const metricText = (value: number, n: number) =>
    isCost ? costText(value, n) : tokensText(value, n)
  // Two models can land on top of each other, and two labels printed on the
  // same pixel are worse than none. Proximity is measured as a fraction of each
  // axis range rather than by equality, because merely *near* collides just as
  // badly: DeepSeek at $0.11 and Qwen3 at $0.27 are different numbers about one
  // pixel apart on a $0-160 axis.
  //
  // Nudging the duplicates apart does not survive contact with the plot. Down
  // is the x-axis tick row, sideways is that same row, up walks into whatever
  // point sits above (Qwen3 reached Grok that way), and recharts ignores `dx`
  // on a LabelList. So coincident points get one shared label naming all of
  // them, anchored on the first, and the rest render nothing.
  const metricMax = Math.max(...data.map((point) => point[metric]), 0)
  // Accuracy is already a 0-100 percentage here; the metric axis runs from 0 to
  // its own maximum.
  const nearby = (a: TradeoffPoint, b: TradeoffPoint) =>
    // `accuracy` here is already scaled to 0-100, so the threshold is 8
    // percentage points - the same 8% of the axis the metric side uses. It read
    // 0.08 against a 0-100 value, which only ever matched an exact tie.
    Math.abs(a.accuracy - b.accuracy) <= 8 &&
    (metricMax === 0 || Math.abs(a[metric] - b[metric]) / metricMax <= 0.08)

  const clusters: TradeoffPoint[][] = []

  for (const point of data) {
    const cluster = clusters.find((members) =>
      members.some((member) => nearby(member, point))
    )

    if (cluster) cluster.push(point)
    else clusters.push([point])
  }

  const plotLabels = new Map<ModelId, string>()

  for (const cluster of clusters) {
    cluster.forEach((point, index) => {
      plotLabels.set(
        point.id,
        index === 0 ? cluster.map((member) => member.short).join(" · ") : ""
      )
    })
  }

  const shared = clusters.filter((cluster) => cluster.length > 1)

  const markLegend = data
    .map((point) => `${point.model} ${seriesMark(point.id).symbol}`)
    .join(", ")

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        {heading}
      </div>
      <ChartContainer
        config={{
          [metric]: { label: axisName },
          accuracy: { label: "Accuracy" },
        }}
        className="aspect-auto h-[260px] w-full"
      >
        <ScatterChart
          margin={{ left: 4, right: 24, top: 20, bottom: 20 }}
          title={`Accuracy against ${isCost ? "extrapolated cost per 1,000 puzzles" : "mean thinking tokens per puzzle"}`}
          desc={`One point per model, each drawn with its own shape and labelled on the plot: ${markLegend}. The values are in the accompanying data table.`}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey={metric}
            name={axisName}
            type="number"
            tickFormatter={(value) =>
              isCost
                ? `$${Number(value).toFixed(0)}`
                : `${Math.round(Number(value) / 1000)}k`
            }
          />
          <YAxis
            dataKey="accuracy"
            name="Accuracy"
            type="number"
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name, item) => {
                  // SAFETY: recharts hands the formatter the row from `data` behind the hovered series entry.
                  const row = item?.payload as TradeoffPoint | undefined
                  const n = row?.n ?? MIN_SAMPLE
                  const isMetric = item?.dataKey === metric

                  return (
                    <div className="flex w-full min-w-48 items-center justify-between gap-3 leading-none">
                      <span className="text-muted-foreground">
                        {isMetric
                          ? `${row?.model} · ${isCost ? "cost / 1k" : "avg tokens"}`
                          : `accuracy · n = ${n}`}
                      </span>
                      <span className="font-mono font-medium text-foreground tabular-nums">
                        {isMetric
                          ? metricText(Number(value), n)
                          : accuracyText(Number(value) / 100, n)}
                      </span>
                    </div>
                  )
                }}
              />
            }
          />
          {data.map((point) => (
            <Scatter
              key={point.id}
              name={point.model}
              data={[
                {
                  ...point,
                  plotLabel: plotLabels.get(point.id) ?? point.short,
                },
              ]}
              dataKey="accuracy"
              shape={seriesMark(point.id).symbol}
              fill={seriesColor(point.id)}
            >
              <LabelList
                dataKey="plotLabel"
                position="top"
                offset={10}
                textAnchor={edgeAnchor(point, metricMax, metric)}
                className="fill-muted-foreground text-2xs"
              />
            </Scatter>
          ))}
        </ScatterChart>
      </ChartContainer>
      <SeriesLegend models={data.map((point) => point.id)} variant="point" />
      <ChartTable
        caption={`Accuracy against ${isCost ? "cost per 1,000 puzzles" : "mean thinking tokens per puzzle"}, by model`}
        columns={["Model", axisName, "Accuracy", "Puzzles"]}
        rows={data.map((point) => ({
          key: point.id,
          header: point.model,
          cells: [
            metricText(isCost ? point.cost : point.tokens, point.n),
            accuracyText(point.accuracy / 100, point.n),
            `${point.n}`,
          ],
        }))}
      />
      <SampleNote>
        {note}
        {shared.length > 0 && (
          <>
            {" "}
            {shared
              .map((cluster) =>
                cluster.map((member) => member.model).join(" and ")
              )
              .join("; ")}{" "}
            land on the same spot here and share one label; the shapes are drawn
            over each other.
          </>
        )}
      </SampleNote>
    </div>
  )
}

function ResultsTable({ sorted }: { sorted: typeof SCOREBOARD }) {
  return (
    <Table>
      {/*
        `sr-only` because the card title already labels this table on screen.
        It has to be the first child: the HTML parser only accepts `<caption>`
        before the row groups, and `Table` paints it at the bottom anyway.
      */}
      <TableCaption className="sr-only">
        Per-model benchmark results on {META.benchmarkId}, ranked by accuracy.
        Puzzles, accuracy, legal-move rate, average tokens and average time are
        measured; Elo and cost per 1,000 puzzles are derived from them.
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">#</TableHead>
          <TableHead>Model</TableHead>
          <TableHead className="text-right">Puzzles</TableHead>
          <TableHead className="text-right">Accuracy</TableHead>
          <TableHead className="text-right">
            <DerivedLabel
              label="Elo"
              hint="Estimated, not played: average rating of the puzzles the model faced, adjusted by its solve rate. Rounded to 10 points until the sample reaches 100 puzzles."
            />
          </TableHead>
          <TableHead className="text-right">Legal move</TableHead>
          <TableHead className="text-right">
            <DerivedLabel
              label="Avg tokens"
              hint="Mean total tokens per attempted puzzle. Rounded to 100 tokens until the sample reaches 100 puzzles."
            />
          </TableHead>
          <TableHead className="text-right">Avg time</TableHead>
          <TableHead className="text-right">
            <DerivedLabel
              label="$ / 1k"
              hint="Extrapolated: mean recorded cost per puzzle multiplied by 1,000. Rounded to the dollar until the sample reaches 100 puzzles."
            />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((score, index) => {
          const model = modelById(score.model)
          return (
            <TableRow key={score.model}>
              <TableCell
                className={cn(
                  "font-mono text-muted-foreground",
                  index === 0 &&
                    "font-semibold text-[var(--chess-amber-strong)]"
                )}
              >
                {String(index + 1).padStart(2, "0")}
              </TableCell>
              <TableCell>
                <ModelChip id={score.model} />
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {model.vendor}
                </span>
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {score.n}
              </TableCell>
              <TableCell className="text-right font-medium">
                {accuracyText(score.accuracy, score.n)}
                <span className="ml-1.5 font-mono text-xs font-normal text-muted-foreground">
                  {Math.round(score.accuracy * score.n)}/{score.n}
                </span>
              </TableCell>
              <TableCell className="text-right font-mono">
                {eloText(score.elo, score.n)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {pct(score.legalRate, 0)}
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {tokensText(score.avgTokens, score.n)}
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {moveTimeText(score.avgMoveTime, score.n)}
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {costText(score.cost, score.n)}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function ProblemsView() {
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [selectedThemes, setSelectedThemes] = React.useState<CategoryId[]>([])
  const [side, setSide] = React.useState<"any" | "w" | "b">("any")
  const [ratingRange, setRatingRange] =
    React.useState<[number, number]>(RATING_BOUNDS)
  const [sort, setSort] = React.useState("popularity")

  const filtered = React.useMemo(() => {
    return PUZZLES.filter((puzzle) => {
      if (puzzle.rating < ratingRange[0] || puzzle.rating > ratingRange[1]) {
        return false
      }
      if (
        selectedThemes.length > 0 &&
        !puzzle.themes.some((theme) => selectedThemes.includes(theme))
      ) {
        return false
      }
      if (side !== "any" && puzzle.side !== side) {
        return false
      }
      return true
    }).sort((a, b) => {
      if (sort === "rating") {
        return b.rating - a.rating
      }
      if (sort === "rating-asc") {
        return a.rating - b.rating
      }
      return b.popularity - a.popularity
    })
  }, [ratingRange, selectedThemes, side, sort])

  const activeIndex = filtered.findIndex((puzzle) => puzzle.id === activeId)
  const activePuzzle = activeIndex >= 0 ? filtered[activeIndex] : null

  const clearFilters = () => {
    setSelectedThemes([])
    setSide("any")
    setRatingRange(RATING_BOUNDS)
  }

  const randomPuzzle = () => {
    if (filtered.length === 0) {
      return
    }
    const index = Math.floor(Math.random() * filtered.length)
    setActiveId(filtered[index].id)
  }

  const stepFocus = (direction: number) => {
    if (filtered.length === 0) {
      return
    }
    const next = (activeIndex + direction + filtered.length) % filtered.length
    setActiveId(filtered[next].id)
  }

  if (activePuzzle) {
    return (
      <ProblemFocus
        key={activePuzzle.id}
        puzzle={activePuzzle}
        index={activeIndex}
        total={filtered.length}
        onBack={() => setActiveId(null)}
        onStep={stepFocus}
      />
    )
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 border-b pb-7 lg:grid-cols-[1.35fr_0.85fr] lg:items-end">
        <div className="space-y-4">
          <div className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Problem set - {filtered.length} of {PUZZLES.length.toLocaleString()}
          </div>
          <div className="max-w-3xl space-y-3">
            <h1 className="max-w-[20ch] text-4xl font-semibold tracking-tight">
              Browse the puzzle bank.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              Every board is a lichess-style position tagged by the themes that
              solve it. Click a board to inspect the position, play a legal
              move, and compare model traces. These are the{" "}
              {META.puzzleCount.toLocaleString()} puzzles models have been run
              on, sampled from the {META.datasetSize.toLocaleString()}-puzzle
              benchmark.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
          <Button size="sm" onClick={randomPuzzle}>
            <Shuffle data-icon="inline-start" />
            Random
          </Button>
          <FiltersPopover
            selectedThemes={selectedThemes}
            setSelectedThemes={setSelectedThemes}
            side={side}
            setSide={setSide}
            ratingRange={ratingRange}
            setRatingRange={setRatingRange}
            onClear={clearFilters}
          />
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Showing
          </span>
          <span className="text-sm font-medium">{filtered.length} puzzles</span>
          {selectedThemes.map((theme) => (
            <Button
              key={theme}
              size="xs"
              variant="secondary"
              onClick={() =>
                setSelectedThemes(
                  selectedThemes.filter((item) => item !== theme)
                )
              }
            >
              {categoryById(theme)?.label ?? theme}
              <X data-icon="inline-end" />
            </Button>
          ))}
          {(ratingRange[0] !== RATING_BOUNDS[0] ||
            ratingRange[1] !== RATING_BOUNDS[1]) && (
            <Button
              size="xs"
              variant="secondary"
              onClick={() => setRatingRange(RATING_BOUNDS)}
            >
              Rating {ratingRange[0]}-{ratingRange[1]}
              <X data-icon="inline-end" />
            </Button>
          )}
          {side !== "any" && (
            <Button
              size="xs"
              variant="secondary"
              onClick={() => setSide("any")}
            >
              {side === "w" ? "White" : "Black"} to move
              <X data-icon="inline-end" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort</span>
          <Select
            value={sort}
            onValueChange={(value) => value && setSort(value)}
          >
            <SelectTrigger size="sm" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="popularity">Popularity</SelectItem>
              <SelectItem value="rating">Rating high to low</SelectItem>
              <SelectItem value="rating-asc">Rating low to high</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <CardTitle as="h2">No puzzles match.</CardTitle>
            <CardDescription>
              Try widening the rating range or clearing theme filters.
            </CardDescription>
            <Button onClick={clearFilters}>
              <RotateCcw data-icon="inline-start" />
              Clear filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((puzzle) => (
            <ProblemCard
              key={puzzle.id}
              puzzle={puzzle}
              onOpen={() => setActiveId(puzzle.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FiltersPopover({
  selectedThemes,
  setSelectedThemes,
  side,
  setSide,
  ratingRange,
  setRatingRange,
  onClear,
}: {
  selectedThemes: CategoryId[]
  setSelectedThemes: (themes: CategoryId[]) => void
  side: "any" | "w" | "b"
  setSide: (side: "any" | "w" | "b") => void
  ratingRange: [number, number]
  setRatingRange: (range: [number, number]) => void
  onClear: () => void
}) {
  const filterCount =
    selectedThemes.length +
    (side !== "any" ? 1 : 0) +
    (ratingRange[0] !== RATING_BOUNDS[0] || ratingRange[1] !== RATING_BOUNDS[1]
      ? 1
      : 0)

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button size="sm" variant="outline">
            <Filter data-icon="inline-start" />
            Filters
            {filterCount > 0 ? (
              <Badge variant="secondary">{filterCount}</Badge>
            ) : null}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 gap-4 p-4">
        <PopoverHeader>
          <PopoverTitle>Refine puzzles</PopoverTitle>
          <PopoverDescription>
            {PUZZLES.length} evaluated positions across {CATEGORIES.length}{" "}
            theme buckets.
          </PopoverDescription>
        </PopoverHeader>
        <Separator />
        <div className="space-y-2">
          <div className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Themes
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((category) => {
              const selected = selectedThemes.includes(category.id)
              return (
                <Button
                  key={category.id}
                  size="xs"
                  variant={selected ? "default" : "outline"}
                  onClick={() => {
                    setSelectedThemes(
                      selected
                        ? selectedThemes.filter(
                            (theme) => theme !== category.id
                          )
                        : [...selectedThemes, category.id]
                    )
                  }}
                >
                  {category.label}
                </Button>
              )
            })}
          </div>
        </div>
        <div className="grid gap-2">
          <div className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Side to move
          </div>
          <Select
            value={side}
            onValueChange={(value) => {
              // SAFETY: the only SelectItems rendered carry these three values.
              setSide(value as "any" | "w" | "b")
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Either side</SelectItem>
              <SelectItem value="w">White</SelectItem>
              <SelectItem value="b">Black</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-3">
          <div className="flex items-center justify-between text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            <span>Rating</span>
            <span className="font-mono tracking-normal">
              {ratingRange[0]}-{ratingRange[1]}
            </span>
          </div>
          <Slider
            min={RATING_BOUNDS[0]}
            max={RATING_BOUNDS[1]}
            step={RATING_STEP}
            value={ratingRange}
            onValueChange={(value) => {
              const range = Array.isArray(value) ? value : RATING_BOUNDS
              setRatingRange([
                range[0] ?? RATING_BOUNDS[0],
                range[1] ?? RATING_BOUNDS[1],
              ])
            }}
          />
          <p className="text-xs text-muted-foreground">
            Range covers the {PUZZLES.length} loaded puzzles, rated{" "}
            {RATING_BOUNDS[0]} to {RATING_BOUNDS[1]}.
          </p>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-muted-foreground">
            {filterCount} active
          </span>
          <Button size="sm" variant="ghost" onClick={onClear}>
            Clear all
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ProblemCard({
  puzzle,
  onOpen,
}: {
  puzzle: PuzzleItem
  onOpen: () => void
}) {
  // The card is the only focusable thing here, so its name has to carry the
  // position too. Meta first, position last, and the board itself is marked
  // decorative so the same squares are not read out twice.
  const label = React.useMemo(() => {
    const themes = puzzle.themes.map(
      (theme) => categoryById(theme)?.label ?? theme
    )
    const meta = [
      `Puzzle ${puzzle.id}`,
      `rating ${puzzle.rating}`,
      `${puzzle.side === "w" ? "White" : "Black"} to move`,
      themes.length > 0 ? `themes ${themes.join(", ")}` : null,
    ].filter((part): part is string => part !== null)

    return `${meta.join(", ")}. ${piecesSummary(puzzle.fen)}`
  }, [puzzle])

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={label}
      className="cursor-pointer gap-3 rounded-lg transition-transform outline-none hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen()
        }
      }}
    >
      <CardContent className="pt-0">
        <ChessBoard fen={puzzle.fen} interactive={false} small decorative />
      </CardContent>
      <CardContent className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-mono text-xs text-muted-foreground">
            {puzzle.id}
          </span>
          <span className="font-mono text-sm font-semibold tabular-nums">
            {puzzle.rating}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <SideDot side={puzzle.side} />
          {puzzle.side === "w" ? "White" : "Black"} to move
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-1 text-sm font-medium">
          {puzzle.themes.map((theme) => (
            <span
              key={theme}
              className="border-b-2 border-[var(--chess-amber)]/60"
            >
              {categoryById(theme)?.label ?? theme}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function ProblemFocus({
  puzzle,
  index,
  total,
  onBack,
  onStep,
}: {
  puzzle: PuzzleItem
  index: number
  total: number
  onBack: () => void
  onStep: (direction: number) => void
}) {
  const [boardFen, setBoardFen] = React.useState(puzzle.fen)
  const [lastMove, setLastMove] = React.useState<{
    from: string
    to: string
  } | null>(null)
  const [feedback, setFeedback] = React.useState<{
    ok: boolean
    played: string
    expected: string
    san: string
  } | null>(null)

  const hintId = React.useId()
  const attempts = React.useMemo(() => solutionsFor(puzzle), [puzzle])
  const solved = attempts.filter((attempt) => attempt.correct).length
  const correctionArrows = React.useMemo(() => {
    if (!feedback || feedback.ok) {
      return []
    }

    const arrow = moveArrow(feedback.expected)
    return arrow ? [arrow] : []
  }, [feedback])

  // DESIGN.md forbids raw UCI in user-facing feedback when SAN is available, so
  // the expected move is resolved back to SAN from the starting position.
  const expectedMove = React.useMemo(() => {
    const expected = puzzle.solution[0]

    if (!expected) {
      return ""
    }

    const move = playMove(
      puzzle.fen,
      expected.slice(0, 2),
      expected.slice(2, 4),
      expected[4]
    )

    return move?.san ?? readableMove(expected)
  }, [puzzle])

  const handleMove = (move: PlayedMove) => {
    const played = `${move.from}${move.to}${move.promotion ?? ""}`
    const expected = puzzle.solution[0]
    if (!expected) {
      return
    }

    setBoardFen(move.fen)
    setLastMove({ from: move.from, to: move.to })
    setFeedback({
      ok: played === expected,
      played,
      expected,
      san: move.san,
    })
  }

  const playedMove = feedback
    ? feedback.san || readableMove(feedback.played)
    : ""
  const announcement = !feedback
    ? ""
    : feedback.ok
      ? `Correct. ${playedMove} is the puzzle move.`
      : `Not the puzzle move. You played ${playedMove}. The puzzle move is ${expectedMove}.`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Button size="sm" variant="ghost" onClick={onBack}>
          <ArrowLeft data-icon="inline-start" />
          All puzzles
        </Button>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {String(index + 1).padStart(2, "0")} /{" "}
            {String(total).padStart(2, "0")}
          </span>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Previous puzzle"
            onClick={() => onStep(-1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Next puzzle"
            onClick={() => onStep(1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <section className="space-y-5 border-b pb-6">
        <div>
          <div className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Puzzle {puzzle.id}
          </div>
          <h1 className="mt-2 max-w-3xl text-2xl font-semibold tracking-tight">
            {puzzle.caption}
          </h1>
        </div>
        <div className="grid gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-4">
          <MetaCell label="Side to move">
            <span className="flex items-center gap-2">
              <SideDot side={puzzle.side} />
              {puzzle.side === "w" ? "White" : "Black"}
            </span>
          </MetaCell>
          <MetaCell label="Rating">
            <span className="font-mono">{puzzle.rating}</span>
          </MetaCell>
          <MetaCell label="Popularity">
            <span className="font-mono">
              {puzzle.popularity}
              <span className="text-muted-foreground">/100</span>
            </span>
          </MetaCell>
          <MetaCell label={`Themes - ${puzzle.themes.length}`}>
            <span className="flex flex-wrap gap-x-2 gap-y-1">
              {puzzle.themes.map((theme) => (
                <span
                  key={theme}
                  className="border-b-2 border-[var(--chess-amber)]/60"
                >
                  {categoryById(theme)?.label ?? theme}
                </span>
              ))}
            </span>
          </MetaCell>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(360px,560px)_1fr]">
        <div className="space-y-3">
          <Card className="rounded-lg">
            <CardContent>
              <ChessBoard
                fen={boardFen}
                lastMove={lastMove}
                arrows={correctionArrows}
                onMove={handleMove}
                describedBy={hintId}
              />
            </CardContent>
          </Card>
          {/*
            Always mounted and never toggled between hidden and visible: the
            visual status line below reserves its space with `invisible`, which
            some screen readers skip when the text changes in the same tick.
          */}
          <p className="sr-only" role="status">
            {announcement}
          </p>
          <MoveEntry fen={boardFen} hintId={hintId} onPlay={handleMove} />
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
              {boardFen}
            </span>
            <div
              aria-hidden="true"
              data-result={feedback?.ok ? "success" : "miss"}
              className={cn(
                "cb-move-line order-3 sm:order-none sm:w-[15.75rem]",
                !feedback && "invisible"
              )}
            >
              <span>
                {feedback ? (
                  feedback.ok ? (
                    <>
                      Move accepted: <strong>{playedMove}</strong>
                    </>
                  ) : (
                    <>
                      <strong>{playedMove}</strong> missed - try{" "}
                      <strong>{expectedMove}</strong>
                    </>
                  )
                ) : (
                  "Move pending"
                )}
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setBoardFen(puzzle.fen)
                setLastMove(null)
                setFeedback(null)
              }}
            >
              <RotateCcw data-icon="inline-start" />
              Reset
            </Button>
          </div>
        </div>

        <Card className="rounded-lg">
          <CardHeader>
            <div>
              <CardDescription>Model attempts</CardDescription>
              <CardTitle as="h2">
                {solved} of {attempts.length} solved this puzzle
              </CardTitle>
            </div>
            <CardAction>
              <ul className="flex gap-2.5">
                {attempts.map((attempt) => (
                  <li key={attempt.model} className="flex">
                    <AttemptDot attempt={attempt} />
                  </li>
                ))}
              </ul>
            </CardAction>
          </CardHeader>
          <CardContent className="cb-model-attempts">
            <Accordion className="border-t">
              {attempts.map((attempt) => {
                const model = modelById(attempt.model)
                return (
                  <AccordionItem key={attempt.model} value={attempt.model}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="cb-attempt-row w-full">
                        <span
                          className={cn(
                            "grid size-6 place-items-center rounded-full",
                            attempt.correct
                              ? "bg-move-correct text-move-correct-foreground"
                              : "border border-dashed border-move-incorrect text-move-incorrect"
                          )}
                        >
                          {attempt.correct ? (
                            <Check className="size-3.5" />
                          ) : (
                            <X className="size-3.5" />
                          )}
                        </span>
                        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                          <ModelDot model={attempt.model} />
                          <span className="truncate font-semibold">
                            {model.name}
                          </span>
                          <span className="cb-provider-pill truncate">
                            {model.vendor}
                          </span>
                        </span>
                        <span className="min-w-0">
                          <span className="block text-2xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                            Played
                          </span>
                          <span
                            className={cn(
                              "font-mono text-sm",
                              !attempt.correct &&
                                "text-muted-foreground line-through decoration-destructive/60"
                            )}
                          >
                            {attempt.movePretty}
                          </span>
                        </span>
                        <span className="justify-self-end font-mono text-xs text-muted-foreground tabular-nums">
                          {attempt.thinkingTokens.toLocaleString()} tok -{" "}
                          {(attempt.thinkingMs / 1000).toFixed(1)}s
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <pre className="max-h-72 overflow-auto rounded-md border bg-muted/50 p-3 font-mono text-xs leading-6 whitespace-pre-wrap">
                        {attempt.transcript}
                      </pre>
                      <TranscriptActions puzzle={puzzle} attempt={attempt} />
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

/**
 * One model's result in the attempt summary row.
 *
 * The tooltip trigger is a real button, so it carries its own name: `ModelDot`
 * is `aria-hidden` and would otherwise leave a row of unnamed buttons (WCAG
 * 4.1.2). Solved and missed are told apart by a check or cross badge and by a
 * solid or dashed edge, never by color and opacity alone (WCAG 1.4.1), using
 * the same `move-correct` / `move-incorrect` vocabulary as the rows below.
 */
function AttemptDot({ attempt }: { attempt: SolutionAttempt }) {
  const model = modelById(attempt.model)
  const state = attempt.correct ? "solved" : "missed"

  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={`${model.name}: ${state}`}
        className={cn(
          "relative grid size-6 place-items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          attempt.correct
            ? "border border-move-correct/50"
            : "border border-dashed border-move-incorrect/70"
        )}
      >
        <ModelDot
          model={attempt.model}
          className={cn(!attempt.correct && "opacity-50 grayscale")}
        />
        <span
          aria-hidden="true"
          className={cn(
            "absolute -right-1 -bottom-1 grid size-3 place-items-center rounded-full",
            attempt.correct
              ? "bg-move-correct text-move-correct-foreground"
              : "bg-move-incorrect text-move-incorrect-foreground"
          )}
        >
          {attempt.correct ? (
            <Check className="size-2" strokeWidth={4} />
          ) : (
            <X className="size-2" strokeWidth={4} />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {model.name}: {state}
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Chessground only exposes pointer and drag handlers, so a typed move is the
 * keyboard and switch equivalent of dragging a piece (the same affordance
 * lichess offers). It routes into the same handler as the drag path, so the
 * correct/incorrect feedback is identical whichever way the move arrives.
 */
function MoveEntry({
  fen,
  hintId,
  onPlay,
}: {
  fen: string
  hintId: string
  onPlay: (move: PlayedMove) => void
}) {
  const inputId = React.useId()
  const [value, setValue] = React.useState("")
  const [rejected, setRejected] = React.useState<{
    fen: string
    message: string
  } | null>(null)

  // "... is not a legal move in this position" stops being true once the
  // position changes, whether by a drag, a typed move, or Reset, so the error is
  // tied to the position it was raised against rather than cleared in an effect.
  const error = rejected && rejected.fen === fen ? rejected.message : ""

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const move = parseMoveInput(fen, value)

    if (!move) {
      setRejected({
        fen,
        message: value.trim()
          ? `${value.trim()} is not a legal move in this position.`
          : "Type a move first, for example Nf3.",
      })
      return
    }

    setRejected(null)
    setValue("")
    onPlay(move)
  }

  return (
    <form onSubmit={submit} className="grid gap-2">
      <label
        htmlFor={inputId}
        className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase"
      >
        Play a move
      </label>
      <div className="flex items-center gap-2">
        <input
          id={inputId}
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            if (rejected) {
              setRejected(null)
            }
          }}
          aria-describedby={hintId}
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Nf3 or g1f3"
          className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 font-mono text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
        />
        <Button type="submit" size="sm" variant="outline">
          Play
        </Button>
      </div>
      {/*
        One element that swaps between hint and error, so nothing is inserted or
        removed on a failed entry and the row height never moves.
      */}
      <p
        id={hintId}
        aria-live="polite"
        className={cn(
          "text-xs text-muted-foreground",
          error && "text-destructive"
        )}
      >
        {error ||
          "Type a move in SAN or UCI and press Enter - the same as dragging the piece."}
      </p>
    </form>
  )
}

/**
 * The transcript above is the trace, so these actions take it away rather than
 * link to a viewer that does not exist: a JSON download of the recorded attempt
 * and a clipboard copy of the trace text.
 */
function TranscriptActions({
  puzzle,
  attempt,
}: {
  puzzle: PuzzleItem
  attempt: SolutionAttempt
}) {
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!copied) {
      return
    }

    const timer = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])

  return (
    <div className="mt-3 flex items-center justify-end gap-2">
      <span className="mr-auto font-mono text-xs text-muted-foreground">
        {attempt.transcript.split("\n").length} lines
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={() =>
          downloadFile(
            attemptFilename(puzzle.id, attempt.model, "json"),
            attemptJson(puzzle, attempt),
            "application/json"
          )
        }
      >
        <Download data-icon="inline-start" />
        Raw JSON
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(attempt.transcript)
            setCopied(true)
          } catch {
            downloadFile(
              attemptFilename(puzzle.id, attempt.model, "txt"),
              attempt.transcript,
              "text/plain;charset=utf-8"
            )
          }
        }}
      >
        {copied ? (
          <Check data-icon="inline-start" />
        ) : (
          <Copy data-icon="inline-start" />
        )}
        {copied ? "Copied" : "Copy trace"}
      </Button>
    </div>
  )
}

function MetaCell({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-background p-4">
      <div className="text-2xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium">{children}</div>
    </div>
  )
}

function DocsView() {
  const ratings = PUZZLES.map((puzzle) => puzzle.rating)
  const rowCounts = Object.values(META.rowsByModel)
  const minRows = Math.min(...rowCounts)
  const maxRows = Math.max(...rowCounts)
  const maxMoveTime = Math.max(...SCOREBOARD.map((score) => score.avgMoveTime))

  return (
    <div className="space-y-8">
      <section className="space-y-4 border-b pb-8">
        <div className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Documentation - v{META.version}
        </div>
        <h1 className="max-w-[20ch] text-4xl font-semibold tracking-tight">
          How we evaluate.
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Every number on this site comes from one run of the same{" "}
          {META.benchmarkId} set: the same puzzles, the same single-move prompt
          and the same scorer for every model. This page records how the puzzles
          were chosen, what each model was asked, what counts as solved, and
          which figures are measured rather than derived from the measurement.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardDescription>Protocol</CardDescription>
            <CardTitle as="h2">Evaluation protocol</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 leading-7 text-muted-foreground">
            <p>
              The benchmark is {META.datasetSize.toLocaleString()} puzzles from
              the public lichess puzzle database, 100 from each of five rating
              bands: under 1200, 1200-1599, 1600-1999, 2000-2399, and 2400 and
              up. Sampling is seeded, so the same set comes back every time it
              is rebuilt. A puzzle qualifies only at 80 or more popularity, 300
              or more recorded plays, and a rating deviation of 110 or less;
              mate-in-one puzzles are dropped, because a second, equally valid
              mate would be scored as a miss; and every trigger and solution
              move is replayed with chess.js before the puzzle is admitted.
            </p>
            <Separator />
            <div>
              <h3 className="font-medium text-foreground">Prompt contract</h3>
              <p className="mt-2">
                Each model receives a position in FEN, the side to move, and a
                strict instruction to output exactly one legal move token in UCI
                or SAN, with no extra text. Answers are normalized to UCI for
                scoring, and invalid formats are counted separately from
                valid-but-wrong moves. Longer puzzles are played out turn by
                turn: a correct move is answered with the expected opponent
                reply and a request for the next move in the same conversation,
                and a puzzle ends at the first wrong move, unusable answer, or
                provider error. The legal move column is the share of attempts
                that did not end on an unusable answer.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-foreground">Scoring</h3>
              <p className="mt-2">
                Accuracy is the share of puzzles where the model played every
                player move of the solution line correctly, one move per turn,
                before the attempt stopped. That is the only measured headline
                number.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-foreground">Derived figures</h3>
              <p className="mt-2">
                Elo is an estimate, not a played rating: the average rating of
                the puzzles a model faced plus{" "}
                <span className="font-mono">400 · log10(p / (1 - p))</span> for
                solve rate <span className="font-mono">p</span>. Cost per 1,000
                puzzles extrapolates the mean recorded cost of {SAMPLE_LABEL}{" "}
                attempts. Both are shown rounded to the precision this sample
                supports, and there is currently one benchmark round, so no
                rating progression exists yet.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-foreground">Sample size</h3>
              <p className="mt-2">
                Each model answered {SAMPLE_LABEL} of the{" "}
                {META.datasetSize.toLocaleString()} benchmark puzzles, so one
                puzzle is worth {puzzleWeight(MIN_SAMPLE).toFixed(0)} percentage
                points. Theme buckets are thinner still: a bucket with no puzzle
                in the sample is reported as absent rather than scored.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-foreground">Thinking tokens</h3>
              <p className="mt-2">
                Reasoning-enabled models report reasoning plus visible output
                tokens. Traces stay attached to each puzzle so model behaviour
                can be audited.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>At a glance</CardDescription>
            <CardTitle as="h2">Benchmark shape</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-5">
            <Metric
              label="Puzzles sampled"
              value={`${META.puzzleCount.toLocaleString()} / ${META.datasetSize.toLocaleString()}`}
              mono
            />
            <Metric label="Themes" value={CATEGORIES.length.toString()} mono />
            <Metric
              label="Rating range"
              value={`${Math.min(...ratings)}-${Math.max(...ratings)}`}
              mono
            />
            <Metric
              label="Time / move"
              value={`<= ${Math.ceil(maxMoveTime)}s`}
              mono
            />
            <Metric
              label="Rows / model"
              value={
                minRows === maxRows ? `${maxRows}` : `${minRows}-${maxRows}`
              }
              mono
            />
            <Metric label="Token cap" value={META.maxOutputTokens} mono />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ChessBoard({
  fen,
  interactive = true,
  onMove,
  lastMove,
  arrows = NO_ARROWS,
  small = false,
  decorative = false,
  describedBy,
}: {
  fen: string
  interactive?: boolean
  onMove?: (move: PlayedMove) => void
  lastMove?: { from: string; to: string } | null
  arrows?: BoardArrow[]
  small?: boolean
  /** The position is already described by an ancestor's accessible name. */
  decorative?: boolean
  describedBy?: string
}) {
  const boardRef = React.useRef<HTMLDivElement>(null)
  const apiRef = React.useRef<ChessgroundApi | null>(null)
  const skipNextSetRef = React.useRef(false)
  const reducedMotion = usePreferReducedMotion()
  const latestRef = React.useRef({
    fen,
    lastMove,
    arrows,
    onMove,
    reducedMotion,
  })

  // Declared before the board effects so it runs first in every commit: the
  // Chessground instance outlives each render, and its move handler has to read
  // the position the user is currently looking at, not the one it was built on.
  React.useEffect(() => {
    latestRef.current = { fen, lastMove, arrows, onMove, reducedMotion }
  })

  // Construction only. `viewOnly` and `drawable.visible` cannot be changed
  // through `api.set()`, so the instance is rebuilt only when they change,
  // which in practice means never for a mounted board.
  React.useEffect(() => {
    const element = boardRef.current

    if (!element) {
      return
    }

    const initial = latestRef.current
    const color = turnColor(initial.fen)
    const config: ChessgroundConfig = {
      fen: boardOnlyFen(initial.fen),
      orientation: "white",
      turnColor: color,
      check: isCheck(initial.fen) ? color : false,
      lastMove: initial.lastMove
        ? [safeKey(initial.lastMove.from), safeKey(initial.lastMove.to)]
        : undefined,
      coordinates: !small,
      coordinatesOnSquares: false,
      ranksPosition: "right",
      viewOnly: !interactive,
      disableContextMenu: true,
      trustAllEvents: true,
      animation: boardAnimation(initial.reducedMotion, small),
      highlight: {
        lastMove: true,
        check: true,
      },
      movable: {
        free: false,
        color: interactive ? color : undefined,
        dests: interactive ? legalDests(initial.fen) : undefined,
        showDests: interactive,
        rookCastle: true,
        events: {
          after: (orig, dest) => {
            const current = latestRef.current
            const move = playMove(current.fen, orig, dest)

            if (!move) {
              apiRef.current?.set({ fen: boardOnlyFen(current.fen) })
              return
            }

            current.onMove?.(move)
          },
        },
      },
      premovable: {
        enabled: false,
      },
      draggable: {
        enabled: interactive,
        showGhost: true,
      },
      selectable: {
        enabled: interactive,
      },
      drawable: {
        enabled: interactive && !small,
        visible: interactive && !small,
        defaultSnapToValidMove: true,
        eraseOnMovablePieceClick: false,
        // Chessground owns this key name.
        ["autoShapes"]: initial.arrows,
      },
    }

    const api = Chessground(element, config)
    apiRef.current = api
    // The update effect below runs in this same commit; the config it would
    // apply is the one just used here.
    skipNextSetRef.current = true

    return () => {
      api.destroy()
      apiRef.current = null
      element.innerHTML = ""
    }
  }, [interactive, small])

  // Updates. `api.set()` diffs and animates the position instead of tearing the
  // whole board down, which is what made every move discard its own animation.
  React.useEffect(() => {
    const api = apiRef.current

    if (!api) {
      return
    }

    if (skipNextSetRef.current) {
      skipNextSetRef.current = false
      return
    }

    const color = turnColor(fen)

    api.set({
      fen: boardOnlyFen(fen),
      turnColor: color,
      check: isCheck(fen) ? color : false,
      lastMove: lastMove
        ? [safeKey(lastMove.from), safeKey(lastMove.to)]
        : undefined,
      animation: boardAnimation(reducedMotion, small),
      movable: {
        color: interactive ? color : undefined,
        dests: interactive ? legalDests(fen) : undefined,
      },
      drawable: {
        // Chessground owns this key name.
        ["autoShapes"]: arrows,
      },
    })
  }, [arrows, fen, interactive, lastMove, reducedMotion, small])

  const summary = React.useMemo(() => boardSummary(fen), [fen])

  return (
    <div
      ref={boardRef}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : summary}
      aria-describedby={decorative ? undefined : describedBy}
      className={cn(
        "chessground-board aspect-square w-full overflow-hidden rounded-lg ring-1 ring-border",
        small && "rounded-md"
      )}
    />
  )
}

function ModelChip({ id }: { id: ModelId }) {
  const model = modelById(id)
  return (
    <span className="inline-flex items-center gap-2">
      <ModelDot model={id} />
      <span className="font-medium">{model.name}</span>
    </span>
  )
}

function ModelDot({
  model,
  className,
}: {
  model: ModelId
  className?: string
}) {
  const lab = modelById(model).lab

  return (
    <span
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center",
        className
      )}
      aria-hidden="true"
    >
      <LabSvg lab={lab} />
    </span>
  )
}

function LabSvg({ lab }: { lab: DashboardLabId }) {
  const logo: LabLogo = LAB_SVGS[lab]

  if (!logo.icon) {
    return <LabMonogram label={logo.label} />
  }

  const { light: Light, dark: Dark } = logo.icon

  return (
    <>
      <Light className="block size-full dark:hidden" />
      <Dark className="hidden size-full dark:block" />
    </>
  )
}

/**
 * Stand-in for a lab whose mark has not been vendored yet. It keeps model
 * identity legible instead of leaving a hole, and never reaches the network.
 */
function LabMonogram({ label }: { label: string }) {
  return (
    <span className="grid size-full place-items-center rounded-[0.2rem] bg-muted [font-size:0.55rem] leading-none font-semibold text-muted-foreground">
      {label.slice(0, 1).toUpperCase()}
    </span>
  )
}

function SideDot({ side }: { side: "w" | "b" }) {
  return (
    <span
      className={cn(
        "inline-block size-2.5 rounded-full",
        side === "w"
          ? "bg-white ring-1 ring-border"
          : "bg-neutral-950 dark:bg-neutral-100"
      )}
    />
  )
}
