/**
 * Whether history Back from `current` lands on a ChessBench page.
 *
 * `index` is the Navigation API's current entry index; it lists only this
 * tab's same-origin entries, so index > 0 means Back stays in the app.
 *
 * Without the Navigation API (Firefox before 147, older Safari), `landing` is
 * the URL this document loaded at. A different path means the current entry
 * was pushed by a client navigation after landing, so the entry before it
 * belongs to this document too. The landing path itself, or a later visit
 * back to it, follows the link instead: its previous entry may be off-site.
 * This assumes no client navigation replaces the landing entry with another
 * path (no router.replace or replace links today).
 */
export function backStaysInApp(
  index: number | undefined,
  landing: string | undefined,
  current: string
) {
  if (index !== undefined) {
    return index > 0
  }
  return (
    landing !== undefined &&
    new URL(landing).pathname !== new URL(current).pathname
  )
}
