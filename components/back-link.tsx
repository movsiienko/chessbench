"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { backStaysInApp } from "@/lib/back-stays-in-app"

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
            location.href
          )
        ) {
          event.preventDefault()
          router.back()
        }
      }}
    />
  )
}
