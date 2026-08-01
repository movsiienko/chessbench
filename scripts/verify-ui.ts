/**
 * Browser checks for the things a typecheck cannot see.
 *
 * Every assertion here exists because a real defect got past source review:
 * a y-axis tick that rendered 4px outside its chart, radial ticks printed on
 * top of a spoke label, and two scatter labels drawn over each other because
 * the collision test compared values for equality while the points rendered a
 * pixel apart. Reading the source made all three look correct.
 *
 * Run against a server that is already up:
 *   bun run build && bun run start &
 *   bun run verify:ui
 */
import { Chess } from "chess.js"
import { chromium, type Page } from "playwright"

const BASE = process.env.VERIFY_URL ?? "http://localhost:3000"

type Failure = { check: string; detail: string }

const failures: Failure[] = []
const fail = (check: string, detail: string) => failures.push({ check, detail })
const ok = (check: string, detail = "") =>
  console.log(`  ok    ${check}${detail ? ` - ${detail}` : ""}`)

/** No chart mark, label or tick may overlap another, or leave its own chart. */
async function checkChartCollisions(page: Page) {
  const hits = await page.evaluate(() => {
    const found: string[] = []
    const box = (el: Element) => el.getBoundingClientRect()
    const overlap = (a: DOMRect, b: DOMRect) => {
      const x = Math.min(a.right, b.right) - Math.max(a.left, b.left)
      const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      return x > 1 && y > 1 ? `${Math.round(x)}x${Math.round(y)}px` : null
    }

    document.querySelectorAll(".recharts-wrapper").forEach((wrap, chart) => {
      const wrapBox = box(wrap)
      const labels = [...wrap.querySelectorAll(".recharts-label-list text")]
      const ticks = [
        ...wrap.querySelectorAll(".recharts-cartesian-axis-tick-value"),
        ...wrap.querySelectorAll(".recharts-polar-radius-axis-tick-value"),
      ]
      const spokes = [
        ...wrap.querySelectorAll(".recharts-polar-angle-axis-tick-value"),
      ]

      ;[...labels, ...ticks].forEach((el) => {
        const r = box(el)
        if (
          r.width > 0 &&
          (r.left < wrapBox.left - 0.5 || r.right > wrapBox.right + 0.5)
        )
          found.push(
            `chart ${chart}: "${el.textContent}" is clipped by the chart edge`
          )
      })

      labels.forEach((label, index) => {
        const r = box(label)
        if (!r.width) return

        ticks.forEach((tick) => {
          const o = overlap(r, box(tick))
          if (o)
            found.push(
              `chart ${chart}: label "${label.textContent}" overlaps tick "${tick.textContent}" by ${o}`
            )
        })

        labels.slice(index + 1).forEach((other) => {
          const o = overlap(r, box(other))
          if (o)
            found.push(
              `chart ${chart}: labels "${label.textContent}" and "${other.textContent}" overlap by ${o}`
            )
        })
      })

      spokes.forEach((spoke) =>
        ticks.forEach((tick) => {
          const o = overlap(box(spoke), box(tick))
          if (o)
            found.push(
              `chart ${chart}: spoke "${spoke.textContent}" overlaps tick "${tick.textContent}" by ${o}`
            )
        })
      )
    })

    return found
  })

  if (hits.length) hits.forEach((h) => fail("chart layout", h))
  else ok("chart layout", "no clipped or overlapping labels, ticks or spokes")
}

/** Series colours must clear the 3:1 non-text floor against the card they sit on. */
async function checkSeriesContrast(page: Page, theme: string) {
  const sample = await page.evaluate(() => {
    // The stylesheet is authored in oklch, so getComputedStyle hands back
    // `lab(...)`, not `rgb(...)`. Scraping digits out of that string and calling
    // them RGB silently produces nonsense - it reported the white card as
    // rgb(100,0,0) and turned a passing 17.74:1 into a failing 1.30:1. Painting
    // the colour and reading the pixel back is the only reading that is true
    // regardless of the colour space the author used.
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!
    const toRGB = (css: string) => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = css
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
      return [r, g, b]
    }

    const fills = new Set<string>()
    document
      .querySelectorAll(".recharts-bar-rectangle path")
      .forEach((p) => fills.add(getComputedStyle(p).fill))
    const card = document.querySelector('[data-slot="card"]')

    return {
      cardBg: card ? toRGB(getComputedStyle(card).backgroundColor) : null,
      fills: [...fills].map((fill) => ({ css: fill, rgb: toRGB(fill) })),
    }
  })

  if (!sample.cardBg || !sample.fills.length) {
    fail("series contrast", `${theme}: found no bars or card to measure`)
    return
  }

  const channel = (raw: number) => {
    const c = raw / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const luminance = (rgb: number[]) =>
    0.2126 * channel(rgb[0]) +
    0.7152 * channel(rgb[1]) +
    0.0722 * channel(rgb[2])
  const ratio = (a: number[], b: number[]) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }

  let worst = Infinity

  for (const fill of sample.fills) {
    const value = ratio(fill.rgb, sample.cardBg)
    worst = Math.min(worst, value)
    if (value < 3)
      fail(
        "series contrast",
        `${theme}: ${fill.css} is ${value.toFixed(2)}:1 against the card, below the 3:1 floor`
      )
  }

  if (worst >= 3)
    ok("series contrast", `${theme}: worst series is ${worst.toFixed(2)}:1`)
}

/** The board must be operable, and reduced motion must not break that. */
async function checkBoardAndMotion(page: Page, reduced: boolean) {
  await page.getByRole("tab", { name: /problems/i }).click()
  await page.locator('[role="button"][aria-label*="Puzzle"]').first().click()
  await page.waitForSelector(".cg-wrap")
  await page.evaluate(() =>
    document.querySelector(".cg-wrap")?.setAttribute("data-probe", "original")
  )

  const animating = page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        let seen = false
        let frames = 0
        const tick = () => {
          if (document.querySelectorAll(".cg-wrap piece.anim").length)
            seen = true
          if (++frames < 30) requestAnimationFrame(tick)
          else resolve(seen)
        }
        requestAnimationFrame(tick)
      })
  )

  // The move has to be legal in *this* puzzle, which is never the opening
  // position, so it is derived from the FEN the page is showing rather than
  // hardcoded. An illegal move takes the rejection path and would not exercise
  // the announcement being checked here.
  const fen = await page.evaluate(() => {
    const match = document.body.innerText.match(
      /([rnbqkpRNBQKP1-8]+\/[rnbqkpRNBQKP1-8/]+ [wb] [KQkq-]+ [a-h1-8-]+ \d+ \d+)/
    )
    return match ? match[1] : null
  })

  if (!fen) {
    fail("board fixture", "could not read a FEN from the puzzle view")
    return
  }

  const statusBefore = await page.evaluate(() =>
    [...document.querySelectorAll('[role="status"]')]
      .map((el) => el.textContent?.trim() ?? "")
      .join("|")
  )

  const input = page.getByPlaceholder(/Nf3 or g1f3/i)
  await input.fill(new Chess(fen).moves()[0])
  await page.keyboard.press("Enter")
  const sawAnimation = await animating
  await page.waitForTimeout(200)

  const state = await page.evaluate(() => ({
    survived:
      document.querySelector(".cg-wrap")?.getAttribute("data-probe") ===
      "original",
    status: [...document.querySelectorAll('[role="status"]')]
      .map((el) => el.textContent?.trim() ?? "")
      .join("|"),
  }))

  // Comparing against the pre-move snapshot, because a live region that already
  // held text would otherwise pass this check without the move announcing
  // anything at all.
  const announced = state.status !== statusBefore && state.status.trim() !== ""

  if (!state.survived)
    fail(
      "board lifecycle",
      "the board was remounted by a move instead of updated via api.set()"
    )
  else ok("board lifecycle", "board node survives a move")

  if (!announced)
    fail(
      "board feedback",
      `live region did not change when the move was played (before: "${statusBefore}", after: "${state.status}")`
    )
  else ok("board feedback", "move changes the live region")

  if (reduced && sawAnimation)
    fail(
      "reduced motion",
      "chessground animated pieces while prefers-reduced-motion was set"
    )
  else if (reduced) ok("reduced motion", "piece animation suppressed")
  else
    ok(
      "piece animation",
      sawAnimation
        ? "runs normally"
        : "did not run (expected outside reduced motion)"
    )
}

/** Structural guarantees: no third-party calls, charts named, tables present. */
async function checkStructure(page: Page, external: string[]) {
  if (external.length)
    fail("no third-party requests", `page requested ${external.join(", ")}`)
  else ok("no third-party requests")

  const structure = await page.evaluate(() => ({
    charts: [...document.querySelectorAll(".recharts-surface")].map((s) => ({
      named: Boolean(s.querySelector("title")?.textContent),
      focusable: s.getAttribute("tabindex") === "0",
    })),
    tables: document.querySelectorAll("table.sr-only").length,
    h1: document.querySelectorAll("h1").length,
    skip: document.querySelector('a[href="#cb-main"]') !== null,
  }))

  const unnamed = structure.charts.filter((c) => !c.named).length
  if (unnamed) fail("chart names", `${unnamed} chart(s) have no <title>`)
  else ok("chart names", `${structure.charts.length} charts named`)

  const unfocusable = structure.charts.filter((c) => !c.focusable).length
  if (unfocusable)
    fail("chart keyboard access", `${unfocusable} chart(s) are not focusable`)
  else ok("chart keyboard access", "all charts focusable")

  if (structure.tables < structure.charts.length)
    fail(
      "chart data tables",
      `${structure.tables} sr-only tables for ${structure.charts.length} charts`
    )
  else ok("chart data tables", `${structure.tables} tables`)

  if (structure.h1 !== 1)
    fail("heading outline", `expected exactly one h1, found ${structure.h1}`)
  else ok("heading outline", "exactly one h1")

  if (!structure.skip) fail("skip link", "no link targeting #cb-main")
  else ok("skip link", "present")
}

const browser = await chromium.launch()

for (const reduced of [false, true]) {
  const label = reduced ? "prefers-reduced-motion: reduce" : "default motion"
  console.log(`\n${label}`)

  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  })
  if (reduced) await page.emulateMedia({ reducedMotion: "reduce" })

  const external: string[] = []
  page.on("request", (r) => {
    const { hostname } = new URL(r.url())
    // Only genuinely remote hosts count. `next dev` opens its own HMR socket on
    // a second local port, which is tooling, not a visitor-facing request.
    const local =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]"
    if (!local) external.push(hostname)
  })
  page.on("pageerror", (e) => fail("console", `uncaught error: ${e.message}`))

  await page.goto(BASE, { waitUntil: "networkidle" })

  if (!reduced) {
    await checkStructure(page, external)
    await checkChartCollisions(page)
    await checkSeriesContrast(page, "light")
    await page.keyboard.press("Alt+Shift+D")
    await page.waitForTimeout(400)
    const dark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    )
    if (!dark) fail("theme shortcut", "Alt+Shift+D did not switch to dark")
    else ok("theme shortcut", "Alt+Shift+D toggles the theme")
    await checkSeriesContrast(page, "dark")
    await page.keyboard.press("Alt+Shift+D")
    await page.waitForTimeout(300)
  }

  await checkBoardAndMotion(page, reduced)
  await page.close()
}

await browser.close()

if (failures.length) {
  console.log(`\n${failures.length} check(s) failed:`)
  for (const f of failures) console.log(`  FAIL  ${f.check}: ${f.detail}`)
  process.exit(1)
}

console.log("\nAll browser checks passed.")
