import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient"
import { getAdminDashboardData } from "@/lib/adminDashboard"

type AdminDashboardPageProps = {
  searchParams?: Promise<{
    date?: string
  }>
}

export default async function AdminDashboardPage({
  searchParams,
}: AdminDashboardPageProps) {
  const resolvedSearchParams = await searchParams
  const data = await getAdminDashboardData(resolvedSearchParams?.date)

  return <AdminDashboardClient data={data} />
}
