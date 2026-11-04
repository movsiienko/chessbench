const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]"])

/**
 * Whether a request the page makes counts as first-party for `base`, the URL
 * under test. The target's own host is first-party, as is any local host
 * (`next dev` opens its HMR socket on a second local port). On a Vercel
 * preview, Vercel injects its toolbar from vercel.live; that is the host's
 * tooling, not a visitor-facing request, so it is allowed there and only there.
 */
export function isFirstParty(request: string, base: string) {
  const host = new URL(request).hostname
  const baseHost = new URL(base).hostname
  if (host === baseHost || LOCAL.has(host)) return true
  return (
    baseHost.endsWith(".vercel.app") &&
    (host === "vercel.live" || host.endsWith(".vercel.live"))
  )
}
