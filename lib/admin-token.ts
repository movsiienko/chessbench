import { timingSafeEqual } from "node:crypto"

/** True when the request carries `Authorization: Bearer <BENCHMARK_ADMIN_TOKEN>`. */
export function isAdminRequest(request: Request) {
  const token = process.env.BENCHMARK_ADMIN_TOKEN ?? ""
  const expected = Buffer.from(`Bearer ${token}`)
  const received = Buffer.from(request.headers.get("authorization") ?? "")

  // An unset token fails closed instead of accepting "Bearer ".
  return (
    token.length >= 32 &&
    received.length === expected.length &&
    timingSafeEqual(received, expected)
  )
}
