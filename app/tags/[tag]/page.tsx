import { ArrowLeft, Check, X } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { categories } from "@/lib/benchmarks/dashboard-build"
import {
  loadBenchmarkItems,
  loadDashboardData,
} from "@/lib/benchmarks/dashboard-load"

// Prerendered per tag at build; regenerated only through /api/revalidate.
export const dynamic = "force-static"
export const dynamicParams = false

export function generateStaticParams() {
  return categories.map(({ id }) => ({ tag: id }))
}

type Props = { params: Promise<{ tag: string }> }

export async function generateMetadata({ params }: Props) {
  const { tag } = await params
  const category = categories.find(({ id }) => id === tag)
  return { title: `${category?.label ?? "Tag"} puzzles - ChessBench` }
}

export default async function TagPage({ params }: Props) {
  const { tag } = await params
  const category = categories.find(({ id }) => id === tag)
  if (!category) {
    notFound()
  }

  const [data, items] = await Promise.all([
    loadDashboardData(),
    loadBenchmarkItems(),
  ])
  // Full theme match, the same rule the per-model rates use; a puzzle's
  // own tag list is capped at three, so it can omit a tag it still has.
  const tagged = new Set(items.filter(category.matches).map(({ id }) => id))
  const puzzles = data.puzzles
    .filter(({ id }) => tagged.has(id))
    .sort((a, b) => a.rating - b.rating)
  const models = data.models
    .map((model) => ({ ...model, ...data.category[model.id][category.id] }))
    .filter(({ n }) => n > 0)
    .sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0))

  return (
    <main className="mx-auto max-w-[1360px] space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeft className="size-4" />
        ChessBench
      </Link>

      <header className="space-y-2 border-b pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {category.label} puzzles
        </h1>
        <p className="text-sm text-muted-foreground">
          {puzzles.length} of {data.meta.puzzleCount} benchmark puzzles carry
          this tag.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-medium">Solved rate by model</h2>
        {models.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No model has attempted a puzzle with this tag yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Solved rate</TableHead>
                <TableHead className="text-right">Puzzles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {models.map((model) => (
                <TableRow key={model.id}>
                  <TableCell className="font-medium">{model.name}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {Math.round((model.accuracy ?? 0) * 100)}%
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground tabular-nums">
                    {model.n}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Puzzles</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Puzzle</TableHead>
              <TableHead className="text-right">Rating</TableHead>
              <TableHead>To move</TableHead>
              {models.map((model) => (
                <TableHead
                  key={model.id}
                  className="text-center"
                  title={model.name}
                >
                  {model.shortName}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {puzzles.map((puzzle) => (
              <TableRow key={puzzle.id}>
                <TableCell className="font-mono text-xs">{puzzle.id}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {puzzle.rating}
                </TableCell>
                <TableCell>{puzzle.side === "w" ? "White" : "Black"}</TableCell>
                {models.map((model) => {
                  const attempt = puzzle.attempts.find(
                    (candidate) => candidate.model === model.id
                  )
                  return (
                    <TableCell key={model.id} className="text-center">
                      {!attempt ? (
                        <span className="text-muted-foreground">
                          <span aria-hidden>-</span>
                          <span className="sr-only">Not attempted</span>
                        </span>
                      ) : attempt.solved ? (
                        <>
                          <Check className="mx-auto size-4" aria-hidden />
                          <span className="sr-only">Solved</span>
                        </>
                      ) : (
                        <>
                          <X
                            className="mx-auto size-4 text-muted-foreground"
                            aria-hidden
                          />
                          <span className="sr-only">{attempt.outcome}</span>
                        </>
                      )}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </main>
  )
}
