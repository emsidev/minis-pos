import { AdminBoothsClient } from "@/components/admin/AdminBoothsClient"
import { requireEmployeeRole } from "@/lib/auth"
import {
  getActiveEmployeeOptions,
  getAdminBooths,
  getAdminScheduleCalendarItems,
} from "@/lib/adminBooths"
import { getBusinessDate } from "@/lib/utils"

function getCurrentMonthBounds() {
  const [year, month] = getBusinessDate().split("-").map(Number)
  const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const paddedMonth = String(month).padStart(2, "0")

  return {
    startDate: `${year}-${paddedMonth}-01`,
    endDate: `${year}-${paddedMonth}-${String(endDay).padStart(2, "0")}`,
  }
}

export default async function AdminBoothsPage() {
  const { employee } = await requireEmployeeRole("admin")
  const { startDate, endDate } = getCurrentMonthBounds()
  const [booths, schedules, employees] = await Promise.all([
    getAdminBooths(),
    getAdminScheduleCalendarItems(startDate, endDate),
    getActiveEmployeeOptions(),
  ])

  return (
    <AdminBoothsClient
      booths={booths}
      schedules={schedules}
      employees={employees}
      currentEmployeeId={employee.id}
    />
  )
}
