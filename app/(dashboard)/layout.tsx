import { ChessBenchDashboard } from "@/components/chessbench-dashboard"
import { loadDashboardData } from "@/lib/benchmarks/dashboard-load"

// Prerendered at build; regenerated only through /api/revalidate. Client
// navigation between sections keeps this layout, so the data loads once.
export const dynamic = "force-static"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ChessBenchDashboard data={await loadDashboardData()}>
      {children}
    </ChessBenchDashboard>
  )
}
