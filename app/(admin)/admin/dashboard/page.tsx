import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient"
import { getAdminDashboardData } from "@/lib/adminDashboard"

type AdminDashboardPageProps = {
  searchParams?: {
    date?: string
  }
}

export default async function AdminDashboardPage({
  searchParams,
}: AdminDashboardPageProps) {
  const data = await getAdminDashboardData(searchParams?.date)

  return <AdminDashboardClient data={data} />
}
