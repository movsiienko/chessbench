import { workflow } from "@workflow/vitest"
import { defineConfig } from "vitest/config"

// Workflow integration tests: workflows run in-process on the Workflow SDK's
// local world against an in-memory Postgres. Unit tests stay on `bun test`,
// which does not match the `.integration.ts` suffix.
export default defineConfig({
  plugins: [workflow()],
  resolve: { tsconfigPaths: true },
  test: {
    include: ["**/*.integration.ts"],
    exclude: ["node_modules/**", ".next/**"],
    setupFiles: ["./lib/test/integration-setup.ts"],
    env: { DATABASE_URL: "pglite:memory" },
    testTimeout: 60_000,
  },
})
