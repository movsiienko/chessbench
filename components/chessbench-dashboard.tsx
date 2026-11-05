"use client"

import {
  attemptJson,
  attemptTranscript,
  turnReasoning,
} from "@/lib/benchmarks/attempt-evidence"
import * as React from "react"
import { Chessground } from "@lichess-org/chessground"
import type { Api as ChessgroundApi } from "@lichess-org/chessground/api"
import type { Config as ChessgroundConfig } from "@lichess-org/chessground/config"
import type { DrawShape as BoardArrow } from "@lichess-org/chessground/draw"
import type * as cg from "@lichess-org/chessground/types"
import {
  ArrowLeft,
  Ban,
  BarChart3,
  BookOpen,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  CircleHelp,
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
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
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
  isTypingTarget,
  useThemeShortcutLabel,
} from "@/components/theme-provider"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { CategoryId } from "@/lib/benchmarks/dashboard-build"
import type { DashboardData } from "@/lib/benchmarks/dashboard-load"
import type { LichessPuzzleAttemptRow } from "@/lib/benchmarks/local-runner"
import type { LabId } from "@/lib/benchmarks/models"
import { usePreferReducedMotion } from "@/hooks/use-prefers-reduced-motion"
import { escapeCsv } from "@/lib/benchmarks/csv"
import {
  boardOnlyFen,
  boardSummary,
  isCheck,
  legalDests,
  moveArrow,
  piecesSummary,
  playMove,
  turnColor,
  type PlayedMove,
} from "@/lib/chess/moves"
import {
  isLineLocked,
  playOpponentReply,
  playSolverMove,
  startPuzzleLine,
} from "@/lib/chess/puzzle-line"
import { PUZZLE_STEP_SHORTCUTS, puzzleStepForKey } from "@/lib/puzzle-step-keys"
import { cn } from "@/lib/utils"

/** A scoreboard entry id: one model at one reasoning level. */
type ModelId = string
type Score = DashboardData["scoreboard"][number]
type PuzzleItem = DashboardData["puzzles"][number]
type SolutionAttempt = PuzzleItem["attempts"][number]

/**
 * How an unsolved attempt ended, as an icon: a cross for a wrong move, a ban
 * for an illegal one, a question mark when no move could be read at all.
 */
const outcomeIcons: Record<SolutionAttempt["status"], LucideIcon> = {
  ok: X,
  wrong_move: X,
  illegal_move: Ban,
  invalid_format: CircleHelp,
  timeout: Clock,
  error: X,
}

function OutcomeIcon({
  attempt,
  ...props
}: { attempt: SolutionAttempt } & React.ComponentProps<LucideIcon>) {
  const Icon = attempt.solved ? Check : outcomeIcons[attempt.status]
  return <Icon {...props} />
}

/** "7 illegal · 1 invalid format", leaving out zero counts; empty when both are zero. */
function unplayableCounts(illegalMoves: number, invalidFormats: number) {
  return [
    illegalMoves > 0 && `${illegalMoves} illegal`,
    invalidFormats > 0 && `${invalidFormats} invalid format`,
  ]
    .filter(Boolean)
    .join(" · ")
}

/** An unreadable answer is not a chess mistake, so it is drawn neutral, not red. */
function isUnreadable(attempt: SolutionAttempt) {
  return !attempt.solved && attempt.status === "invalid_format"
}

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
} as const satisfies Record<LabId, LabLogo>

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

/**
 * Everything derived from the loaded data. Components read it through
 * `useDashboard()` under the names these values had as module constants.
 */
function deriveDashboard(data: DashboardData) {
  const MODELS = data.models
  const SCOREBOARD = data.scoreboard
  const CATEGORY = data.category
  const CATEGORIES = data.categories
  const PUZZLES = data.puzzles
  const META = data.meta

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

  function seriesMark(model: ModelId) {
    const index = Math.max(
      0,
      MODELS.findIndex((entry) => entry.id === model)
    )

    return SERIES_MARKS[index % SERIES_MARKS.length]
  }

  /** Spoken form of the dash patterns, for a chart's `desc`. */
  function describeStrokes(models: ModelId[]) {
    return (
      models
        // Naming the actual pattern, not just "dashed": most series are dashed,
        // so collapsing them left a description that could not be used to tell
        // one line from another.
        .map((model) => `${modelById(model).name} ${seriesMark(model).stroke}`)
        .join(", ")
    )
  }

  function modelById(id: ModelId) {
    return MODELS.find((model) => model.id === id) ?? MODELS[0]
  }

  function categoryById(id: CategoryId) {
    return CATEGORIES.find((category) => category.id === id)
  }

  // Scores come from a small per-model puzzle sample, so derived values are
  // rendered at the precision that sample supports and stay marked as estimates
  // until the sample is large enough to carry more digits.
  const MIN_SAMPLE = META.sampleSize.min
  const SAMPLE_LABEL =
    META.sampleSize.min === META.sampleSize.max
      ? `${META.sampleSize.min}`
      : `${META.sampleSize.min}-${META.sampleSize.max}`

  /** Largest measured bucket size across the given models. */
  function bucketSize(category: CategoryId, models: ModelId[]) {
    return models.reduce(
      (largest, model) => Math.max(largest, CATEGORY[model]?.[category].n ?? 0),
      0
    )
  }

  function categoryAxisLabel(
    category: DashboardData["categories"][number],
    models: ModelId[]
  ) {
    return `${category.label} · n=${bucketSize(category.id, models)}`
  }

  const RATING_STEP = META.ratingStep
  const RATING_BOUNDS = META.ratingBounds

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
      "illegal_move_attempts",
      "invalid_format_attempts",
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
          score.avgTokens ?? "",
          score.avgMoveTime,
          score.elo,
          score.cost ?? "",
          score.illegalMoves,
          score.invalidFormats,
        ]
      })

    return [header, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .concat("")
      .join("\n")
  }

  return {
    MODELS,
    SCOREBOARD,
    CATEGORY,
    CATEGORIES,
    PUZZLES,
    META,
    modelChartConfig,
    seriesMark,
    describeStrokes,
    modelById,
    categoryById,
    MIN_SAMPLE,
    SAMPLE_LABEL,
    bucketSize,
    categoryAxisLabel,
    RATING_STEP,
    RATING_BOUNDS,
    leaderboardCsv,
  }
}

const DashboardContext = React.createContext<ReturnType<
  typeof deriveDashboard
> | null>(null)

function useDashboard() {
  const value = React.useContext(DashboardContext)

  if (!value) {
    throw new Error("useDashboard needs ChessBenchDashboard above it")
  }

  return value
}

function pct(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`
}

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
    ? tokens.toLocaleString("en-US")
    : `~${(Math.round(tokens / 100) * 100).toLocaleString("en-US")}`
}

/** A table cell's stand-in for a value the provider never reported. */
function NotRecorded() {
  return (
    <span title="Not recorded">
      <span aria-hidden="true">—</span>
      <span className="sr-only">Not recorded</span>
    </span>
  )
}

function moveTimeText(seconds: number, n: number) {
  return isPrecise(n) ? `${seconds.toFixed(1)}s` : `~${seconds.toFixed(0)}s`
}

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

function attemptFilename(puzzleId: string, model: ModelId, extension: string) {
  return `chessbench-${puzzleId.replaceAll(":", "-")}-${model}.${extension}`
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

const NO_ARROWS: BoardArrow[] = []

function boardAnimation(reducedMotion: boolean, small: boolean) {
  return reducedMotion
    ? { enabled: false, duration: 0 }
    : { enabled: true, duration: small ? 80 : 160 }
}

const MAIN_CONTENT_ID = "cb-main"

const subscribeMounted = () => () => undefined

/**
 * False on the server and during hydration, true after. next-themes reads the
 * stored theme in its first client render, so anything keyed off it must wait
 * for mount or the toggle icon and label mismatch the server markup.
 */
function useMounted() {
  return React.useSyncExternalStore(
    subscribeMounted,
    () => true,
    () => false
  )
}

export function ChessBenchDashboard({
  data,
  children,
}: {
  data: DashboardData
  children: React.ReactNode
}) {
  const dashboard = React.useMemo(() => deriveDashboard(data), [data])

  return (
    <DashboardContext.Provider value={dashboard}>
      <DashboardShell>{children}</DashboardShell>
    </DashboardContext.Provider>
  )
}

const SECTIONS = [
  { href: "/", label: "Leaderboard", icon: Trophy },
  { href: "/puzzles", label: "Problems", icon: Puzzle },
  { href: "/docs", label: "Docs", icon: BookOpen },
] as const

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useMounted()
  const isDark = mounted && resolvedTheme === "dark"
  const shortcutLabel = useThemeShortcutLabel()

  return (
    <div className="flex min-h-svh flex-col gap-2 bg-background text-foreground">
      {/*
        First thing in the tab order: the sticky header puts a wordmark, three
        section links and the theme toggle ahead of the content on every
        keyboard entry.
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
          <nav
            aria-label="Sections"
            className="ml-4 flex h-10 items-center gap-4 border-l border-border pl-4"
          >
            {SECTIONS.map(({ href, label, icon: Icon }) => {
              const current =
                href === "/" ? pathname === "/" : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  aria-label={label}
                  aria-current={current ? "page" : undefined}
                  className="relative inline-flex h-9 min-w-6 items-center justify-center gap-1.5 rounded-md text-xs font-semibold tracking-[0.12em] whitespace-nowrap text-muted-foreground uppercase transition-colors outline-none after:absolute after:inset-x-0 after:bottom-[-5px] after:h-0.5 after:bg-foreground after:opacity-0 after:transition-opacity hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-[current=page]:text-foreground aria-[current=page]:after:opacity-100 [&_svg]:size-4 [&_svg]:shrink-0"
                >
                  <Icon aria-hidden />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              )
            })}
          </nav>
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
        className="mx-auto w-full max-w-[1360px] px-4 py-6 text-sm outline-none sm:px-6 lg:px-8"
      >
        {children}
      </main>
    </div>
  )
}

export function LeaderboardView() {
  const {
    SCOREBOARD,
    MODELS,
    META,
    modelById,
    MIN_SAMPLE,
    SAMPLE_LABEL,
    leaderboardCsv,
  } = useDashboard()
  const sorted = [...SCOREBOARD].sort((a, b) => b.accuracy - a.accuracy)
  const leader = sorted[0]
  const runnerUp = sorted[1]

  // A protocol change starts with no results until the first run finishes.
  if (!leader) {
    return (
      <section className="grid gap-2.5 border-b pb-4">
        <div className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          {META.benchmarkId}
        </div>
        <h1 className="max-w-sm text-4xl leading-none font-semibold tracking-normal sm:text-5xl">
          Model chess benchmark.
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          No results under the current protocol yet. Entries appear here as
          benchmark runs finish.
        </p>
      </section>
    )
  }

  const leaderModel = modelById(leader.model)
  const modelCount = new Set(MODELS.map((model) => model.model)).size
  const recordedTokens = sorted.flatMap((score) => score.avgTokens ?? [])
  const medianMove = median(sorted.map((score) => score.avgMoveTime))
  const meanLegalRate = average(sorted.map((score) => score.legalRate))
  const illegalMoves = sorted.reduce(
    (total, score) => total + score.illegalMoves,
    0
  )
  const invalidFormats = sorted.reduce(
    (total, score) => total + score.invalidFormats,
    0
  )

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
          <span>
            {modelCount} models, {MODELS.length} entries
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {META.puzzleCount.toLocaleString("en-US")} of{" "}
            {META.datasetSize.toLocaleString("en-US")} lichess puzzles sampled
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-2 text-foreground">
            <ModelDot model={leader.model} />
            {leaderModel.name} leads at{" "}
            {accuracyText(leader.accuracy, leader.n)}
          </span>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Each entry, a model at one reasoning level, is scored on the puzzles
          it has finished: {SAMPLE_LABEL} so far, so entries with different
          counts are not scored on identical sets. At that sample size one
          puzzle is worth {puzzleWeight(MIN_SAMPLE).toFixed(0)} percentage
          points, so accuracy, Elo, cost and token figures are shown as
          estimates rather than exact measurements.
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
          value={
            recordedTokens.length === 0
              ? "—"
              : compactTokens(average(recordedTokens))
          }
          sub="tokens per attempted puzzle"
          note={
            recordedTokens.length === 0
              ? "no entry has recorded tokens"
              : `mean of ${recordedTokens.length} entries, n = ${SAMPLE_LABEL} each`
          }
        />
        <SummaryCard
          icon={Clock}
          label="Median move"
          value={`${medianMove.toFixed(1)}s`}
          sub={`across ${MODELS.length} entries`}
          note="median of per-entry means"
        />
        <SummaryCard
          icon={BarChart3}
          label="Legal moves"
          value={pct(meanLegalRate, 0)}
          sub={
            unplayableCounts(illegalMoves, invalidFormats) ||
            "no illegal or invalid-format answers"
          }
          note={`mean per-entry rate · ${META.evaluations.toLocaleString("en-US")} evaluations`}
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
        Results come from benchmark runs on Vercel Workflows, stored in
        Postgres. ChessBench is not affiliated with any model provider.
      </p>
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

/**
 * Base UI tooltips open on hover and keyboard focus only, so a tap on a touch
 * screen showed nothing. For hints whose text is the point, a press opens the
 * tooltip too, and a second tap closes it; outside press and Escape close it
 * as before. A mouse click keeps it open, since hover already opened it.
 *
 * Browsers follow a tap with emulated mouse events, including a `mouseleave`
 * that Base UI reads as hover ending, so hover closes are ignored after a tap.
 */
function useTapToOpen() {
  const [open, setOpen] = React.useState(false)
  const tapped = React.useRef(false)
  return {
    root: {
      open,
      onOpenChange: (next: boolean, { reason }: { reason: string }) => {
        if (!next && reason === "trigger-hover" && tapped.current) return
        if (!next) tapped.current = false
        setOpen(next)
      },
    },
    trigger: {
      closeOnClick: false,
      onPointerDown: ({ pointerType }: React.PointerEvent) => {
        tapped.current = pointerType === "touch"
      },
      onClick: () => setOpen((wasOpen) => !(wasOpen && tapped.current)),
    },
  }
}

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
  const tap = useTapToOpen()
  return (
    <Tooltip {...tap.root}>
      <TooltipTrigger
        {...tap.trigger}
        render={
          <button
            type="button"
            className="relative cursor-help border-b border-dashed border-muted-foreground/60 font-medium after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
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
  const { modelChartConfig } = useDashboard()
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
  const { seriesMark } = useDashboard()
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
  const { modelById } = useDashboard()
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
  // The wrapper carries sr-only: a table ignores width and overflow, so on the
  // table itself it widened the page to ~1400px on phones.
  return (
    <div className="sr-only">
      <table>
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
                <td key={`${row.key}-${columns[index + 1] ?? index}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OverallAccuracyChart({ sorted }: { sorted: Score[] }) {
  const { modelById, MIN_SAMPLE, SAMPLE_LABEL } = useDashboard()
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
  const {
    SCOREBOARD,
    CATEGORY,
    CATEGORIES,
    modelChartConfig,
    modelById,
    bucketSize,
    categoryAxisLabel,
  } = useDashboard()
  const sorted = [...SCOREBOARD].sort((a, b) => b.accuracy - a.accuracy)
  const shownModels = sorted.map((score) => score.model)
  const data = CATEGORIES.map((category) => {
    const row: Record<string, string | number | null> = {}
    row.category = categoryAxisLabel(category, shownModels)

    for (const score of sorted) {
      const bucket = CATEGORY[score.model][category.id]
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
            const bucket = CATEGORY[model][category.id]

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

function CapabilityRadar({ sorted }: { sorted: Score[] }) {
  const {
    CATEGORY,
    CATEGORIES,
    modelChartConfig,
    seriesMark,
    describeStrokes,
    modelById,
    categoryAxisLabel,
  } = useDashboard()
  const shownModels = sorted.map((score) => score.model)
  // A radar closes its polygon through every axis, so an unmeasured axis would
  // read as 0%. Unmeasured themes are dropped from the chart and named below.
  const measured = CATEGORIES.filter((category) =>
    shownModels.every((model) => CATEGORY[model][category.id].accuracy !== null)
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
      const bucket = CATEGORY[score.model][category.id]
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
            const bucket = CATEGORY[model][category.id]

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

function EloEstimateChart({ sorted }: { sorted: Score[] }) {
  const { modelById, MIN_SAMPLE, SAMPLE_LABEL } = useDashboard()
  const data = [...sorted]
    .sort((a, b) => b.elo - a.elo)
    .map((score) => {
      const model = modelById(score.model)
      const { eloLow: low, eloHigh: high } = score
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
  /** Cost per 1k puzzles or mean tokens, whichever the plot shows. */
  value: number
  n: number
}

function TradeoffScatter() {
  const { SCOREBOARD, modelById, SAMPLE_LABEL } = useDashboard()
  // An entry with no recorded value has no x position, so it is left off.
  const pointsOf = (key: "cost" | "avgTokens"): TradeoffPoint[] =>
    SCOREBOARD.flatMap((score) => {
      const value = score[key]
      return value === null
        ? []
        : [
            {
              id: score.model,
              model: modelById(score.model).name,
              short: modelById(score.model).shortName,
              accuracy: Number((score.accuracy * 100).toFixed(1)),
              value,
              n: score.n,
            },
          ]
    })

  return (
    <SeriesScope className="grid gap-4 lg:grid-cols-2">
      <TradeoffPlot
        metric="cost"
        data={pointsOf("cost")}
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
        data={pointsOf("avgTokens")}
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
  metricMax: number
): "start" | "middle" | "end" {
  if (metricMax === 0) return "middle"

  const share = point.value / metricMax

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
  const { seriesMark, MIN_SAMPLE, SCOREBOARD, modelById } = useDashboard()
  const isCost = metric === "cost"
  const unplotted = SCOREBOARD.filter(
    (score) => !data.some((point) => point.id === score.model)
  ).map((score) => modelById(score.model).name)
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
  const metricMax = Math.max(...data.map((point) => point.value), 0)
  // Accuracy is already a 0-100 percentage here; the metric axis runs from 0 to
  // its own maximum.
  const nearby = (a: TradeoffPoint, b: TradeoffPoint) =>
    // `accuracy` here is already scaled to 0-100, so the threshold is 8
    // percentage points - the same 8% of the axis the metric side uses. It read
    // 0.08 against a 0-100 value, which only ever matched an exact tie.
    Math.abs(a.accuracy - b.accuracy) <= 8 &&
    (metricMax === 0 || Math.abs(a.value - b.value) / metricMax <= 0.08)

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
          value: { label: axisName },
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
            dataKey="value"
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
                  const isMetric = item?.dataKey === "value"

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
                textAnchor={edgeAnchor(point, metricMax)}
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
            metricText(point.value, point.n),
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
        {unplotted.length > 0 && (
          <>
            {" "}
            Not plotted, no {isCost ? "cost" : "token count"} recorded:{" "}
            {unplotted.join(", ")}.
          </>
        )}
      </SampleNote>
    </div>
  )
}

function ResultsTable({ sorted }: { sorted: Score[] }) {
  const { META, modelById } = useDashboard()
  return (
    <Table>
      {/*
        `sr-only` because the card title already labels this table on screen.
        It has to be the first child: the HTML parser only accepts `<caption>`
        before the row groups, and `Table` paints it at the bottom anyway.
      */}
      <TableCaption className="sr-only">
        Per-model benchmark results on {META.benchmarkId}, ranked by accuracy.
        Puzzles, accuracy, legal-move rate with its illegal-move and
        invalid-format counts, average tokens and average time are measured; Elo
        and cost per 1,000 puzzles are derived from them. Pending puzzles ended
        in a provider error and are excluded until retried.
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
          <TableHead className="text-right">
            <DerivedLabel
              label="Legal moves"
              hint="Share of attempts that did not end on an illegal move or invalid format. Illegal: reads as a move, but not a legal one here. Invalid format: no move could be read from the answer."
            />
          </TableHead>
          <TableHead className="text-right">
            <DerivedLabel
              label="Avg tokens"
              hint="Mean total tokens per attempted puzzle that reported a count; — when none did. Rounded to 100 tokens until the sample reaches 100 puzzles."
            />
          </TableHead>
          <TableHead className="text-right">Avg time</TableHead>
          <TableHead className="text-right">
            <DerivedLabel
              label="$ / 1k"
              hint="Extrapolated: mean recorded cost per puzzle multiplied by 1,000; — when no puzzle recorded a cost. Rounded to the dollar until the sample reaches 100 puzzles."
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
                {score.pending > 0 && (
                  <span className="block text-xs">
                    +{score.pending} pending
                  </span>
                )}
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
                {unplayableCounts(score.illegalMoves, score.invalidFormats) && (
                  <span className="block text-xs text-muted-foreground">
                    {unplayableCounts(score.illegalMoves, score.invalidFormats)}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {score.avgTokens === null ? (
                  <NotRecorded />
                ) : (
                  tokensText(score.avgTokens, score.n)
                )}
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {moveTimeText(score.avgMoveTime, score.n)}
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {score.cost === null ? (
                  <NotRecorded />
                ) : (
                  costText(score.cost, score.n)
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

type Search = Pick<URLSearchParams, "get" | "getAll" | "toString">
type Side = "any" | "w" | "b"

// Passed to Select as `items` so the trigger shows the label, not the raw value.
const SORT_LABELS = {
  popularity: "Popularity",
  rating: "Rating high to low",
  "rating-asc": "Rating low to high",
}
const SIDE_LABELS: Record<Side, string> = {
  any: "Either side",
  w: "White",
  b: "Black",
}

const NO_SEARCH = new URLSearchParams()

/**
 * Puzzle filters, sort and the open model trace live in the URL so Back,
 * Forward, reload and shared links all land on the same view. The pages are
 * force-static, so the prerender sees no query string: hydrate with none, to
 * match that HTML, then apply the real one.
 */
function useSearch(): Search {
  const search = useSearchParams()
  return useMounted() ? search : NO_SEARCH
}

export function PuzzlesPage() {
  return <ProblemsView search={useSearch()} />
}

export function PuzzlePage({ id }: { id: string }) {
  return <PuzzleDetail id={id} search={useSearch()} />
}

function puzzleHref(id: string, query: string) {
  return `/puzzles/${encodeURIComponent(id)}${query ? `?${query}` : ""}`
}

function usePuzzleFilters(search: Search) {
  const { PUZZLES, RATING_BOUNDS } = useDashboard()

  // SAFETY: an unknown theme id matches no puzzle and shows as a removable chip.
  const selectedThemes = [...new Set(search.getAll("theme"))] as CategoryId[]
  const sideParam = search.get("side")
  const side: Side = sideParam === "w" || sideParam === "b" ? sideParam : "any"
  // Hand-edited links: clamp to the slider's bounds and drop reversed ranges.
  const rating = /^(\d+)-(\d+)$/.exec(search.get("rating") ?? "")
  const low = Math.max(Number(rating?.[1]), RATING_BOUNDS[0])
  const high = Math.min(Number(rating?.[2]), RATING_BOUNDS[1])
  const ratingRange: [number, number] =
    rating && low <= high ? [low, high] : RATING_BOUNDS
  const sortParam = search.get("sort")
  const sort =
    sortParam === "rating" || sortParam === "rating-asc"
      ? sortParam
      : "popularity"

  const filterParams = new URLSearchParams(search.toString())
  filterParams.delete("model")
  const filterQuery = filterParams.toString()

  const filtered = PUZZLES.filter((puzzle) => {
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

  /**
   * Native history calls, which Next syncs into `useSearchParams`: same-page
   * query changes need no server round trip. Reads the live URL, not the
   * render snapshot, so two quick changes do not overwrite each other.
   */
  const setParams = (changes: Record<string, string | string[] | null>) => {
    const next = new URLSearchParams(window.location.search)
    for (const [key, value] of Object.entries(changes)) {
      next.delete(key)
      for (const item of value === null ? [] : [value].flat()) {
        next.append(key, item)
      }
    }
    const query = next.toString()
    const href = query ? `?${query}` : window.location.pathname
    window.history.pushState(null, "", href)
  }

  return {
    selectedThemes,
    setSelectedThemes: (themes: CategoryId[]) => setParams({ theme: themes }),
    side,
    setSide: (value: Side) =>
      setParams({ side: value === "any" ? null : value }),
    ratingRange,
    setRatingRange: (range: [number, number]) =>
      setParams({
        rating:
          range[0] === RATING_BOUNDS[0] && range[1] === RATING_BOUNDS[1]
            ? null
            : `${range[0]}-${range[1]}`,
      }),
    sort,
    setSort: (value: string) =>
      setParams({ sort: value === "popularity" ? null : value }),
    clearFilters: () => setParams({ theme: null, side: null, rating: null }),
    filtered,
    filterQuery,
    setParams,
  }
}

function PuzzleDetail({ id, search }: { id: string; search: Search }) {
  const { PUZZLES } = useDashboard()
  const { filtered, filterQuery, setParams } = usePuzzleFilters(search)
  // A shared link can carry filters that exclude its own puzzle; step through
  // the whole bank then rather than strand it.
  const list = filtered.some((puzzle) => puzzle.id === id) ? filtered : PUZZLES
  const index = list.findIndex((puzzle) => puzzle.id === id)
  const puzzle = list[index]

  // The route 404s on unknown ids, so this is only reached when the page is
  // newer than the data this tab loaded.
  if (!puzzle) {
    return (
      <p className="text-muted-foreground">
        This puzzle is newer than the loaded results. Reload the page to see it.
      </p>
    )
  }

  const step = (direction: number) =>
    puzzleHref(
      list[(index + direction + list.length) % list.length].id,
      filterQuery
    )

  return (
    <ProblemFocus
      key={puzzle.id}
      puzzle={puzzle}
      index={index}
      total={list.length}
      backHref={`/puzzles${filterQuery ? `?${filterQuery}` : ""}`}
      previousHref={step(-1)}
      nextHref={step(1)}
      openModel={search.get("model")}
      onOpenModel={(model) => setParams({ model })}
    />
  )
}

function ProblemsView({ search }: { search: Search }) {
  const { PUZZLES, META, categoryById, RATING_BOUNDS } = useDashboard()
  const router = useRouter()
  const {
    selectedThemes,
    setSelectedThemes,
    side,
    setSide,
    ratingRange,
    setRatingRange,
    sort,
    setSort,
    clearFilters,
    filtered,
    filterQuery,
  } = usePuzzleFilters(search)

  const randomPuzzle = () => {
    if (filtered.length === 0) {
      return
    }
    const index = Math.floor(Math.random() * filtered.length)
    router.push(puzzleHref(filtered[index].id, filterQuery))
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 border-b pb-7 lg:grid-cols-[1.35fr_0.85fr] lg:items-end">
        <div className="space-y-4">
          <div className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Problem set - {filtered.length.toLocaleString("en-US")} of{" "}
            {PUZZLES.length.toLocaleString("en-US")}
          </div>
          <div className="max-w-3xl space-y-3">
            <h1 className="max-w-[20ch] text-4xl font-semibold tracking-tight">
              Browse the puzzle bank.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              Every board is a lichess-style position tagged by the themes that
              solve it. Click a board to inspect the position, play a legal
              move, and compare model traces. These are the{" "}
              {META.puzzleCount.toLocaleString("en-US")} puzzles models have
              been run on, sampled from the{" "}
              {META.datasetSize.toLocaleString("en-US")}-puzzle benchmark.
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
            items={SORT_LABELS}
            onValueChange={(value) => value && setSort(value)}
          >
            <SelectTrigger size="sm" className="w-44" aria-label="Sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
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
              href={puzzleHref(puzzle.id, filterQuery)}
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
  side: Side
  setSide: (side: Side) => void
  ratingRange: [number, number]
  setRatingRange: (range: [number, number]) => void
  onClear: () => void
}) {
  const { CATEGORIES, PUZZLES, RATING_STEP, RATING_BOUNDS } = useDashboard()
  // The thumb follows a local draft while dragging; the URL (and a history
  // entry) changes once, on release, not on every pointer move.
  const [draftRange, setDraftRange] = React.useState<[number, number] | null>(
    null
  )
  const toRange = (value: number | readonly number[]): [number, number] => {
    const range = Array.isArray(value) ? value : RATING_BOUNDS
    return [range[0] ?? RATING_BOUNDS[0], range[1] ?? RATING_BOUNDS[1]]
  }
  const shownRange = draftRange ?? ratingRange
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
            items={SIDE_LABELS}
            onValueChange={(value) => {
              // SAFETY: the only SelectItems rendered carry these three values.
              setSide(value as Side)
            }}
          >
            <SelectTrigger className="w-full" aria-label="Side to move">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SIDE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-3">
          <div className="flex items-center justify-between text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            <span>Rating</span>
            <span className="font-mono tracking-normal">
              {shownRange[0]}-{shownRange[1]}
            </span>
          </div>
          <Slider
            min={RATING_BOUNDS[0]}
            max={RATING_BOUNDS[1]}
            step={RATING_STEP}
            value={shownRange}
            onValueChange={(value) => setDraftRange(toRange(value))}
            onValueCommitted={(value) => {
              setRatingRange(toRange(value))
              setDraftRange(null)
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

function ProblemCard({ puzzle, href }: { puzzle: PuzzleItem; href: string }) {
  const { categoryById } = useDashboard()
  // The puzzle link is stretched over the whole card, so its name has to carry
  // the position too. Meta first, position last, and the board itself is marked
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
  }, [categoryById, puzzle])

  return (
    <Card className="relative gap-3 rounded-lg transition-transform hover:-translate-y-0.5 has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50">
      <CardContent className="pt-0">
        <ChessBoard
          fen={puzzle.fen}
          orientation={puzzle.side === "w" ? "white" : "black"}
          interactive={false}
          small
          decorative
        />
      </CardContent>
      <CardContent className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          {/*
            Stretched over the card so other links can sit above it later. No
            prefetch: a grid of hundreds of cards would fetch every page.
          */}
          <Link
            href={href}
            prefetch={false}
            aria-label={label}
            className="font-mono text-xs text-muted-foreground outline-none after:absolute after:inset-0 after:rounded-lg"
          >
            {puzzle.id}
          </Link>
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

/** A Previous / Next control, with its keyboard shortcuts in a tooltip. */
function PuzzleStepLink({
  href,
  label,
  shortcut,
  children,
}: {
  href: string
  label: string
  shortcut: { aria: string; label: string }
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={href}
            aria-label={label}
            aria-keyshortcuts={shortcut.aria}
            className={buttonVariants({ size: "icon-sm", variant: "outline" })}
          >
            {children}
          </Link>
        }
      />
      <TooltipContent>
        {label}
        <span className="text-background/70">{shortcut.label}</span>
      </TooltipContent>
    </Tooltip>
  )
}

/** Long enough to see the solver's move land before the reply answers it. */
const OPPONENT_REPLY_DELAY_MS = 600

function ProblemFocus({
  puzzle,
  index,
  total,
  backHref,
  previousHref,
  nextHref,
  openModel,
  onOpenModel,
}: {
  puzzle: PuzzleItem
  index: number
  total: number
  backHref: string
  previousHref: string
  nextHref: string
  openModel: string | null
  onOpenModel: (model: string | null) => void
}) {
  const { modelById, categoryById } = useDashboard()
  const line = puzzle.solution
  const [lineState, setLineState] = React.useState(() =>
    startPuzzleLine(puzzle.fen)
  )
  const { fen: boardFen, lastMove, ply, feedback } = lineState

  const attempts = puzzle.attempts
  const solved = attempts.filter((attempt) => attempt.solved).length
  // Token labels are mono, so the longest is the widest (in ch).
  const tokenCh = Math.max(...attempts.map((a) => tokenLabel(a).length))
  const missed = feedback?.result === "miss"
  const solverMoves = Math.ceil(line.length / 2)
  const locked = isLineLocked(lineState, line)
  const correctionArrows = React.useMemo(() => {
    const expected = line[ply]

    if (feedback?.result !== "miss" || !expected) {
      return []
    }

    const arrow = moveArrow(expected)
    return arrow ? [arrow] : []
  }, [feedback, line, ply])

  React.useEffect(() => {
    const next = playOpponentReply(lineState, line)

    if (!next) {
      return
    }

    const timer = window.setTimeout(
      () => setLineState(next),
      OPPONENT_REPLY_DELAY_MS
    )

    return () => window.clearTimeout(timer)
  }, [lineState, line])

  const router = useRouter()
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const direction = puzzleStepForKey(event)

      if (
        direction === null ||
        isTypingTarget(event.target) ||
        // Widgets that own their arrow keys, and any open dialog or popover
        // (Base UI unmounts closed popups unless they are keepMounted).
        (event.target instanceof Element &&
          event.target.closest(
            'audio, video, [role="slider"], [role="spinbutton"], [role="combobox"], [role="listbox"], [role="menu"], [role="menubar"], [role="tablist"], [role="radiogroup"], [role="toolbar"], [role="grid"], [role="tree"], [role="application"]'
          )) ||
        document.querySelector('[role="dialog"], [role="alertdialog"]')
      ) {
        return
      }

      event.preventDefault()
      router.push(direction < 0 ? previousHref : nextHref)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [router, previousHref, nextHref])

  const handleMove = (move: PlayedMove) =>
    setLineState((state) => playSolverMove(state, line, move))

  const reset = () => setLineState(startPuzzleLine(puzzle.fen))

  const announcement = !feedback
    ? ""
    : feedback.result === "miss"
      ? `Not the puzzle move. You played ${feedback.san}. The puzzle move is ${feedback.expectedSan}.`
      : feedback.result === "correct"
        ? `Correct, ${feedback.san}. The opponent is replying.`
        : feedback.result === "reply"
          ? `Correct, ${feedback.played}. The opponent played ${feedback.san}. Your move.`
          : feedback.result === "invalid"
            ? "This puzzle's next opponent move is invalid. Reset to try again."
            : `Puzzle solved with ${feedback.san}. All ${solverMoves} moves found.`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        {/* Styled links, not Buttons: those render as role="button". */}
        <Link
          href={backHref}
          className={buttonVariants({ size: "sm", variant: "ghost" })}
        >
          <ArrowLeft data-icon="inline-start" />
          All puzzles
        </Link>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {String(index + 1).padStart(2, "0")} /{" "}
            {String(total).padStart(2, "0")}
          </span>
          <PuzzleStepLink
            href={previousHref}
            label="Previous puzzle"
            shortcut={PUZZLE_STEP_SHORTCUTS.previous}
          >
            <ChevronLeft />
          </PuzzleStepLink>
          <PuzzleStepLink
            href={nextHref}
            label="Next puzzle"
            shortcut={PUZZLE_STEP_SHORTCUTS.next}
          >
            <ChevronRight />
          </PuzzleStepLink>
        </div>
      </div>

      <section className="space-y-5 border-b pb-6">
        <div>
          <div className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Puzzle {puzzle.id}
          </div>
          <h1 className="mt-2 max-w-3xl text-2xl font-semibold tracking-tight text-balance">
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
                <Link
                  key={theme}
                  href={`/puzzles?theme=${encodeURIComponent(theme)}`}
                  className="border-b-2 border-[var(--chess-amber)]/60 outline-none hover:border-[var(--chess-amber)] focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {categoryById(theme)?.label ?? theme}
                </Link>
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
                orientation={puzzle.side === "w" ? "white" : "black"}
                lastMove={lastMove}
                arrows={correctionArrows}
                locked={locked}
                onMove={handleMove}
              />
            </CardContent>
          </Card>
          {/*
            Always mounted and never toggled between hidden and visible: the
            visual status line below reserves its space with `invisible`, which
            some screen readers skip when the text changes in the same tick.
          */}
          <output className="sr-only">{announcement}</output>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
              {boardFen}
            </span>
            <div
              aria-hidden="true"
              data-result={
                missed || feedback?.result === "invalid"
                  ? feedback.result
                  : "success"
              }
              className={cn(
                "cb-move-line order-3 sm:order-none sm:w-[15.75rem]",
                !feedback && "invisible"
              )}
            >
              <span>
                {!feedback ? (
                  "Move pending"
                ) : feedback.result === "miss" ? (
                  <>
                    <strong>{feedback.san}</strong> missed - try{" "}
                    <strong>{feedback.expectedSan}</strong>
                  </>
                ) : feedback.result === "correct" ? (
                  <>
                    Correct: <strong>{feedback.san}</strong> - opponent replying
                  </>
                ) : feedback.result === "reply" ? (
                  <>
                    Opponent played <strong>{feedback.san}</strong> - your move
                  </>
                ) : feedback.result === "invalid" ? (
                  <>
                    Correct, but <strong>puzzle error</strong> - reset
                  </>
                ) : (
                  <>
                    <strong>Solved</strong> - all {solverMoves} moves found
                  </>
                )}
              </span>
            </div>
            <Button size="sm" variant="ghost" onClick={reset}>
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
            <Accordion
              className="border-t"
              value={openModel ? [openModel] : []}
              onValueChange={(value) => onOpenModel(value[0] ?? null)}
            >
              {attempts.map((attempt) => {
                const model = modelById(attempt.model)
                return (
                  <AccordionItem key={attempt.model} value={attempt.model}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="cb-attempt-row w-full">
                        <span
                          className={cn(
                            "grid size-6 place-items-center rounded-full",
                            attempt.solved
                              ? "bg-move-correct text-move-correct-foreground"
                              : isUnreadable(attempt)
                                ? "border border-dashed border-muted-foreground text-muted-foreground"
                                : "border border-dashed border-move-incorrect text-move-incorrect"
                          )}
                        >
                          <OutcomeIcon attempt={attempt} className="size-3.5" />
                        </span>
                        <span className="flex min-w-0 items-center gap-x-2">
                          <ModelDot model={attempt.model} />
                          <span
                            className="truncate font-semibold"
                            title={model.name}
                          >
                            {model.name}
                          </span>
                          <span className="cb-provider-pill shrink-0">
                            {model.vendor}
                          </span>
                        </span>
                        <span className="min-w-0">
                          <span className="block text-2xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                            First move
                          </span>
                          <span
                            className={cn(
                              "font-mono text-sm",
                              attempt.firstMove.correct === false &&
                                "text-muted-foreground line-through decoration-destructive/60"
                            )}
                          >
                            {attempt.firstMove.label}
                          </span>
                          {/* The hint stays off the row so long copy cannot grow it; the expanded attempt shows it. */}
                          <span className="block text-xs text-muted-foreground">
                            {attempt.outcome}
                            {attempt.outcomeHint && (
                              <span className="sr-only">
                                . {attempt.outcomeHint}
                              </span>
                            )}
                          </span>
                        </span>
                        {/* Tokens over time on desktop, one line on mobile (globals.css); each value stays whole.
                            The min-width (mono, so ch is exact) sizes every row's token track to the widest label, keeping columns aligned across rows. */}
                        <span
                          style={{ minWidth: `${tokenCh}ch` }}
                          className="flex flex-col items-end justify-self-end font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums"
                        >
                          <span>{tokenLabel(attempt)}</span>{" "}
                          <span>{(attempt.thinkingMs / 1000).toFixed(1)}s</span>
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {attempt.outcomeHint && (
                        <p className="mb-3 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {attempt.outcome}:
                          </span>{" "}
                          {attempt.outcomeHint}
                        </p>
                      )}
                      <AttemptTrace
                        puzzle={puzzle}
                        attempt={attempt}
                        vendor={model.vendor}
                      />
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

function tokenLabel(attempt: SolutionAttempt) {
  if (attempt.thinkingTokens === null) return "Tokens not recorded"
  // Reasoning tokens when the provider reports them, else total tokens; say which.
  return `${attempt.thinkingTokens.toLocaleString("en-US")} ${attempt.record.reasoningTokens === null ? "total" : "thinking"} tok`
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
  const { modelById } = useDashboard()
  const model = modelById(attempt.model)
  const state = attempt.outcome
  const tap = useTapToOpen()

  return (
    <Tooltip {...tap.root}>
      <TooltipTrigger
        {...tap.trigger}
        aria-label={`${model.name}: ${state}${attempt.outcomeHint ? `. ${attempt.outcomeHint}` : ""}`}
        className={cn(
          "relative grid size-6 place-items-center rounded-full outline-none after:absolute after:-inset-1.25 after:content-[''] focus-visible:ring-3 focus-visible:ring-ring/50",
          attempt.solved
            ? "border border-move-correct/50"
            : isUnreadable(attempt)
              ? "border border-dashed border-muted-foreground"
              : "border border-dashed border-move-incorrect/70"
        )}
      >
        <ModelDot
          model={attempt.model}
          className={cn(!attempt.solved && "opacity-50 grayscale")}
        />
        <span
          aria-hidden="true"
          className={cn(
            "absolute -right-1 -bottom-1 grid size-3 place-items-center rounded-full",
            attempt.solved
              ? "bg-move-correct text-move-correct-foreground"
              : isUnreadable(attempt)
                ? "bg-muted-foreground text-background"
                : "bg-move-incorrect text-move-incorrect-foreground"
          )}
        >
          <OutcomeIcon attempt={attempt} className="size-2" strokeWidth={4} />
        </span>
      </TooltipTrigger>
      <TooltipContent className="flex-col items-start gap-0.5">
        <span>
          {model.name}: {state}
        </span>
        {attempt.outcomeHint && (
          <span className="opacity-80">{attempt.outcomeHint}</span>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * The page carries attempt summaries only; the full record, with every turn's
 * reasoning, is fetched when its transcript opens. Finished attempts never
 * change, so the CDN serves each one after the first request.
 */
function AttemptTrace({
  puzzle,
  attempt,
  vendor,
}: {
  puzzle: PuzzleItem
  attempt: SolutionAttempt
  vendor: string
}) {
  const [loaded, setLoaded] = React.useState<{
    id: string
    record: LichessPuzzleAttemptRow | null
  } | null>(null)

  React.useEffect(() => {
    let live = true

    fetch(`/api/attempts/${attempt.attemptId}`)
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)
      .then((record: LichessPuzzleAttemptRow | null) => {
        if (live) {
          setLoaded({ id: attempt.attemptId, record })
        }
      })

    return () => {
      live = false
    }
  }, [attempt.attemptId])

  if (loaded?.id !== attempt.attemptId) {
    return <p className="text-xs text-muted-foreground">Loading trace…</p>
  }

  if (!loaded.record) {
    return (
      <p className="text-xs text-muted-foreground">
        The trace could not be loaded.
      </p>
    )
  }

  const { turns } = loaded.record
  return (
    <>
      <ol className="space-y-5">
        {turns.map((turn) => (
          <li key={turn.turnIndex} className="space-y-2">
            {turns.length > 1 && (
              <h4 className="text-2xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Turn {turn.turnIndex + 1}
              </h4>
            )}
            {turn.errorMessage ? (
              <TraceField label="Error">
                <p className="text-xs wrap-anywhere text-destructive">
                  {turn.errorMessage}
                </p>
              </TraceField>
            ) : (
              <TraceField label="Answer">
                <p className="font-mono text-sm wrap-anywhere whitespace-pre-wrap">
                  {turn.rawAnswer || "No answer returned."}
                </p>
              </TraceField>
            )}
            <TurnReasoning reasoning={turnReasoning(turn)} vendor={vendor} />
          </li>
        ))}
      </ol>
      <TranscriptActions
        puzzle={puzzle}
        attempt={attempt}
        record={loaded.record}
      />
    </>
  )
}

function TraceField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  )
}

/** Only readable reasoning is shown; signatures and encrypted blobs stay in the JSON download. */
function TurnReasoning({
  reasoning,
  vendor,
}: {
  reasoning: ReturnType<typeof turnReasoning>
  vendor: string
}) {
  if (reasoning === null) {
    return null
  }

  return (
    <TraceField label="Reasoning">
      {reasoning === "hidden" ? (
        <p className="text-xs text-muted-foreground">
          {vendor} didn&apos;t return readable reasoning for this turn.
        </p>
      ) : (
        <div className="max-h-72 max-w-[75ch] overflow-auto rounded-md border bg-muted/50 px-3 py-2 text-xs leading-5 wrap-anywhere whitespace-pre-wrap">
          {reasoning.text.trim()}
        </div>
      )}
    </TraceField>
  )
}

/**
 * Take the full evidence away: a JSON download of the recorded attempt and a
 * clipboard copy of the plain-text transcript.
 */
function TranscriptActions({
  puzzle,
  attempt,
  record,
}: {
  puzzle: PuzzleItem
  attempt: SolutionAttempt
  record: LichessPuzzleAttemptRow
}) {
  const [copied, setCopied] = React.useState(false)
  const transcript = attemptTranscript(record)

  React.useEffect(() => {
    if (!copied) {
      return
    }

    const timer = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])

  return (
    <div className="mt-3 flex items-center justify-end gap-2">
      <Button
        size="sm"
        variant="ghost"
        onClick={() =>
          downloadFile(
            attemptFilename(puzzle.id, attempt.model, "json"),
            attemptJson(record),
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
            await navigator.clipboard.writeText(transcript)
            setCopied(true)
          } catch {
            downloadFile(
              attemptFilename(puzzle.id, attempt.model, "txt"),
              transcript,
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

const TURN_STEPS = [
  {
    title: "Position",
    body: "The model gets the position as a FEN.",
  },
  {
    title: "One move",
    body: "It answers with exactly one legal move in UCI or SAN, and nothing else.",
  },
  {
    title: "Reply",
    body: "If it is correct, the expected opponent reply is sent as a UCI move and the next move is asked for in the same conversation.",
  },
]

const METRICS: {
  name: string
  code?: string
  kind: string
  body: React.ReactNode
}[] = [
  {
    name: "Accuracy",
    code: "solved_rate",
    kind: "Measured",
    body: "Share of puzzles where every player move of the solution line was correct. The headline number.",
  },
  {
    name: "Legal moves",
    kind: "Measured",
    body: "Share of attempts that did not end on an illegal move (reads as a move, but not a legal one here) or an invalid format (no move could be read). Wrong moves and timeouts still count as legal.",
  },
  {
    name: "Avg tokens",
    kind: "Measured",
    body: "Mean total tokens per puzzle, as the provider reports them; a puzzle with no reported count is left out of the mean, and an entry with none shows —. ChessBench sets no output cap, so provider defaults apply.",
  },
  {
    name: "Avg time",
    kind: "Measured",
    body: "Mean total model response time per puzzle in seconds, summed over all of its moves, not per move.",
  },
  {
    name: "Elo",
    kind: "Estimated",
    body: (
      <>
        Mean rating of the puzzles faced, plus{" "}
        <span className="font-mono text-xs">400 · log10(p / (1 - p))</span> for
        accuracy <span className="font-mono text-xs">p</span> (clamped to
        1-99%).
      </>
    ),
  },
  {
    name: "$ / 1k",
    kind: "Extrapolated",
    body: "Mean recorded cost per puzzle, multiplied by 1,000; a puzzle with no recorded cost is left out of the mean, and an entry with none shows —.",
  },
]

// ponytail: copies of ATTEMPTS_IN_PARALLEL and playTurn.maxRetries in
// benchmark-workflow.ts; importing that workflow module here would pull it into
// the dashboard build, so update this text when those change.
const RUN_FACTS = [
  {
    title: "Durable",
    body: "Runs execute on Vercel Workflows, one step per turn, in batches of five attempts.",
  },
  {
    title: "Paid once",
    body: "Each model and puzzle is claimed in Postgres before the paid call, so overlapping runs never play the same puzzle at once.",
  },
  {
    title: "Retried",
    body: "A failed call is retried up to four times, unless the provider marks the error as not retryable, such as an invalid request. A turn that still fails is left pending for the next run.",
  },
  {
    title: "Reasoning",
    body: "The provider default, or one provider-neutral level from none to max that each provider maps to its own effort or token budget.",
  },
]

export function DocsView() {
  const { META, MIN_SAMPLE, SAMPLE_LABEL } = useDashboard()
  const timeLimit = `${META.moveTimeLimitSeconds} s`
  const filters = META.qualityFilters
  const puzzleFilters = [
    `Popularity ≥ ${filters.minPopularity}`,
    `≥ ${filters.minPlays} plays`,
    `Rating deviation ≤ ${filters.maxRatingDeviation}`,
    "No mate-in-one",
    "Every move replayed in chess.js",
  ]

  const limits = [
    `With so few puzzles per entry, one puzzle moves accuracy by up to ${Number(puzzleWeight(MIN_SAMPLE).toFixed(1))} percentage points. Theme buckets are thinner, and an empty one is shown as absent, not scored.`,
    "Only the Lichess solution counts. Mate-in-one is excluded because a second, equally valid mate would score as a miss.",
    `Taking longer than ${timeLimit} on a move counts as a failure, not as an infrastructure error.`,
    "Each entry gets one attempt per puzzle.",
    "Elo and cost are derived from that small sample and rounded to the precision it supports.",
  ]

  return (
    <div className="space-y-10 text-pretty">
      <section className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">
          How ChessBench works
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Each entry, a model at one reasoning level, has answered{" "}
          {SAMPLE_LABEL} of the {META.datasetSize.toLocaleString("en-US")}{" "}
          {META.benchmarkId} puzzles so far, all with the same prompt, time
          limit and scorer.
        </p>
      </section>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-4">
        <MetaCell label="Puzzle set">
          <span className="font-mono">
            {META.datasetSize.toLocaleString("en-US")}
          </span>{" "}
          from Lichess
        </MetaCell>
        <MetaCell label="Per entry">
          <span className="font-mono">{SAMPLE_LABEL}</span> answered
        </MetaCell>
        <MetaCell label="Move time limit">
          <span className="font-mono">{timeLimit}</span>
        </MetaCell>
        <MetaCell label="Updated">
          <span className="font-mono">{META.lastUpdated}</span>
        </MetaCell>
      </div>

      <DocsSection title="How a puzzle is played">
        <ol className="grid gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-3">
          {TURN_STEPS.map((step, index) => (
            <li key={step.title} className="bg-background p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="grid size-5 place-items-center rounded-full font-mono text-2xs text-muted-foreground ring-1 ring-border">
                  {index + 1}
                </span>
                {step.title}
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <RotateCcw className="size-3" aria-hidden />
          Steps 2 and 3 repeat until the line ends.
        </p>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="flex items-center gap-1.5 font-medium">
              <Check className="size-4" aria-hidden />
              Solved
            </dt>
            <dd className="mt-1 text-muted-foreground">
              Every player move of the solution played correctly.
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 font-medium">
              <X className="size-4" aria-hidden />
              Not solved
            </dt>
            <dd className="mt-1 text-muted-foreground">
              Stops at the first wrong move, illegal move, invalid format or
              move over {timeLimit}.
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 font-medium">
              <Clock className="size-4" aria-hidden />
              Pending
            </dt>
            <dd className="mt-1 text-muted-foreground">
              A provider error. Not a result: kept out of scores and retried on
              the next run.
            </dd>
          </div>
        </dl>
      </DocsSection>

      <DocsSection title="The puzzle set">
        <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:auto-cols-fr sm:grid-flow-col">
          {META.ratingBands.map((band) => (
            <div
              key={band.label}
              className="flex items-baseline justify-between bg-background px-4 py-2 sm:block sm:px-2 sm:py-3 sm:text-center"
            >
              <div className="font-mono text-sm">{band.label}</div>
              <div className="text-xs text-muted-foreground sm:mt-1">
                {band.selected} puzzles
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
          Sampled from the{" "}
          <a
            href="https://database.lichess.org/#puzzles"
            className="text-foreground underline underline-offset-4"
          >
            Lichess puzzle database
          </a>{" "}
          (CC0) with a fixed seed, so a rebuild from the same source file
          returns the same {META.datasetSize.toLocaleString("en-US")}. A puzzle
          has to pass every filter:
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {puzzleFilters.map((filter) => (
            <li key={filter}>
              <Badge variant="outline">{filter}</Badge>
            </li>
          ))}
        </ul>
      </DocsSection>

      <DocsSection title="Metrics">
        <dl className="divide-y rounded-lg border">
          {METRICS.map((metric) => (
            <div
              key={metric.name}
              className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[10rem_7rem_1fr] sm:items-baseline sm:gap-4"
            >
              <dt className="font-medium">
                {metric.name}
                {metric.code ? (
                  <>
                    {" "}
                    <span className="font-mono text-xs font-normal text-muted-foreground">
                      {metric.code}
                    </span>
                  </>
                ) : null}
              </dt>
              <dd className="text-2xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                {metric.kind}
              </dd>
              <dd className="leading-6 text-muted-foreground">{metric.body}</dd>
            </div>
          ))}
        </dl>
      </DocsSection>

      <DocsSection title="How runs work">
        <dl className="divide-y rounded-lg border">
          {RUN_FACTS.map((fact) => (
            <div
              key={fact.title}
              className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[10rem_1fr] sm:items-baseline sm:gap-4"
            >
              <dt className="font-medium">{fact.title}</dt>
              <dd className="leading-6 text-muted-foreground">{fact.body}</dd>
            </div>
          ))}
        </dl>
      </DocsSection>

      <DocsSection title="Limits">
        <ul className="max-w-2xl list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground marker:text-muted-foreground">
          {limits.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          To rebuild the puzzle set or rerun a model, see the{" "}
          <a
            href="https://github.com/movsiienko/chessbench#readme"
            className="text-foreground underline underline-offset-4"
          >
            README
          </a>
          .
        </p>
      </DocsSection>
    </div>
  )
}

function DocsSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-4 border-t pt-6 lg:grid-cols-[14rem_1fr] lg:gap-8">
      <h2 className="text-lg font-medium">{title}</h2>
      <div className="max-w-4xl min-w-0">{children}</div>
    </section>
  )
}

function ChessBoard({
  fen,
  orientation,
  interactive = true,
  locked = false,
  onMove,
  lastMove,
  arrows = NO_ARROWS,
  small = false,
  decorative = false,
}: {
  fen: string
  orientation: cg.Color
  interactive?: boolean
  /** Interactive, but no piece can be moved right now (e.g. the opponent is replying). */
  locked?: boolean
  onMove?: (move: PlayedMove) => void
  lastMove?: { from: string; to: string } | null
  arrows?: BoardArrow[]
  small?: boolean
  /** The position is already described by an ancestor's accessible name. */
  decorative?: boolean
}) {
  const boardRef = React.useRef<HTMLDivElement>(null)
  const apiRef = React.useRef<ChessgroundApi | null>(null)
  const skipNextSetRef = React.useRef(false)
  const reducedMotion = usePreferReducedMotion()
  const latestRef = React.useRef({
    fen,
    orientation,
    lastMove,
    arrows,
    locked,
    onMove,
    reducedMotion,
  })

  // Declared before the board effects so it runs first in every commit: the
  // Chessground instance outlives each render, and its move handler has to read
  // the position the user is currently looking at, not the one it was built on.
  React.useEffect(() => {
    latestRef.current = {
      fen,
      orientation,
      lastMove,
      arrows,
      locked,
      onMove,
      reducedMotion,
    }
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
      orientation: initial.orientation,
      turnColor: color,
      check: isCheck(initial.fen) ? color : false,
      // SAFETY: Chessground only reports algebraic squares a1-h8 as move keys.
      lastMove: initial.lastMove
        ? [initial.lastMove.from as cg.Key, initial.lastMove.to as cg.Key]
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
        color: interactive && !initial.locked ? color : undefined,
        dests:
          interactive && !initial.locked ? legalDests(initial.fen) : undefined,
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
      orientation,
      turnColor: color,
      check: isCheck(fen) ? color : false,
      // SAFETY: Chessground only reports algebraic squares a1-h8 as move keys.
      lastMove: lastMove
        ? [lastMove.from as cg.Key, lastMove.to as cg.Key]
        : undefined,
      animation: boardAnimation(reducedMotion, small),
      movable: {
        color: interactive && !locked ? color : undefined,
        dests: interactive && !locked ? legalDests(fen) : undefined,
      },
      drawable: {
        // Chessground owns this key name.
        ["autoShapes"]: arrows,
      },
    })
  }, [
    arrows,
    fen,
    interactive,
    lastMove,
    locked,
    orientation,
    reducedMotion,
    small,
  ])

  const summary = React.useMemo(() => boardSummary(fen), [fen])

  return (
    <div
      ref={boardRef}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : summary}
      className={cn(
        "chessground-board aspect-square w-full overflow-hidden rounded-lg ring-1 ring-border",
        small && "rounded-md"
      )}
    />
  )
}

function ModelChip({ id }: { id: ModelId }) {
  const { modelById } = useDashboard()
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
  const { modelById } = useDashboard()
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

function LabSvg({ lab }: { lab: LabId }) {
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
