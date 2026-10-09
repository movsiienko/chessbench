import { ChessBenchDashboard } from "@/components/chessbench-dashboard"
import { loadDashboardData } from "@/lib/benchmarks/dashboard-load"

// Prerendered at build; regenerated only through /api/revalidate.
export const dynamic = "force-static"

export default async function Page() {
  return <ChessBenchDashboard data={await loadDashboardData()} />
}
