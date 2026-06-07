"use client"

import * as React from "react"
import { Chess, type Square } from "chess.js"
import { Chessground } from "@lichess-org/chessground"
import type { Api as ChessgroundApi } from "@lichess-org/chessground/api"
import type { Config as ChessgroundConfig } from "@lichess-org/chessground/config"
import type { DrawShape } from "@lichess-org/chessground/draw"
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
  Download,
  ExternalLink,
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
  LabelList,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts"

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
import {
  Table,
  TableBody,
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
  CATEGORIES as REAL_CATEGORIES,
  ELO_HISTORY as REAL_ELO_HISTORY,
  META as REAL_META,
  MODELS as REAL_MODELS,
  PUZZLES as REAL_PUZZLES,
  SCOREBOARD as REAL_SCOREBOARD,
  type DashboardCategoryId,
  type DashboardModelId,
  type DashboardPuzzleItem,
  type DashboardSolutionAttempt,
} from "@/lib/benchmarks/dashboard-data"
import { cn } from "@/lib/utils"

type View = "leaderboard" | "problems" | "docs"
type ModelId = DashboardModelId
type CategoryId = DashboardCategoryId
type PuzzleItem = DashboardPuzzleItem
type SolutionAttempt = DashboardSolutionAttempt

const MODELS = REAL_MODELS

type LabSvgRoute = string | { light: string; dark: string }
type LabSvgSource = "svgl" | "models.dev"

const MODELS_DEV_LAB_IDS = [
  "alibaba",
  "anthropic",
  "cohere",
  "deepseek",
  "google",
  "meta",
  "minimax",
  "mistral",
  "moonshotai",
  "nvidia",
  "openai",
  "perplexity",
  "stepfun",
  "tencent",
  "xai",
  "xiaomi",
  "zhipuai",
] as const

type ModelsDevLabId = (typeof MODELS_DEV_LAB_IDS)[number]

function modelsDevLabSvg(lab: string) {
  return `https://models.dev/logos/labs/${lab}.svg`
}

const LAB_SVGS = {
  alibaba: {
    label: "Alibaba",
    route: modelsDevLabSvg("alibaba"),
    source: "models.dev",
  },
  openai: {
    label: "OpenAI",
    route: {
      light: "https://svgl.app/library/openai.svg",
      dark: "https://svgl.app/library/openai_dark.svg",
    },
    source: "svgl",
  },
  anthropic: {
    label: "Anthropic",
    route: {
      light: "https://svgl.app/library/anthropic_black.svg",
      dark: "https://svgl.app/library/anthropic_white.svg",
    },
    source: "svgl",
  },
  cohere: {
    label: "Cohere",
    route: "https://svgl.app/library/cohere.svg",
    source: "svgl",
  },
  google: {
    label: "Google",
    route: "https://svgl.app/library/google.svg",
    source: "svgl",
  },
  deepseek: {
    label: "DeepSeek",
    route: "https://svgl.app/library/deepseek.svg",
    source: "svgl",
  },
  meta: {
    label: "Meta",
    route: "https://svgl.app/library/meta.svg",
    source: "svgl",
  },
  minimax: {
    label: "MiniMax",
    route: modelsDevLabSvg("minimax"),
    source: "models.dev",
  },
  mistral: {
    label: "Mistral",
    route: "https://svgl.app/library/mistral-ai_logo.svg",
    source: "svgl",
  },
  moonshotai: {
    label: "Moonshot AI",
    route: modelsDevLabSvg("moonshotai"),
    source: "models.dev",
  },
  nvidia: {
    label: "Nvidia",
    route: {
      light: "https://svgl.app/library/nvidia-icon-light.svg",
      dark: "https://svgl.app/library/nvidia-icon-dark.svg",
    },
    source: "svgl",
  },
  perplexity: {
    label: "Perplexity",
    route: "https://svgl.app/library/perplexity.svg",
    source: "svgl",
  },
  stepfun: {
    label: "StepFun",
    route: modelsDevLabSvg("stepfun"),
    source: "models.dev",
  },
  tencent: {
    label: "Tencent",
    route: modelsDevLabSvg("tencent"),
    source: "models.dev",
  },
  xai: {
    label: "xAI",
    route: {
      light: "https://svgl.app/library/xai_light.svg",
      dark: "https://svgl.app/library/xai_dark.svg",
    },
    source: "svgl",
  },
  xiaomi: {
    label: "Xiaomi",
    route: modelsDevLabSvg("xiaomi"),
    source: "models.dev",
  },
  zhipuai: {
    label: "Zhipu AI",
    route: modelsDevLabSvg("zhipuai"),
    source: "models.dev",
  },
} as const satisfies Record<
  ModelsDevLabId,
  { label: string; route: LabSvgRoute; source: LabSvgSource }
>

type LabLogoKey = keyof typeof LAB_SVGS

const MODEL_LAB_LOGO = {
  gpt5: "openai",
  claude45: "anthropic",
  gem25: "google",
  ds35: "deepseek",
  grok4: "xai",
  qwen3: "alibaba",
} as const satisfies Record<ModelId, LabLogoKey>

const CATEGORIES = REAL_CATEGORIES

const SCOREBOARD = REAL_SCOREBOARD

const CATEGORY = REAL_CATEGORY

const ELO_HISTORY = REAL_ELO_HISTORY

const PUZZLES = REAL_PUZZLES

const META = REAL_META

const subscribeMounted = () => () => undefined

const modelChartConfig = MODELS.reduce<ChartConfig>((config, model) => {
  config[model.id] = { label: model.name, color: model.color }
  return config
}, {})

function modelById(id: ModelId) {
  return MODELS.find((model) => model.id === id) ?? MODELS[0]
}

function categoryById(id: CategoryId) {
  return CATEGORIES.find((category) => category.id === id)
}

function pct(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`
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
  return square as Square
}

function safeKey(square: string) {
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

function moveArrow(uci: string): DrawShape | null {
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

const EMPTY_DRAW_SHAPES: DrawShape[] = []

function useMounted() {
  return React.useSyncExternalStore(
    subscribeMounted,
    () => true,
    () => false
  )
}

export function ChessBenchDashboard() {
  const [view, setView] = React.useState<View>("leaderboard")
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useMounted()
  const isDark = mounted && resolvedTheme === "dark"

  return (
    <Tabs
      value={view}
      onValueChange={(value) => setView(value as View)}
      className="min-h-svh bg-background text-foreground"
    >
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
          <Button
            className="ml-auto"
            size="icon"
            variant="ghost"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            {isDark ? <Sun /> : <Moon />}
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-6 lg:px-8">
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
  const leaderModel = modelById(leader.model)
  const avgTokens = average(sorted.map((score) => score.avgTokens))
  const medianMove = median(sorted.map((score) => score.avgMoveTime))
  const meanLegalRate = average(sorted.map((score) => score.legalRate))

  return (
    <div className="space-y-8">
      <section className="grid gap-2.5 border-b pb-4">
        <div className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Round {ELO_HISTORY.gpt5.length} · {META.lastUpdated}
        </div>
        <h1 className="max-w-sm text-4xl leading-none font-semibold tracking-normal sm:text-5xl">
          Model chess benchmark.
        </h1>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 text-sm text-muted-foreground">
          <span>{MODELS.length} models</span>
          <span aria-hidden="true">·</span>
          <span>{META.puzzleCount.toLocaleString()} lichess puzzles</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-2 text-foreground">
            <ModelDot model={leader.model} />
            {leaderModel.name} leads at {pct(leader.accuracy)}
          </span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          icon={Target}
          label="Best accuracy"
          value={pct(leader.accuracy)}
          sub={`${leaderModel.name} leads by ${((leader.accuracy - sorted[1].accuracy) * 100).toFixed(1)}pp`}
        />
        <SummaryCard
          icon={Brain}
          label="Avg thinking"
          value={compactTokens(avgTokens)}
          sub="tokens per attempted puzzle"
        />
        <SummaryCard
          icon={Clock}
          label="Median move"
          value={`${medianMove.toFixed(1)}s`}
          sub={`across ${MODELS.length} model families`}
        />
        <SummaryCard
          icon={BarChart3}
          label="Legal moves"
          value={pct(meanLegalRate)}
          sub="mean parse and legality rate"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardDescription>Headline metric - 01</CardDescription>
            <CardTitle>Overall accuracy</CardTitle>
          </CardHeader>
          <CardContent>
            <OverallAccuracyChart sorted={sorted} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Capability breakdown - 02</CardDescription>
            <CardTitle>Top-three capability radar</CardTitle>
          </CardHeader>
          <CardContent>
            <CapabilityRadar sorted={sorted.slice(0, 3)} />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardDescription>Per-category accuracy</CardDescription>
          <CardTitle>Theme buckets from the lichess puzzle set</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryBars />
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Time series - 03</CardDescription>
            <CardTitle>Elo progression</CardTitle>
          </CardHeader>
          <CardContent>
            <EloLineChart />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Trade-offs - 04</CardDescription>
            <CardTitle>Cost and reasoning vs. accuracy</CardTitle>
          </CardHeader>
          <CardContent>
            <TradeoffScatter />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div>
            <CardDescription>Full results - 05</CardDescription>
            <CardTitle>Per-model breakdown</CardTitle>
          </div>
          <CardAction>
            <Button size="sm" variant="outline">
              <Download data-icon="inline-start" />
              CSV
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ResultsTable sorted={sorted} />
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
      <div className="text-[0.68rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
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
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Icon className="size-4" />
          {label}
        </CardDescription>
        <CardTitle className="font-mono text-2xl tabular-nums">
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{sub}</CardContent>
    </Card>
  )
}

function OverallAccuracyChart({ sorted }: { sorted: typeof SCOREBOARD }) {
  const data = sorted.map((score) => {
    const model = modelById(score.model)
    return {
      model: model.name,
      accuracy: Number((score.accuracy * 100).toFixed(1)),
      fill: model.color,
    }
  })

  return (
    <ChartContainer
      config={{ accuracy: { label: "Accuracy" } }}
      className="aspect-auto h-[300px] w-full"
    >
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 10, right: 36, top: 8, bottom: 8 }}
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
              formatter={(value) => `${Number(value).toFixed(1)}%`}
            />
          }
        />
        <Bar dataKey="accuracy" radius={4}>
          {data.map((entry) => (
            <Cell key={entry.model} fill={entry.fill} />
          ))}
          <LabelList
            dataKey="accuracy"
            position="right"
            formatter={(value) => `${Number(value).toFixed(1)}%`}
            className="fill-foreground font-mono text-xs"
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

function CategoryBars() {
  const sorted = [...SCOREBOARD].sort((a, b) => b.accuracy - a.accuracy)
  const data = CATEGORIES.map((category) => {
    const row: Record<string, string | number> = { category: category.label }
    for (const score of sorted) {
      row[score.model] = Number(
        (CATEGORY[score.model][category.id] * 100).toFixed(1)
      )
    }
    return row
  })

  return (
    <div className="space-y-4">
      <ChartContainer
        config={modelChartConfig}
        className="aspect-auto h-[360px] w-full"
      >
        <BarChart
          data={data}
          margin={{ left: 0, right: 16, top: 12, bottom: 48 }}
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
          <YAxis width={36} tickFormatter={(value) => `${value}%`} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => {
                  const model = modelById(name as ModelId)

                  return (
                    <div className="flex w-full min-w-36 items-center justify-between gap-3 leading-none">
                      <span className="text-muted-foreground">
                        {model.name}
                      </span>
                      <span className="font-mono font-medium text-foreground tabular-nums">
                        {Number(value).toFixed(1)}%
                      </span>
                    </div>
                  )
                }}
              />
            }
          />
          {sorted.map((score) => {
            const model = modelById(score.model)
            return (
              <Bar
                key={score.model}
                dataKey={score.model}
                fill={model.color}
                radius={2}
              />
            )
          })}
        </BarChart>
      </ChartContainer>
      <div className="flex flex-wrap justify-center gap-3">
        {sorted.map((score) => (
          <ModelChip key={score.model} id={score.model} />
        ))}
      </div>
    </div>
  )
}

function CapabilityRadar({ sorted }: { sorted: typeof SCOREBOARD }) {
  const axes = CATEGORIES.slice(0, 8)
  const data = axes.map((category) => {
    const row: Record<string, string | number> = { category: category.label }
    for (const score of sorted) {
      row[score.model] = Number(
        (CATEGORY[score.model][category.id] * 100).toFixed(1)
      )
    }
    return row
  })

  return (
    <div className="space-y-4">
      <ChartContainer
        config={modelChartConfig}
        className="aspect-auto h-[300px] w-full"
      >
        <RadarChart data={data} outerRadius={98}>
          <PolarGrid />
          <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tickCount={4}
            tickFormatter={(value) => `${value}%`}
          />
          {sorted.map((score) => {
            const model = modelById(score.model)
            return (
              <Radar
                key={score.model}
                dataKey={score.model}
                stroke={model.color}
                fill={model.color}
                fillOpacity={0.16}
              />
            )
          })}
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => `${Number(value).toFixed(1)}%`}
              />
            }
          />
        </RadarChart>
      </ChartContainer>
      <div className="flex flex-wrap justify-center gap-3">
        {sorted.map((score) => (
          <ModelChip key={score.model} id={score.model} />
        ))}
      </div>
    </div>
  )
}

function EloLineChart() {
  const maxRounds = Math.max(
    ...MODELS.map((model) => ELO_HISTORY[model.id]?.length ?? 0)
  )
  const eloValues = MODELS.flatMap((model) => ELO_HISTORY[model.id] ?? [])
  const minElo = Math.floor((Math.min(...eloValues) - 100) / 100) * 100
  const maxElo = Math.ceil((Math.max(...eloValues) + 100) / 100) * 100
  const rounds = Array.from({ length: maxRounds }, (_, index) => {
    const row: Record<string, string | number> = { round: `R${index + 1}` }
    for (const model of MODELS) {
      row[model.id] = ELO_HISTORY[model.id]?.[index] ?? 0
    }
    return row
  })

  return (
    <ChartContainer
      config={modelChartConfig}
      className="aspect-auto h-[300px] w-full"
    >
      <LineChart
        data={rounds}
        margin={{ left: 8, right: 18, top: 12, bottom: 8 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="round" tickLine={false} axisLine={false} />
        <YAxis
          width={44}
          domain={[minElo, maxElo]}
          tickLine={false}
          axisLine={false}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        {MODELS.map((model) => (
          <Line
            key={model.id}
            type="monotone"
            dataKey={model.id}
            stroke={model.color}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  )
}

function TradeoffScatter() {
  const data = SCOREBOARD.map((score) => {
    const model = modelById(score.model)
    return {
      model: model.name,
      accuracy: Number((score.accuracy * 100).toFixed(1)),
      cost: score.cost,
      tokens: score.avgTokens,
      fill: model.color,
    }
  })

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <div className="mb-2 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Cost / 1k puzzles
        </div>
        <ChartContainer
          config={{ cost: { label: "Cost" }, accuracy: { label: "Accuracy" } }}
          className="aspect-auto h-[260px] w-full"
        >
          <ScatterChart
            data={data}
            margin={{ left: 4, right: 18, top: 12, bottom: 12 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="cost"
              name="Cost"
              type="number"
              tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
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
                  formatter={(value, name) =>
                    name === "cost"
                      ? `$${Number(value).toFixed(2)}`
                      : `${Number(value).toFixed(1)}%`
                  }
                />
              }
            />
            <Scatter dataKey="accuracy" name="accuracy">
              {data.map((entry) => (
                <Cell key={entry.model} fill={entry.fill} />
              ))}
            </Scatter>
          </ScatterChart>
        </ChartContainer>
      </div>
      <div>
        <div className="mb-2 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Thinking tokens / puzzle
        </div>
        <ChartContainer
          config={{
            tokens: { label: "Tokens" },
            accuracy: { label: "Accuracy" },
          }}
          className="aspect-auto h-[260px] w-full"
        >
          <ScatterChart
            data={data}
            margin={{ left: 4, right: 18, top: 12, bottom: 12 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="tokens"
              name="Tokens"
              type="number"
              tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
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
                  formatter={(value, name) =>
                    name === "tokens"
                      ? Number(value).toLocaleString()
                      : `${Number(value).toFixed(1)}%`
                  }
                />
              }
            />
            <Scatter dataKey="accuracy" name="accuracy">
              {data.map((entry) => (
                <Cell key={entry.model} fill={entry.fill} />
              ))}
            </Scatter>
          </ScatterChart>
        </ChartContainer>
      </div>
    </div>
  )
}

function ResultsTable({ sorted }: { sorted: typeof SCOREBOARD }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">#</TableHead>
          <TableHead>Model</TableHead>
          <TableHead className="text-right">Accuracy</TableHead>
          <TableHead className="text-right">Elo</TableHead>
          <TableHead className="text-right">Legal move</TableHead>
          <TableHead className="text-right">Avg tokens</TableHead>
          <TableHead className="text-right">Avg time</TableHead>
          <TableHead className="text-right">$ / 1k</TableHead>
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
              <TableCell className="text-right font-medium">
                {pct(score.accuracy)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {score.elo}
              </TableCell>
              <TableCell className="text-right font-mono">
                {pct(score.legalRate)}
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {score.avgTokens.toLocaleString()}
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {score.avgMoveTime.toFixed(1)}s
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                ${score.cost.toFixed(2)}
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
  const [ratingRange, setRatingRange] = React.useState<[number, number]>([
    600, 2800,
  ])
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
    setRatingRange([600, 2800])
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
              move, and compare model traces.
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
          {(ratingRange[0] !== 600 || ratingRange[1] !== 2800) && (
            <Button
              size="xs"
              variant="secondary"
              onClick={() => setRatingRange([600, 2800])}
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
            <CardTitle>No puzzles match.</CardTitle>
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
    (ratingRange[0] !== 600 || ratingRange[1] !== 2800 ? 1 : 0)

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
            {PUZZLES.length} positions across {CATEGORIES.length} theme buckets.
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
            onValueChange={(value) => setSide(value as "any" | "w" | "b")}
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
            min={600}
            max={2800}
            step={50}
            value={ratingRange}
            onValueChange={(value) => {
              const range = Array.isArray(value) ? value : [600, 2800]
              setRatingRange([range[0] ?? 600, range[1] ?? 2800])
            }}
          />
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
  return (
    <Card
      role="button"
      tabIndex={0}
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
        <ChessBoard fen={puzzle.fen} interactive={false} small />
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

  const attempts = React.useMemo(() => solutionsFor(puzzle), [puzzle])
  const solved = attempts.filter((attempt) => attempt.correct).length
  const correctionShapes = React.useMemo(() => {
    if (!feedback || feedback.ok) {
      return []
    }

    const arrow = moveArrow(feedback.expected)
    return arrow ? [arrow] : []
  }, [feedback])

  const handleMove = (move: {
    from: string
    to: string
    san: string
    fen: string
    promotion?: string
  }) => {
    const played = `${move.from}${move.to}${move.promotion ?? ""}`
    const expected = puzzle.solution[0]
    if (!expected) {
      return
    }

    setBoardFen(move.fen)
    setLastMove({ from: move.from, to: move.to })
    setFeedback({
      ok: puzzle.solution.includes(played),
      played,
      expected,
      san: move.san,
    })
  }

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
                key={boardFen}
                fen={boardFen}
                lastMove={lastMove}
                autoShapes={correctionShapes}
                onMove={handleMove}
              />
            </CardContent>
          </Card>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
              {boardFen}
            </span>
            <div
              aria-live="polite"
              title={
                feedback
                  ? `played ${readableMove(feedback.played)}; expected ${readableMove(feedback.expected)}`
                  : undefined
              }
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
                      Move accepted:{" "}
                      <strong>
                        {feedback.san || readableMove(feedback.played)}
                      </strong>
                    </>
                  ) : (
                    <>
                      Try <strong>{readableMove(feedback.expected)}</strong>
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
              <CardTitle>
                {solved} of {attempts.length} solved this puzzle
              </CardTitle>
            </div>
            <CardAction>
              <div className="flex gap-2">
                {attempts.map((attempt) => (
                  <Tooltip key={attempt.model}>
                    <TooltipTrigger>
                      <span
                        className={cn(
                          "inline-flex",
                          !attempt.correct && "opacity-25 grayscale"
                        )}
                      >
                        <ModelDot model={attempt.model} />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {modelById(attempt.model).name}:{" "}
                      {attempt.correct ? "solved" : "missed"}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
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
                              ? "bg-green-600 text-white"
                              : "border border-dashed text-muted-foreground"
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
                          <span className="block text-[0.65rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
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
                      <div className="mt-3 flex justify-end gap-2">
                        <Button size="sm" variant="ghost">
                          <Download data-icon="inline-start" />
                          Raw JSON
                        </Button>
                        <Button size="sm" variant="ghost">
                          <ExternalLink data-icon="inline-start" />
                          Open trace
                        </Button>
                      </div>
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

function MetaCell({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-background p-4">
      <div className="text-[0.68rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
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
          A concise methodology stub for the benchmark protocol, scoring
          formula, legal-move validation, and thinking-token accounting.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardDescription>Protocol</CardDescription>
            <CardTitle>Evaluation protocol</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 leading-7 text-muted-foreground">
            <p>
              Each model receives a position in FEN, the side to move, and a
              strict instruction to output exactly one legal move token in UCI
              or SAN, with no extra text. Answers are normalized to UCI for
              scoring, and invalid formats are counted separately from
              valid-but-wrong moves.
            </p>
            <Separator />
            <div>
              <h3 className="font-medium text-foreground">Scoring</h3>
              <p className="mt-2">
                Accuracy is the share of puzzles where the extracted UCI
                sequence matches either the full forcing line or the player-only
                line. Elo is estimated from puzzle rating deltas across repeated
                benchmark rounds.
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
            <CardTitle>Benchmark shape</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-5">
            <Metric
              label="Puzzle pool"
              value={META.puzzleCount.toLocaleString()}
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
  autoShapes = EMPTY_DRAW_SHAPES,
  small = false,
}: {
  fen: string
  interactive?: boolean
  onMove?: (move: {
    from: string
    to: string
    san: string
    fen: string
    promotion?: string
  }) => void
  lastMove?: { from: string; to: string } | null
  autoShapes?: DrawShape[]
  small?: boolean
}) {
  const boardRef = React.useRef<HTMLDivElement>(null)
  const apiRef = React.useRef<ChessgroundApi | null>(null)
  const onMoveRef = React.useRef(onMove)

  React.useEffect(() => {
    onMoveRef.current = onMove
  }, [onMove])

  React.useEffect(() => {
    const element = boardRef.current

    if (!element) {
      return
    }

    const color = turnColor(fen)
    const config: ChessgroundConfig = {
      fen: boardOnlyFen(fen),
      orientation: "white",
      turnColor: color,
      check: isCheck(fen) ? color : false,
      lastMove: lastMove
        ? [safeKey(lastMove.from), safeKey(lastMove.to)]
        : undefined,
      coordinates: !small,
      coordinatesOnSquares: false,
      ranksPosition: "right",
      viewOnly: !interactive,
      disableContextMenu: true,
      trustAllEvents: true,
      animation: {
        enabled: true,
        duration: small ? 80 : 160,
      },
      highlight: {
        lastMove: true,
        check: true,
      },
      movable: {
        free: false,
        color: interactive ? color : undefined,
        dests: interactive ? legalDests(fen) : undefined,
        showDests: interactive,
        rookCastle: true,
        events: {
          after: (orig, dest) => {
            try {
              const chess = new Chess(fen)
              const piece = chess.get(safeSquare(orig))
              const promotion =
                piece?.type === "p" && (dest[1] === "8" || dest[1] === "1")
                  ? "q"
                  : undefined
              const move = chess.move({
                from: safeSquare(orig),
                to: safeSquare(dest),
                promotion,
              })

              if (!move) {
                return
              }

              onMoveRef.current?.({
                from: orig,
                to: dest,
                san: move.san,
                fen: chess.fen(),
                promotion: move.promotion,
              })
            } catch {
              apiRef.current?.set({ fen: boardOnlyFen(fen) })
            }
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
        autoShapes,
      },
    }

    apiRef.current = Chessground(element, config)

    return () => {
      apiRef.current?.destroy()
      apiRef.current = null
      element.innerHTML = ""
    }
  }, [autoShapes, fen, interactive, lastMove, small])

  return (
    <div
      ref={boardRef}
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
  const lab = MODEL_LAB_LOGO[model]

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

function LabSvg({ lab }: { lab: LabLogoKey }) {
  const svg = LAB_SVGS[lab]

  if (typeof svg.route === "string") {
    return (
      <LabSvgImage
        src={svg.route}
        className={svg.source === "models.dev" ? "dark:invert" : undefined}
      />
    )
  }

  return (
    <>
      <LabSvgImage src={svg.route.light} className="dark:hidden" />
      <LabSvgImage src={svg.route.dark} className="hidden dark:block" />
    </>
  )
}

function LabSvgImage({
  src,
  className,
}: {
  src: string
  className?: string
}) {
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      className={cn("block h-full w-full object-contain", className)}
    />
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
