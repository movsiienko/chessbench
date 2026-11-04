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
 */
export function RouteFocus() {
  const pathname = usePathname()
  const shownPath = React.useRef(pathname)
  const lastFocused = React.useRef<Element | null>(null)

  React.useEffect(() => {
    const track = () => {
      lastFocused.current = document.activeElement
    }
    document.addEventListener("focusin", track)
    return () => document.removeEventListener("focusin", track)
  }, [])

  React.useEffect(() => {
    if (shownPath.current === pathname) {
      return
    }
    shownPath.current = pathname
    const main = document.querySelector("main")
    const active = document.activeElement
    if (
      !main ||
      (active && active !== document.body && main.contains(active))
    ) {
      return
    }
    const last = lastFocused.current
    const label = last?.isConnected ? null : last?.getAttribute("aria-label")
    const same = label
      ? main.querySelector<HTMLElement>(`[aria-label="${CSS.escape(label)}"]`)
      : null
    ;(same ?? main).focus({ preventScroll: true })
  }, [pathname])

  return null
}
