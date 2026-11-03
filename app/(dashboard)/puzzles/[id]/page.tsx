import { notFound } from "next/navigation"
import { PuzzlePage } from "@/components/chessbench-dashboard"
import { loadDashboardData } from "@/lib/benchmarks/dashboard-load"

type Props = { params: Promise<{ id: string }> }

// Puzzles first run after the last build render on first visit, then stay cached.
export async function generateStaticParams() {
  const { puzzles } = await loadDashboardData()
  return puzzles.map(({ id }) => ({ id }))
}

export async function generateMetadata({ params }: Props) {
  const id = decodeURIComponent((await params).id)
  return { title: `Puzzle ${id} - ChessBench` }
}

export default async function Page({ params }: Props) {
  const id = decodeURIComponent((await params).id)
  // ponytail: a second query per render (the layout loads the same data);
  // wrap loadDashboardData in React cache() if revalidation gets slow.
  const { puzzles } = await loadDashboardData()
  if (!puzzles.some((puzzle) => puzzle.id === id)) {
    notFound()
  }
  return <PuzzlePage id={id} />
}
