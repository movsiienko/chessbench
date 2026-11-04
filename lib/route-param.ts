/**
 * Next hands pages a dynamic param still URL-encoded, both at request time and
 * when prerendering raw `generateStaticParams` values, so pages decode it
 * here, exactly once. A malformed escape in a typed URL is just an unknown id.
 */
export function decodeRouteParam(param: string) {
  try {
    return decodeURIComponent(param)
  } catch {
    return param
  }
}
