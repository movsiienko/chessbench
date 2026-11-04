import { notFound } from "next/navigation"
import { PuzzlePage } from "@/components/chessbench-dashboard"
import { loadDashboardData } from "@/lib/benchmarks/dashboard-load"

type Props = { params: Promise<{ id: string }> }

/** Ids carry a `:`; a malformed escape in a typed URL is just an unknown id. */
async function puzzleId({ params }: Props) {
  const { id } = await params
  try {
    return decodeURIComponent(id)
  } catch {
    return id
  }
}

// Puzzles first run after the last build render on first visit, then stay cached.
export async function generateStaticParams() {
  const { puzzles } = await loadDashboardData()
  return puzzles.map(({ id }) => ({ id }))
}

export async function generateMetadata(props: Props) {
  const id = await puzzleId(props)
  return { title: `Puzzle ${id} - ChessBench` }
}

export default async function Page(props: Props) {
  const id = await puzzleId(props)
  const { puzzles } = await loadDashboardData()
  if (!puzzles.some((puzzle) => puzzle.id === id)) {
    notFound()
  }
  return <PuzzlePage id={id} />
}
