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

import { AnthropicBlack } from "@/components/ui/svgs/anthropicBlack"
import { AnthropicWhite } from "@/components/ui/svgs/anthropicWhite"
import { Deepseek } from "@/components/ui/svgs/deepseek"
import { Gemini } from "@/components/ui/svgs/gemini"
import { Meta as MetaLogo } from "@/components/ui/svgs/meta"
import { Openai } from "@/components/ui/svgs/openai"
import { OpenaiDark } from "@/components/ui/svgs/openaiDark"
import { XaiDark } from "@/components/ui/svgs/xaiDark"
import { XaiLight } from "@/components/ui/svgs/xaiLight"
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
import { cn } from "@/lib/utils"

type View = "leaderboard" | "problems" | "docs"
type ModelId = "gpt5" | "claude45" | "gem25" | "ds35" | "grok4" | "llama4"
type CategoryId =
  | "mate"
  | "fork"
  | "pin"
  | "skewer"
  | "discoAtk"
  | "sacrifice"
  | "endgame"
  | "opening"
  | "middlegame"
  | "defense"
  | "zugzwang"
  | "promotion"

type PuzzleItem = {
  id: string
  fen: string
  themes: CategoryId[]
  side: "w" | "b"
  rating: number
  popularity: number
  solution: string[]
  caption: string
}

type SolutionAttempt = {
  model: ModelId
  correct: boolean
  playedMove: string
  movePretty: string
  thinkingMs: number
  thinkingTokens: number
  transcript: string
}

const MODELS = [
  {
    id: "gpt5",
    name: "GPT-5",
    vendor: "OpenAI",
    color: "#10a37f",
    releaseQ: "Q2 2025",
  },
  {
    id: "claude45",
    name: "Claude Sonnet 4.5",
    vendor: "Anthropic",
    color: "#d97757",
    releaseQ: "Q3 2025",
  },
  {
    id: "gem25",
    name: "Gemini 2.5 Pro",
    vendor: "Google",
    color: "#4285f4",
    releaseQ: "Q1 2025",
  },
  {
    id: "ds35",
    name: "DeepSeek V3.5",
    vendor: "DeepSeek",
    color: "#2563eb",
    releaseQ: "Q4 2024",
  },
  {
    id: "grok4",
    name: "Grok 4",
    vendor: "xAI",
    color: "#111827",
    releaseQ: "Q2 2025",
  },
  {
    id: "llama4",
    name: "Llama 4 Maverick",
    vendor: "Meta",
    color: "#8b5cf6",
    releaseQ: "Q1 2025",
  },
] as const

const CATEGORIES = [
  { id: "mate", label: "Mate" },
  { id: "fork", label: "Fork" },
  { id: "pin", label: "Pin" },
  { id: "skewer", label: "Skewer" },
  { id: "discoAtk", label: "Discovered attack" },
  { id: "sacrifice", label: "Sacrifice" },
  { id: "endgame", label: "Endgame" },
  { id: "opening", label: "Opening" },
  { id: "middlegame", label: "Middlegame" },
  { id: "defense", label: "Defense" },
  { id: "zugzwang", label: "Zugzwang" },
  { id: "promotion", label: "Promotion" },
] as const

const SCOREBOARD = [
  {
    model: "gpt5",
    accuracy: 0.781,
    elo: 2418,
    cost: 6.4,
    avgTokens: 4830,
    avgMoveTime: 8.1,
    legalRate: 0.998,
  },
  {
    model: "claude45",
    accuracy: 0.762,
    elo: 2391,
    cost: 4.9,
    avgTokens: 5210,
    avgMoveTime: 7.4,
    legalRate: 0.996,
  },
  {
    model: "gem25",
    accuracy: 0.708,
    elo: 2284,
    cost: 3.2,
    avgTokens: 3940,
    avgMoveTime: 5.8,
    legalRate: 0.991,
  },
  {
    model: "ds35",
    accuracy: 0.651,
    elo: 2178,
    cost: 0.42,
    avgTokens: 6120,
    avgMoveTime: 9.3,
    legalRate: 0.974,
  },
  {
    model: "grok4",
    accuracy: 0.628,
    elo: 2147,
    cost: 5.1,
    avgTokens: 4410,
    avgMoveTime: 6.9,
    legalRate: 0.982,
  },
  {
    model: "llama4",
    accuracy: 0.581,
    elo: 2051,
    cost: 0.18,
    avgTokens: 2880,
    avgMoveTime: 3.2,
    legalRate: 0.951,
  },
] satisfies Array<{
  model: ModelId
  accuracy: number
  elo: number
  cost: number
  avgTokens: number
  avgMoveTime: number
  legalRate: number
}>

const CATEGORY: Record<ModelId, Record<CategoryId, number>> = {
  gpt5: {
    mate: 0.88,
    fork: 0.83,
    pin: 0.81,
    skewer: 0.79,
    discoAtk: 0.76,
    sacrifice: 0.69,
    endgame: 0.74,
    opening: 0.86,
    middlegame: 0.72,
    defense: 0.71,
    zugzwang: 0.61,
    promotion: 0.84,
  },
  claude45: {
    mate: 0.86,
    fork: 0.81,
    pin: 0.79,
    skewer: 0.77,
    discoAtk: 0.74,
    sacrifice: 0.71,
    endgame: 0.73,
    opening: 0.84,
    middlegame: 0.74,
    defense: 0.69,
    zugzwang: 0.58,
    promotion: 0.81,
  },
  gem25: {
    mate: 0.81,
    fork: 0.76,
    pin: 0.72,
    skewer: 0.7,
    discoAtk: 0.68,
    sacrifice: 0.62,
    endgame: 0.66,
    opening: 0.8,
    middlegame: 0.66,
    defense: 0.61,
    zugzwang: 0.49,
    promotion: 0.76,
  },
  ds35: {
    mate: 0.74,
    fork: 0.69,
    pin: 0.66,
    skewer: 0.63,
    discoAtk: 0.59,
    sacrifice: 0.58,
    endgame: 0.61,
    opening: 0.72,
    middlegame: 0.61,
    defense: 0.55,
    zugzwang: 0.44,
    promotion: 0.7,
  },
  grok4: {
    mate: 0.71,
    fork: 0.67,
    pin: 0.64,
    skewer: 0.62,
    discoAtk: 0.58,
    sacrifice: 0.54,
    endgame: 0.57,
    opening: 0.71,
    middlegame: 0.58,
    defense: 0.52,
    zugzwang: 0.41,
    promotion: 0.66,
  },
  llama4: {
    mate: 0.66,
    fork: 0.59,
    pin: 0.58,
    skewer: 0.55,
    discoAtk: 0.49,
    sacrifice: 0.46,
    endgame: 0.51,
    opening: 0.66,
    middlegame: 0.52,
    defense: 0.46,
    zugzwang: 0.32,
    promotion: 0.62,
  },
}

const ELO_HISTORY: Record<ModelId, number[]> = {
  gpt5: [2210, 2255, 2298, 2330, 2360, 2384, 2402, 2418],
  claude45: [2240, 2261, 2294, 2316, 2344, 2370, 2384, 2391],
  gem25: [2160, 2189, 2210, 2228, 2244, 2261, 2276, 2284],
  ds35: [2030, 2069, 2096, 2118, 2134, 2155, 2168, 2178],
  grok4: [2050, 2076, 2093, 2108, 2118, 2131, 2140, 2147],
  llama4: [1930, 1958, 1981, 2001, 2019, 2034, 2044, 2051],
}

const PUZZLES: PuzzleItem[] = [
  {
    id: "lp_0001",
    fen: "r1bqkb1r/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1",
    themes: ["opening", "middlegame"],
    side: "w",
    rating: 1340,
    popularity: 92,
    solution: ["b5c6", "d7c6", "d2d3"],
    caption: "Ruy Lopez: find the principled continuation after the exchange.",
  },
  {
    id: "lp_0002",
    fen: "r3k2r/pp3ppp/2p1bn2/q3N3/3P4/2N1B3/PPP2PPP/R2QK2R w KQkq - 0 1",
    themes: ["fork", "middlegame"],
    side: "w",
    rating: 1820,
    popularity: 78,
    solution: ["e5c6", "a5d2", "c6e7"],
    caption: "A double-purpose knight jump wins material and threatens mate.",
  },
  {
    id: "lp_0003",
    fen: "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",
    themes: ["endgame", "mate"],
    side: "w",
    rating: 1450,
    popularity: 86,
    solution: ["d1d8"],
    caption: "King and rook versus king: exact mating net technique required.",
  },
  {
    id: "lp_0004",
    fen: "r1b1k2r/ppppnppp/2n2q2/2b5/3NP3/2P1B3/PP3PPP/RN1QKB1R w KQkq - 0 1",
    themes: ["pin", "sacrifice"],
    side: "w",
    rating: 2110,
    popularity: 71,
    solution: ["d4f5", "f6e5", "f5g7"],
    caption:
      "Classic Italian setup: exploit the f7 weakness via a knight tour.",
  },
  {
    id: "lp_0005",
    fen: "5rk1/pp3ppp/2p5/8/2BQ4/P7/1P3PPP/4q1K1 b - - 0 1",
    themes: ["skewer", "defense"],
    side: "b",
    rating: 1690,
    popularity: 64,
    solution: ["e1g3", "g1h1", "g3c3"],
    caption: "Black to move: find the only defense that holds material.",
  },
  {
    id: "lp_0006",
    fen: "r4rk1/1pp2ppp/p1nbbn2/3p4/3P4/2NBPN2/PP3PPP/R1BQ1RK1 w - - 0 1",
    themes: ["discoAtk", "middlegame"],
    side: "w",
    rating: 1880,
    popularity: 58,
    solution: ["d3h7", "g8h7", "f3g5"],
    caption: "Greek gift: calculate the king hunt three moves deep.",
  },
  {
    id: "lp_0007",
    fen: "8/3k4/8/8/3P4/3K4/8/8 w - - 0 1",
    themes: ["endgame", "zugzwang"],
    side: "w",
    rating: 1560,
    popularity: 88,
    solution: ["d3e4"],
    caption: "King and pawn versus king: opposition decides the result.",
  },
  {
    id: "lp_0008",
    fen: "8/2P5/3k4/8/8/8/8/3K4 w - - 0 1",
    themes: ["promotion", "endgame"],
    side: "w",
    rating: 1290,
    popularity: 81,
    solution: ["c7c8q"],
    caption: "Pawn one step from queening: confirm the standard promotion.",
  },
  {
    id: "lp_0009",
    fen: "r1bq1rk1/pp3ppp/2n1pn2/2bp4/3P4/2NBPN2/PP3PPP/R1BQ1RK1 w - - 0 1",
    themes: ["middlegame", "pin"],
    side: "w",
    rating: 1750,
    popularity: 67,
    solution: ["d3h7", "f6h7", "d1d3"],
    caption: "Bishop lift: set up a kingside assault.",
  },
  {
    id: "lp_0010",
    fen: "2r3k1/5ppp/p3p3/1p1qP3/3P4/P1Q5/1P3PPP/3R2K1 b - - 0 1",
    themes: ["mate", "sacrifice"],
    side: "b",
    rating: 2240,
    popularity: 49,
    solution: ["d5d4", "c3d4", "c8c1"],
    caption: "Black to move: back-rank pressure with deflection.",
  },
  {
    id: "lp_0011",
    fen: "rnb1kbnr/pppp1ppp/8/4p3/5Pq1/4P3/PPPP2PP/RNBQKBNR w KQkq - 0 1",
    themes: ["opening", "defense"],
    side: "w",
    rating: 1180,
    popularity: 90,
    solution: ["g2g3"],
    caption: "Avoid an early disaster after f2-f4. One move keeps you alive.",
  },
  {
    id: "lp_0012",
    fen: "4r1k1/p1q2pp1/1p2pn1p/3p4/3P4/P3PN2/1PQ2PPP/4R1K1 b - - 0 1",
    themes: ["middlegame", "fork"],
    side: "b",
    rating: 1980,
    popularity: 53,
    solution: ["f6e4", "c2e4", "e8e4"],
    caption: "Knight to e4: decide whether the exchange favours Black.",
  },
]

const META = {
  puzzleCount: 12482,
  evaluations: 74892,
  lastUpdated: "2026-05-14",
  version: "0.7.2",
}

const files = ["a", "b", "c", "d", "e", "f", "g", "h"] as const

const subscribeMounted = () => () => undefined

const modelChartConfig = MODELS.reduce<ChartConfig>((config, model) => {
  config[model.id] = { label: model.name, color: model.color }
  return config
}, {})

function modelById(id: ModelId) {
  return MODELS.find((model) => model.id === id) ?? MODELS[0]
}

function scoreById(id: ModelId) {
  return SCOREBOARD.find((score) => score.model === id) ?? SCOREBOARD[0]
}

function categoryById(id: CategoryId) {
  return CATEGORIES.find((category) => category.id === id)
}

function pct(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`
}

function mutateMove(uci: string, seed: number) {
  const target = uci.slice(2, 4)
  const fileIndex = files.indexOf(target[0] as (typeof files)[number])
  const rank = Number.parseInt(target[1] ?? "1", 10)
  const nextFile =
    files[Math.max(0, Math.min(7, fileIndex + (seed % 2 === 0 ? 1 : -1)))]
  const nextRank = Math.max(1, Math.min(8, rank + (seed % 2 === 0 ? 0 : 1)))
  return `${uci.slice(0, 2)}${nextFile}${nextRank}`
}

function prettyMove(uci: string) {
  if (!uci) {
    return ""
  }

  return `${uci.slice(0, 2)} -> ${uci.slice(2, 4)}${uci.length > 4 ? `=${uci[4]?.toUpperCase()}` : ""}`
}

function makeTranscript(
  model: (typeof MODELS)[number],
  puzzle: PuzzleItem,
  correct: boolean,
  played: string
) {
  const evalText = correct
    ? `${(1.4 + (puzzle.rating % 120) / 100).toFixed(2)} rising`
    : `${(0.2 + (puzzle.rating % 60) / 100).toFixed(2)} unsure`

  return [
    `# ${model.name} reasoning - puzzle ${puzzle.id}`,
    `Position: ${puzzle.fen}`,
    `Side to move: ${puzzle.side === "w" ? "White" : "Black"}`,
    "",
    "<think>",
    `The themes suggest ${puzzle.themes.map((theme) => categoryById(theme)?.label ?? theme).join(", ")}.`,
    "I am checking forcing moves first: checks, captures, threats, then quiet defensive resources.",
    `Candidate A: ${prettyMove(played)} - opens lines or creates a tactical fork.`,
    "Candidate B: a developing move - likely too slow for this position.",
    correct
      ? `After ${prettyMove(played)}, the reply is forced and the continuation remains winning.`
      : `After ${prettyMove(played)}, the line looks plausible, but a defensive resource may refute it.`,
    `Eval: ${evalText}`,
    "</think>",
    "",
    `MOVE: ${played}`,
  ].join("\n")
}

function solutionsFor(puzzle: PuzzleItem): SolutionAttempt[] {
  return MODELS.map((model, index) => {
    const score = scoreById(model.id)
    const correct =
      score.accuracy * (1900 / Math.max(1100, puzzle.rating)) >
      0.55 + index * 0.005
    const playedMove = correct
      ? puzzle.solution[0]
      : mutateMove(puzzle.solution[0], index)

    return {
      model: model.id,
      correct,
      playedMove,
      movePretty: prettyMove(playedMove),
      thinkingMs: 2400 + index * 700 + ((puzzle.rating + index * 47) % 1500),
      thinkingTokens: 380 + index * 120 + ((puzzle.rating + index * 31) % 220),
      transcript: makeTranscript(model, puzzle, correct, playedMove),
    }
  })
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
          <TabsList className="ml-2">
            <TabsTrigger value="leaderboard">
              <Trophy data-icon="inline-start" />
              Leaderboard
            </TabsTrigger>
            <TabsTrigger value="problems">
              <Puzzle data-icon="inline-start" />
              Problems
            </TabsTrigger>
            <TabsTrigger value="docs">
              <BookOpen data-icon="inline-start" />
              Docs
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
  const spread = Math.round(
    (leader.accuracy - sorted[sorted.length - 1].accuracy) * 100
  )

  return (
    <div className="space-y-8">
      <section className="grid gap-8 border-b pb-8 lg:grid-cols-[1.35fr_0.8fr] lg:items-end">
        <div className="space-y-5">
          <div className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            ChessBench - Round {ELO_HISTORY.gpt5.length} - {META.lastUpdated}
          </div>
          <div className="max-w-3xl space-y-4">
            <h1 className="max-w-[12ch] text-5xl leading-none font-semibold tracking-tight sm:text-6xl">
              How well can LLMs play chess?
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              An open benchmark grading {MODELS.length} frontier models on{" "}
              {META.puzzleCount.toLocaleString()} lichess-derived puzzles across
              tactics, endgames, openings, and middlegame strategy. Numbers
              shown here are mocked for demonstration.
            </p>
          </div>
          <div className="grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-5">
            <HeroStat label="Models" value={MODELS.length.toString()} />
            <HeroStat
              label="Puzzles"
              value={`${(META.puzzleCount / 1000).toFixed(1)}k`}
            />
            <HeroStat label="Themes" value={CATEGORIES.length.toString()} />
            <HeroStat
              label="Evaluations"
              value={`${Math.round(META.evaluations / 1000)}k`}
            />
            <HeroStat label="Spread" value={`${spread}pp`} />
          </div>
        </div>
        <Card className="border-amber-500/20 bg-[var(--chess-amber-soft)]/35">
          <CardHeader>
            <CardDescription>Current leader</CardDescription>
            <CardTitle className="flex items-center gap-3 text-2xl">
              <ModelDot model={leader.model} className="size-5" />
              {leaderModel.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <Metric label="Accuracy" value={pct(leader.accuracy)} />
            <Metric label="Elo" value={leader.elo.toString()} mono />
            <Metric
              label="Delta vs #2"
              value={`+${((leader.accuracy - sorted[1].accuracy) * 100).toFixed(1)}pp`}
              mono
            />
          </CardContent>
        </Card>
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
          value="4.6k"
          sub="tokens per solved puzzle"
        />
        <SummaryCard
          icon={Clock}
          label="Median move"
          value="6.8s"
          sub="across six model families"
        />
        <SummaryCard
          icon={BarChart3}
          label="Legal moves"
          value={pct(0.982)}
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
        Note: the design handoff uses plausible mocked results for the UI.
        ChessBench is not affiliated with any model provider.
      </p>
    </div>
  )
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background p-4">
      <div className="text-[0.68rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
        {value}
      </div>
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
              formatter={(value) => `${Number(value).toFixed(1)}%`}
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
  const rounds = ELO_HISTORY.gpt5.map((_, index) => {
    const row: Record<string, string | number> = { round: `R${index + 1}` }
    for (const model of MODELS) {
      row[model.id] = ELO_HISTORY[model.id][index]
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
          domain={[1900, 2450]}
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
              domain={[50, 85]}
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
              domain={[50, 85]}
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
    const index =
      (filtered.length * 7 + selectedThemes.length * 3 + ratingRange[0]) %
      filtered.length
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
    fen: string
    promotion?: string
  }) => {
    const played = `${move.from}${move.to}${move.promotion ?? ""}`
    const expected = puzzle.solution[0]
    setBoardFen(move.fen)
    setLastMove({ from: move.from, to: move.to })
    setFeedback({
      ok: expected.startsWith(played) || played.startsWith(expected),
      played,
      expected,
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
            <Badge
              variant={feedback?.ok ? "outline" : "destructive"}
              aria-live="polite"
              title={
                feedback
                  ? `played ${feedback.played} - expected ${feedback.expected}`
                  : undefined
              }
              className={cn(
                "order-3 min-h-8 w-full justify-start rounded-md px-3 font-mono text-xs sm:order-none sm:w-[15.75rem]",
                feedback?.ok &&
                  "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300",
                !feedback && "invisible"
              )}
            >
              {feedback?.ok ? (
                <Check data-icon="inline-start" />
              ) : (
                <X data-icon="inline-start" />
              )}
              {feedback
                ? feedback.ok
                  ? `Correct ${feedback.played}`
                  : `Expected ${feedback.expected}`
                : "Move pending"}
            </Badge>
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
          <CardContent>
            <Accordion className="border-t">
              {attempts.map((attempt) => {
                const model = modelById(attempt.model)
                return (
                  <AccordionItem key={attempt.model} value={attempt.model}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="grid w-full grid-cols-[24px_minmax(0,1.35fr)_minmax(80px,0.8fr)_minmax(96px,0.8fr)] items-center gap-3 pr-3">
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
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <ModelDot model={attempt.model} />
                            <span className="truncate font-semibold">
                              {model.name}
                            </span>
                          </span>
                          <span className="ml-6 block truncate font-mono text-xs text-muted-foreground">
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
              strict instruction to output only the best move in UCI. Answers
              are parsed with chess.js and illegal moves are counted separately
              from legal-but-wrong moves.
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
            <Metric label="Rating range" value="600-2800" mono />
            <Metric label="Time / move" value="<= 60s" mono />
            <Metric label="Runs / model" value="3" mono />
            <Metric label="Token cap" value="8,192" mono />
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
  autoShapes = [],
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

              onMove?.({
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
  }, [autoShapes, fen, interactive, lastMove, onMove, small])

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
  const iconClassName = "max-h-full max-w-full"

  const icon = (() => {
    switch (model) {
      case "gpt5":
        return (
          <>
            <Openai className={cn(iconClassName, "dark:hidden")} />
            <OpenaiDark className={cn(iconClassName, "hidden dark:block")} />
          </>
        )
      case "claude45":
        return (
          <>
            <AnthropicBlack className={cn(iconClassName, "dark:hidden")} />
            <AnthropicWhite
              className={cn(iconClassName, "hidden dark:block")}
            />
          </>
        )
      case "gem25":
        return <Gemini className={iconClassName} />
      case "ds35":
        return <Deepseek className={iconClassName} />
      case "grok4":
        return (
          <>
            <XaiLight className={cn(iconClassName, "dark:hidden")} />
            <XaiDark className={cn(iconClassName, "hidden dark:block")} />
          </>
        )
      case "llama4":
        return <MetaLogo className={iconClassName} />
    }
  })()

  return (
    <span
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center",
        className
      )}
      aria-hidden="true"
    >
      {icon}
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
