import { PGlite } from "@electric-sql/pglite"
import { neon } from "@neondatabase/serverless"
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http"
import { drizzle as drizzlePglite } from "drizzle-orm/pglite"

declare global {
  // One in-memory database per process, shared by test code and the
  // workflow bundles that the test runner loads separately.
  var chessbenchPglite: PGlite | undefined
}

const url = process.env.DATABASE_URL ?? ""

export const db: PgDatabase<PgQueryResultHKT> =
  url === "pglite:memory"
    ? drizzlePglite((globalThis.chessbenchPglite ??= new PGlite()), {
        casing: "snake_case",
      })
    : drizzleNeon(neon(url), { casing: "snake_case" })
