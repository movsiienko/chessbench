"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

import {
  backStaysInApp,
  type EntryState,
  isNewPushedEntry,
  PUSHED_ENTRY,
} from "@/lib/back-stays-in-app"

// Without the Navigation API, BackLink marks entries this tab pushed by client
// navigation (see isNewPushedEntry).
let lastState: EntryState | undefined
let lastPopHref: string | undefined
if (typeof window !== "undefined" && !window.navigation) {
  addEventListener("popstate", () => {
    lastPopHref = location.href
  })
  // Next.js drops custom history.state on router.refresh(), server actions and
  // same-URL navigations (its own writes carry __NA). A replace keeps the
  // entry, so carry its mark over.
  const replaceState = history.replaceState.bind(history)
  history.replaceState = (data, unused, url) =>
    replaceState(
      history.state?.[PUSHED_ENTRY] === true && data?.__NA
        ? { ...data, [PUSHED_ENTRY]: true }
        : data,
      unused,
      url
    )
}

/**
 * Goes back when the previous entry in this tab is a ChessBench page, else
 * follows `href` (opened directly, from another site, or in a new tab).
 */
export function BackLink(props: React.ComponentProps<typeof Link>) {
  const router = useRouter()
  useEffect(() => {
    if (window.navigation) return
    if (
      isNewPushedEntry(lastState, history.state, lastPopHref, location.href)
    ) {
      // Keep Next.js's own keys in the entry's state.
      history.replaceState({ ...history.state, [PUSHED_ENTRY]: true }, "")
    }
    lastState = history.state
    lastPopHref = undefined
  }, [])
  return (
    <Link
      {...props}
      onClick={(event) => {
        const plainClick =
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey
        if (
          plainClick &&
          backStaysInApp(
            window.navigation?.currentEntry?.index,
            performance.getEntriesByType("navigation")[0]?.name,
            location.href,
            history.state?.[PUSHED_ENTRY] === true
          )
        ) {
          event.preventDefault()
          router.back()
        }
      }}
    />
  )
}
