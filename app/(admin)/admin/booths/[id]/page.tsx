import { notFound } from "next/navigation"

import { AdminBoothDetailClient } from "@/components/admin/AdminBoothDetailClient"
import { requireEmployeeRole } from "@/lib/auth.server"
import {
  getActiveEmployeeOptions,
  getAdminBoothById,
  getAdminBooths,
  getAdminSchedules,
  getAvailableProductOptions,
} from "@/lib/adminBooths"

type AdminBoothDetailPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function AdminBoothDetailPage({
  params,
}: AdminBoothDetailPageProps) {
  const { id } = await params
  const { employee } = await requireEmployeeRole("admin")
  const [booth, booths, schedules, employees, products] = await Promise.all([
    getAdminBoothById(id),
    getAdminBooths(),
    getAdminSchedules(id),
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
