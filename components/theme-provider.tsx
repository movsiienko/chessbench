"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"

function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      <ThemeHotkey />
      {children}
    </NextThemesProvider>
  )
}

/**
 * The theme toggle keyboard shortcut. A modifier is required so the binding
 * cannot fire from a stray or dictated keystroke (WCAG 2.1.4).
 *
 * - `label` / `macLabel` are display strings; prefer `useThemeShortcutLabel()`
 *   so the rendered label stays hydration-safe.
 * - `label` also doubles as a valid `aria-keyshortcuts` value.
 */
const THEME_SHORTCUT = {
  key: "d",
  code: "KeyD",
  altKey: true,
  shiftKey: true,
  label: "Alt+Shift+D",
  macLabel: "⌥⇧D",
} as const

function isMacPlatform() {
  if (typeof navigator === "undefined") {
    return false
  }

  return /mac|iphone|ipad|ipod/i.test(navigator.userAgent)
}

function subscribeShortcutLabel() {
  return () => {}
}

/**
 * Platform-aware label for the theme shortcut, e.g. for a tooltip or
 * `aria-keyshortcuts`. Renders the generic label on the server and during
 * hydration, then swaps to the mac glyphs on macOS.
 */
function useThemeShortcutLabel() {
  return React.useSyncExternalStore(
    subscribeShortcutLabel,
    () => (isMacPlatform() ? THEME_SHORTCUT.macLabel : THEME_SHORTCUT.label),
    () => THEME_SHORTCUT.label
  )
}

function matchesThemeShortcut(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey) {
    return false
  }

  if (event.altKey !== THEME_SHORTCUT.altKey) {
    return false
  }

  if (event.shiftKey !== THEME_SHORTCUT.shiftKey) {
    return false
  }

  // With Alt held, macOS reports a composed character in `event.key`, so fall
  // back to the physical key position.
  return (
    event.key.toLowerCase() === THEME_SHORTCUT.key ||
    event.code === THEME_SHORTCUT.code
  )
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  )
}

function ThemeHotkey() {
  const { resolvedTheme, setTheme } = useTheme()

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) {
        return
      }

      if (!matchesThemeShortcut(event)) {
        return
      }

      if (isTypingTarget(event.target)) {
        return
      }

      event.preventDefault()
      setTheme(resolvedTheme === "dark" ? "light" : "dark")
    }

    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [resolvedTheme, setTheme])

  return null
}

export { ThemeProvider, THEME_SHORTCUT, useThemeShortcutLabel }
