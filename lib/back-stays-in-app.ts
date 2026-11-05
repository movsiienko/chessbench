/** `history.state` key marking an entry pushed by a client navigation. */
export const PUSHED_ENTRY = "chessbenchPushed"

/** `history.state` as Next.js writes it, plus the PUSHED_ENTRY marker. */
export type EntryState = { [PUSHED_ENTRY]?: true } | null

/**
 * Whether a BackLink mounting on the entry with `state` at `href` is on an entry
 * this tab just pushed, so its previous entry is a ChessBench page.
 *
 * `lastState` is the entry state at the previous BackLink mount in this
 * document (undefined at the first, which may be the landing entry). The same
 * state object means the same entry (a remount, e.g. React Strict Mode).
 * `lastPopHref` is where a Back/Forward traversal since then landed; arriving
 * there is not a push. When unsure the answer is false, so Back follows the
 * link instead of possibly leaving the site.
 */
export function isNewPushedEntry(
  lastState: EntryState | undefined,
  state: EntryState,
  lastPopHref: string | undefined,
  href: string
) {
  return lastState !== undefined && state !== lastState && lastPopHref !== href
}

/**
 * Whether history Back from `current` lands on a ChessBench page.
 *
 * `index` is the Navigation API's current entry index; it lists only this
 * tab's same-origin entries, so index > 0 means Back stays in the app.
 *
 * Without the Navigation API (Firefox before 147, older Safari), `landing` is
 * the URL this document loaded at. A different path, or `pushed` (the entry's
 * PUSHED_ENTRY marker), means the current entry was pushed by a client
 * navigation, so the entry before it is a ChessBench page. An unmarked entry at
 * the landing path follows the link instead: its previous entry may be
 * off-site. This assumes no client navigation replaces the landing entry with
 * another path (no router.replace or replace links today).
 */
export function backStaysInApp(
  index: number | undefined,
  landing: string | undefined,
  current: string,
  pushed = false
) {
  if (index !== undefined) {
    return index > 0
  }
  return (
    pushed ||
    (landing !== undefined &&
      new URL(landing).pathname !== new URL(current).pathname)
  )
}
