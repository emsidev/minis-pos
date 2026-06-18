import { requireEmployeeRole } from "@/lib/auth"
import {
  type EmployeeSalesHistoryGroup,
  getEmployeeSalesHistoryForDate,
  getEmployeeSchedules,
} from "@/lib/shifts"
import { ScheduleCalendar } from "@/components/shifts/ScheduleCalendar"
import type { SharedBoothSchedule } from "@/lib/shifts"
import { getBusinessDate } from "@/lib/utils"

export default async function SchedulePage() {
  const { employee, profileSource } = await requireEmployeeRole([
    "employee",
    "admin",
  ])
  const selectedHistoryDate = getBusinessDate()

  let schedules: SharedBoothSchedule[] = []
  let salesHistory: EmployeeSalesHistoryGroup[] = []

  if (profileSource !== "snapshot") {
    try {
      ;[schedules, salesHistory] = await Promise.all([
        getEmployeeSchedules(employee.id),
        getEmployeeSalesHistoryForDate(employee.id, selectedHistoryDate),
      ])
    } catch (error) {
      console.warn("Could not fetch schedules from server:", error)
    }
  }

  return (
    <div className="app-page">
      <ScheduleCalendar
        employeeId={employee.id}
        schedules={schedules}
        initialSalesHistoryDate={selectedHistoryDate}
        initialSalesHistoryGroups={salesHistory}
        preferCachedSalesHistory={profileSource === "snapshot"}
      />
    </div>
  )
}
