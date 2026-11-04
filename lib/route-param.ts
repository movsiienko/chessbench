/**
 * A dynamic route param as the page receives it: still URL-encoded at request
 * time on Vercel, so pages decode it here, once. `generateStaticParams` hands
 * out `encodeURIComponent(id)` so build-time params arrive in the same form.
 * A malformed escape in a typed URL is just an unknown id.
 */
export function decodeRouteParam(param: string) {
  try {
    return decodeURIComponent(param)
  } catch {
    return param
  }
}
