import { requireEmployeeRole } from "@/lib/auth.server"
import {
  getBoothScheduleById,
  getBoothScheduleProducts,
  getBoothScheduleSales,
  getAllAvailableProducts,
  getSaleItemsForSales,
} from "@/lib/shifts"
import { ShiftPageClient } from "@/components/shifts/ShiftPageClient"
import {
  getPendingApprovalRevenue,
  getShiftApprovalHistory,
  type ShiftApprovalRecord,
} from "@/lib/shiftApprovals"
import type {
  Product,
  SaleItemWithProduct,
  SaleWithJoins,
  SharedBoothSchedule,
} from "@/lib/shifts"

type ShiftDetailsPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function ShiftDetailsPage({
  params,
}: ShiftDetailsPageProps) {
  const { id } = await params
  const { employee, profileSource } = await requireEmployeeRole([
    "employee",
    "admin",
  ])

  let schedule: SharedBoothSchedule | null = null
  let products: Product[] = []
  let sales: SaleWithJoins[] = []
  let saleItems: SaleItemWithProduct[] = []
  let availableProducts: Product[] = []
  let approvalHistory: ShiftApprovalRecord[] = []
  let pendingRevenueIncrease = 0
  let pendingRevenueDecrease = 0

  if (profileSource !== "snapshot") {
    try {
      schedule = await getBoothScheduleById(id)
      if (schedule) {
        ;[products, sales, availableProducts, approvalHistory] =
          await Promise.all([
            getBoothScheduleProducts(schedule.id),
            getBoothScheduleSales(schedule.id),
            getAllAvailableProducts(),
            getShiftApprovalHistory(schedule.id),
          ])
        saleItems = await getSaleItemsForSales(sales)
        const pendingRevenue = getPendingApprovalRevenue(approvalHistory)
        pendingRevenueIncrease = pendingRevenue.increase
        pendingRevenueDecrease = pendingRevenue.decrease
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
      scheduleId={id}
      initialData={{
        schedule,
        products,
        sales,
        saleItems,
        approvalHistory,
        pendingRevenueIncrease,
        pendingRevenueDecrease,
      }}
      initialAvailableProducts={availableProducts}
      preferCachedData={profileSource === "snapshot"}
    />
  )
}
