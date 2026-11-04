/**
 * Keyboard shortcuts for the puzzle page's Previous / Next controls: the
 * arrows, plus J (next) and K (previous) as in feed readers. Each string is a
 * valid `aria-keyshortcuts` value.
 */
export const PUZZLE_STEP_SHORTCUTS = {
  previous: "ArrowLeft K",
  next: "ArrowRight J",
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

  switch (event.key.toLowerCase()) {
    case "arrowleft":
    case "k":
      return -1
    case "arrowright":
    case "j":
      return 1
    default:
      return null
  }
}
