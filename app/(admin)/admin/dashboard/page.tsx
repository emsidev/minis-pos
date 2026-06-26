import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient"
import { getAdminDashboardData } from "@/lib/adminDashboard"

type AdminDashboardPageProps = {
  searchParams?: Promise<{
    date?: string
    startDate?: string
    endDate?: string
  }>
}

export default async function AdminDashboardPage({
  searchParams,
}: AdminDashboardPageProps) {
  const resolvedSearchParams = await searchParams
  const data = await getAdminDashboardData({
    date: resolvedSearchParams?.date,
    startDate: resolvedSearchParams?.startDate,
    endDate: resolvedSearchParams?.endDate,
  })

  return <AdminDashboardClient data={data} />
}
