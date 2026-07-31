"use client"

import * as React from "react"

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

function subscribe(onStoreChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY)
  query.addEventListener("change", onStoreChange)

  return () => {
    query.removeEventListener("change", onStoreChange)
  }
}

function getSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

function getServerSnapshot() {
  return false
}

/**
 * Tracks the user's `prefers-reduced-motion` setting.
 *
 * SSR-safe: the server snapshot is `false`, so markup renders identically on
 * both sides and the real value arrives on hydration. Use it to skip
 * JS-driven motion (Chessground piece animation) that CSS cannot reach.
 */
function usePreferReducedMotion(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export { usePreferReducedMotion }
