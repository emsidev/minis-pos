import { AdminBulkScheduleClient } from "@/components/admin/AdminBulkScheduleClient"
import { requireEmployeeRole } from "@/lib/auth.server"
import { getActiveEmployeeOptions, getAdminBooths } from "@/lib/adminBooths"

export default async function AdminBulkBoothsPage() {
  await requireEmployeeRole("admin")

  const [booths, employees] = await Promise.all([
    getAdminBooths(),
    getActiveEmployeeOptions(),
  ])

  return <AdminBulkScheduleClient booths={booths} employees={employees} />
}
