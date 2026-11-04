/**
 * Keyboard shortcuts for the puzzle page's Previous / Next controls. Arrows
 * only: bare letter keys would fire on stray or dictated keystrokes
 * (WCAG 2.1.4). `aria` is an `aria-keyshortcuts` value; `label` is the
 * visible hint.
 */
export const PUZZLE_STEP_SHORTCUTS = {
  previous: { aria: "ArrowLeft", label: "←" },
  next: { aria: "ArrowRight", label: "→" },
} as const

type StepKey = Pick<
  KeyboardEvent,
  | "key"
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

  return event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : null
}
