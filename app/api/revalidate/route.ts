import { revalidatePath } from "next/cache"
import { isAdminRequest } from "@/lib/admin-token"

/**
 * Regenerates the dashboard. Called on the production domain, not from inside
 * a workflow run, because runs stay pinned to the deployment that started them
 * and each deployment has its own ISR cache.
 */
export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return new Response("Not found", { status: 404 })
  }

  revalidatePath("/")
  return Response.json({ revalidated: true })
}
