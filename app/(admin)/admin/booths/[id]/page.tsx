import { notFound } from "next/navigation"

import { AdminBoothDetailClient } from "@/components/admin/AdminBoothDetailClient"
import { requireEmployeeRole } from "@/lib/auth"
import {
  getActiveEmployeeOptions,
  getAdminBoothById,
  getAdminBooths,
  getAdminSchedules,
  getAvailableProductOptions,
} from "@/lib/adminBooths"

type AdminBoothDetailPageProps = {
  params: {
    id: string
  }
}

export default async function AdminBoothDetailPage({
  params,
}: AdminBoothDetailPageProps) {
  const { employee } = await requireEmployeeRole("admin")
  const [booth, booths, schedules, employees, products] = await Promise.all([
    getAdminBoothById(params.id),
    getAdminBooths(),
    getAdminSchedules(params.id),
    getActiveEmployeeOptions(),
    getAvailableProductOptions(),
  ])

  if (!booth) {
    notFound()
  }

  return (
    <AdminBoothDetailClient
      booth={booth}
      booths={booths}
      schedules={schedules}
      employees={employees}
      products={products}
      currentEmployeeId={employee.id}
    />
  )
}
