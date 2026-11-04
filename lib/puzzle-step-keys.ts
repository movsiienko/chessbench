/**
 * Keyboard shortcuts for the puzzle page's Previous / Next controls: the
 * arrows, plus J (next) and K (previous) as in feed readers. `aria` is an
 * `aria-keyshortcuts` value; `label` is the visible hint.
 */
export const PUZZLE_STEP_SHORTCUTS = {
  previous: { aria: "ArrowLeft K", label: "← or K" },
  next: { aria: "ArrowRight J", label: "→ or J" },
} as const

type StepKey = Pick<
  KeyboardEvent,
  | "key"
  | "code"
  | "altKey"
  | "ctrlKey"
  | "metaKey"
  | "shiftKey"
  | "repeat"
  | "defaultPrevented"
>

/**
 * -1 or 1 for a keystroke that steps to the previous or next puzzle, else
 * null. Modified keys are left to the browser and OS (back/forward, word
 * selection), and held keys are ignored so one press is one puzzle.
 */
export function puzzleStepForKey(event: StepKey): -1 | 1 | null {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  ) {
    return null
  }

  // Synthetic keydowns (autofill, extensions) can lack `key`. `code` keeps
  // J/K on their physical keys under non-Latin layouts.
  const key = event.key?.toLowerCase()

  if (key === "arrowleft" || key === "k" || event.code === "KeyK") {
    return -1
  }

  if (key === "arrowright" || key === "j" || event.code === "KeyJ") {
    return 1
  }

  return null
}
