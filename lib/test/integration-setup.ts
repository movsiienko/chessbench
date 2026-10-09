import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"

// Apply the real migrations to this worker's in-memory database, then drop
// the published results that drizzle/0001 imports so each file starts empty.
globalThis.chessbenchPglite ??= new PGlite()
await migrate(drizzle(globalThis.chessbenchPglite), {
  migrationsFolder: "drizzle",
})
await globalThis.chessbenchPglite.exec(
  "delete from attempts; delete from runs;"
)
