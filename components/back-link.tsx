"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

/**
 * Goes back when the previous entry in this tab is a ChessBench page, else
 * follows `href` (opened directly, from another site, or in a new tab).
 */
export function BackLink(props: React.ComponentProps<typeof Link>) {
  const router = useRouter()
  return (
    <Link
      {...props}
      onClick={(event) => {
        // The Navigation API lists only this tab's same-origin entries, so
        // index > 0 means Back stays in the app. Browsers without it use href.
        const index = window.navigation?.currentEntry?.index
        const plainClick =
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey
        if (plainClick && index !== undefined && index > 0) {
          event.preventDefault()
          router.back()
        }
      }}
    />
  )
}
