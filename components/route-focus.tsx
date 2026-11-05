"use client"

import { usePathname } from "next/navigation"
import * as React from "react"

/**
 * After a client navigation to a new path, moves focus to the page's <main>
 * (tabIndex={-1}) so keyboard users start in the content, not the header.
 * Next's route announcer reads out the new title. The first load and
 * query-only changes (filters, sort, open model) keep focus where it is.
 *
 * If the control that navigated is on the new page too, as the puzzle's
 * Previous/Next are, focus returns to it so repeated presses keep working.
 *
 * Why <main> and not the <h1>: the puzzle and tag pages put Back and
 * Previous/Next above the heading, so focusing the <h1> would make the next
 * Tab skip them. From <main>, the next Tab reaches the first control. The
 * extra "main" landmark announcement is the cost (JUS-59).
 */
export function RouteFocus() {
  const pathname = usePathname()
  const shownPath = React.useRef(pathname)
  const lastFocused = React.useRef<Element | null>(null)

  React.useEffect(() => {
    const track = () => {
      lastFocused.current = document.activeElement
    }
    // A pointer press starts a fresh interaction; a link Safari clicks
    // without focusing must not inherit an older keyboard focus.
    const reset = () => {
      lastFocused.current = null
    }
    document.addEventListener("focusin", track)
    document.addEventListener("pointerdown", reset, true)
    return () => {
      document.removeEventListener("focusin", track)
      document.removeEventListener("pointerdown", reset, true)
    }
  }, [])

  React.useEffect(() => {
    if (shownPath.current === pathname) {
      return
    }
    shownPath.current = pathname
    const main = document.querySelector("main")
    const last = lastFocused.current
    lastFocused.current = null
    if (!main || main.contains(document.activeElement)) {
      return
    }
    const label = last?.isConnected ? null : last?.getAttribute("aria-label")
    const same = label
      ? main.querySelector<HTMLElement>(
          `:is(a, button)[aria-label="${CSS.escape(label)}"]`
        )
      : null
    ;(same ?? main).focus({ preventScroll: true })
  }, [pathname])

  return null
}
