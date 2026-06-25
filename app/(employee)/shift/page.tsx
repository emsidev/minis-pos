import { requireEmployeeRole } from "@/lib/auth.server"
import {
  getActiveBoothSchedule,
  getBoothScheduleProducts,
  getBoothScheduleSales,
  getAllAvailableProducts,
  getEmployeeSchedulesForDate,
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
  TodayShiftListItem,
} from "@/lib/shifts"
import { getBusinessDate } from "@/lib/utils"

export default async function ActiveShiftPage() {
  const { employee, profileSource } = await requireEmployeeRole([
    "employee",
    "admin",
  ])

  let activeShift: SharedBoothSchedule | null = null
  let products: Product[] = []
  let sales: SaleWithJoins[] = []
  let saleItems: SaleItemWithProduct[] = []
  let availableProducts: Product[] = []
  let approvalHistory: ShiftApprovalRecord[] = []
  let pendingRevenueIncrease = 0
  let pendingRevenueDecrease = 0
  let todayShifts: TodayShiftListItem[] = []

  if (profileSource !== "snapshot") {
    try {
      ;[activeShift, todayShifts] = await Promise.all([
        getActiveBoothSchedule(employee.id),
        getEmployeeSchedulesForDate(employee.id, getBusinessDate()),
      ])
      if (activeShift) {
        ;[products, sales, availableProducts, approvalHistory] =
          await Promise.all([
            getBoothScheduleProducts(activeShift.id),
            getBoothScheduleSales(activeShift.id),
            getAllAvailableProducts(),
            getShiftApprovalHistory(activeShift.id),
          ])
        saleItems = await getSaleItemsForSales(sales)
        const pendingRevenue = getPendingApprovalRevenue(approvalHistory)
        pendingRevenueIncrease = pendingRevenue.increase
        pendingRevenueDecrease = pendingRevenue.decrease
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
        saleItems,
        approvalHistory,
        pendingRevenueIncrease,
        pendingRevenueDecrease,
      }}
      initialAvailableProducts={availableProducts}
      preferCachedData={profileSource === "snapshot"}
      todayShifts={todayShifts}
    />
  )
}
