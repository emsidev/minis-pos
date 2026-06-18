import { requireEmployeeRole } from "@/lib/auth"
import {
  getActiveBoothSchedule,
  getBoothScheduleProducts,
  getBoothScheduleSales,
  getAllAvailableProducts,
} from "@/lib/shifts"
import { ShiftPageClient } from "@/components/shifts/ShiftPageClient"
import type { Product, SaleWithJoins, SharedBoothSchedule } from "@/lib/shifts"

export default async function ActiveShiftPage() {
  const { employee, profileSource } = await requireEmployeeRole([
    "employee",
    "admin",
  ])

  let activeShift: SharedBoothSchedule | null = null
  let products: Product[] = []
  let sales: SaleWithJoins[] = []
  let availableProducts: Product[] = []

  if (profileSource !== "snapshot") {
    try {
      activeShift = await getActiveBoothSchedule(employee.id)
      if (activeShift) {
        ;[products, sales, availableProducts] = await Promise.all([
          getBoothScheduleProducts(activeShift.id),
          getBoothScheduleSales(activeShift.id),
          getAllAvailableProducts(),
        ])
      }
    } catch (error) {
      console.warn("Could not fetch active shift from server:", error)
    }
  }

  return (
    <ShiftPageClient
      employeeId={employee.id}
      employeeRole={employee.role}
      mode="active"
      initialData={{
        schedule: activeShift,
        products,
        sales,
      }}
      initialAvailableProducts={availableProducts}
      preferCachedData={profileSource === "snapshot"}
    />
  )
}
