import assert from "node:assert/strict"
import { test } from "node:test"
import { isAdminRequest } from "./admin-token"

const request = (authorization?: string) =>
  new Request("https://example.test", {
    headers: authorization ? { authorization } : {},
  })

test("accepts only the configured bearer token, and nothing when unset", () => {
  const token = "x".repeat(48)

  delete process.env.BENCHMARK_ADMIN_TOKEN
  assert.equal(isAdminRequest(request("Bearer ")), false)
  assert.equal(isAdminRequest(request()), false)

  process.env.BENCHMARK_ADMIN_TOKEN = token
  assert.equal(isAdminRequest(request(`Bearer ${token}`)), true)
  assert.equal(isAdminRequest(request(`Bearer ${token.slice(1)}y`)), false)
  assert.equal(isAdminRequest(request(token)), false)
  assert.equal(isAdminRequest(request()), false)
  delete process.env.BENCHMARK_ADMIN_TOKEN
})
