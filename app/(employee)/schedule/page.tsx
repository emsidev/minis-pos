import { requireEmployeeRole } from "@/lib/auth"
import { getEmployeeScheduleBrowser } from "@/lib/shifts"
import { ScheduleCalendar } from "@/components/shifts/ScheduleCalendar"
import type { ScheduleBrowserItem } from "@/lib/shifts"
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

export default async function SchedulePage() {
  const { employee, profileSource } = await requireEmployeeRole([
    "employee",
    "admin",
  ])
  const { startDate, endDate } = getCurrentMonthBounds()

  let browseSchedules: ScheduleBrowserItem[] = []

  if (profileSource !== "snapshot") {
    try {
      browseSchedules = await getEmployeeScheduleBrowser(startDate, endDate)
    } catch (error) {
      console.warn("Could not fetch schedules from server:", error)
    }
  }

  return (
    <div className="app-page">
      <ScheduleCalendar
        employeeId={employee.id}
        browseSchedules={browseSchedules}
        preferCachedData={profileSource === "snapshot"}
      />
    </div>
  )
}
