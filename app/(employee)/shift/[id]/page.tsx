import { requireEmployeeRole } from "@/lib/auth"
import {
  getBoothScheduleById,
  getBoothScheduleProducts,
  getBoothScheduleSales,
  getAllAvailableProducts,
} from "@/lib/shifts"
import { ShiftPageClient } from "@/components/shifts/ShiftPageClient"
import type { Product, SaleWithJoins, SharedBoothSchedule } from "@/lib/shifts"

type ShiftDetailsPageProps = {
  params: {
    id: string
  }
}

export default async function ShiftDetailsPage({
  params,
}: ShiftDetailsPageProps) {
  const { employee, profileSource } = await requireEmployeeRole([
    "employee",
    "admin",
  ])

  let schedule: SharedBoothSchedule | null = null
  let products: Product[] = []
  let sales: SaleWithJoins[] = []
  let availableProducts: Product[] = []

  if (profileSource !== "snapshot") {
    try {
      schedule = await getBoothScheduleById(params.id)
      if (schedule) {
        ;[products, sales, availableProducts] = await Promise.all([
          getBoothScheduleProducts(schedule.id),
          getBoothScheduleSales(schedule.id),
          getAllAvailableProducts(),
        ])
      }
    } catch (error) {
      console.warn("Could not fetch shift details from server:", error)
    }
  }

  return (
    <ShiftPageClient
      employeeId={employee.id}
      employeeRole={employee.role}
      mode="fixed"
      scheduleId={params.id}
      initialData={{
        schedule,
        products,
        sales,
      }}
      initialAvailableProducts={availableProducts}
      preferCachedData={profileSource === "snapshot"}
    />
  )
}
