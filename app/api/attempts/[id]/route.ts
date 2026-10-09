import { and, eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { attempts } from "@/lib/db/schema"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Only finished outcomes are cached forever; pending errors get retried.
const finished = ["ok", "wrong_move", "invalid_format"]

/** One attempt's full record, turns included. Finished attempts never change. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const [row] = uuid.test(id)
    ? await db
        .select({ record: attempts.record })
        .from(attempts)
        .where(and(eq(attempts.id, id), inArray(attempts.status, finished)))
    : []

  if (!row) {
    return new Response("Not found", { status: 404 })
  }

  return Response.json(row.record, {
    headers: {
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
    },
  })
}
