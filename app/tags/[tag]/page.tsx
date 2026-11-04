import { ArrowLeft, Check, X } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { BackLink } from "@/components/back-link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { categories } from "@/lib/benchmarks/dashboard-build"
import { loadDashboardData } from "@/lib/benchmarks/dashboard-load"

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

  const data = await loadDashboardData()
  // The tags a puzzle shows (and the dashboard's theme filter) decide
  // membership, so the chip a user clicked always lists its own puzzle.
  const puzzles = data.puzzles
    .filter((puzzle) => puzzle.themes.includes(category.id))
    .sort((a, b) => a.rating - b.rating)
  const models = data.models
    .map((model) => {
      const attempts = puzzles.flatMap((puzzle) =>
        puzzle.attempts.filter((attempt) => attempt.model === model.id)
      )
      const solved = attempts.filter((attempt) => attempt.solved).length
      return { ...model, solved, n: attempts.length }
    })
    .filter(({ n }) => n > 0)
    // Equal rates: the larger sample first, so 3/3 outranks 1/1.
    .sort((a, b) => b.solved / b.n - a.solved / a.n || b.n - a.n)

  return (
    <main className="mx-auto max-w-[1360px] space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <BackLink
        href="/puzzles"
        className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeft className="size-4" />
        Back
      </BackLink>

      <header className="space-y-2 border-b pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {category.label} puzzles
        </h1>
        <p className="text-sm text-muted-foreground">
          {puzzles.length} of {data.meta.puzzleCount} attempted puzzles carry
          this tag.
        </p>
      </header>

      {puzzles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No attempted puzzle carries this tag yet.
        </p>
      ) : (
        <>
          <section className="max-w-2xl space-y-3">
            <h2 className="font-medium">Solved rate by model</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Solved rate</TableHead>
                  <TableHead className="text-right">Solved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map((model) => (
                  <TableRow key={model.id}>
                    <TableCell className="font-medium whitespace-normal">
                      {model.name}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {Math.round((model.solved / model.n) * 100)}%
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground tabular-nums">
                      {model.solved}/{model.n}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          <section className="space-y-3">
            <h2 className="font-medium">Puzzles</h2>
            {models.length > 2 && (
              <p className="text-xs text-muted-foreground sm:hidden">
                Scroll sideways for all {models.length} models.
              </p>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background">
                    Puzzle
                  </TableHead>
                  <TableHead className="text-right">Rating</TableHead>
                  <TableHead>To move</TableHead>
                  {models.map((model) => (
                    <TableHead key={model.id} className="text-center">
                      <span aria-hidden title={model.name}>
                        {model.shortName}
                      </span>
                      <span className="sr-only">{model.name}</span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {puzzles.map((puzzle) => (
                  <TableRow key={puzzle.id}>
                    <TableCell className="sticky left-0 bg-background font-mono text-xs">
                      <Link
                        href={`/puzzles/${encodeURIComponent(puzzle.id)}`}
                        className="rounded-sm underline underline-offset-4 outline-none hover:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {puzzle.id}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {puzzle.rating}
                    </TableCell>
                    <TableCell>
                      {puzzle.side === "w" ? "White" : "Black"}
                    </TableCell>
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
        </>
      )}
    </main>
  )
}
