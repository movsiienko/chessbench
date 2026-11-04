import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

export default function PuzzleNotFound() {
  return (
    <section className="grid max-w-2xl gap-4 border-b pb-6">
      <div className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        Puzzle not found
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">
        This puzzle is not in the problem set.
      </h1>
      <p className="text-base leading-7 text-muted-foreground">
        The problem set only lists puzzles with a finished attempt under the
        current protocol. Check the link, or browse the puzzles that have one.
      </p>
      <Link
        href="/puzzles"
        className={buttonVariants({ size: "sm", className: "w-fit" })}
      >
        Browse puzzles
      </Link>
    </section>
  )
}
