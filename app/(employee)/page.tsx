import { requireEmployeeRole } from "@/lib/auth.server"
import {
  getActiveBoothSchedule,
  getActiveOperatorBoothSchedule,
  getBoothScheduleProducts,
  getAllAvailableProducts,
  type Product,
  type SharedBoothSchedule,
} from "@/lib/shifts"
import { CounterClient } from "@/components/pos/CounterClient"
import { EmployeeHomeClient } from "@/components/pos/EmployeeHomeClient"
import { getActiveCounterPromos } from "@/lib/promoData"
import type { CounterPromo } from "@/lib/promos"

export default async function EmployeeHomePage() {
  const { employee, profileSource } = await requireEmployeeRole([
    "employee",
    "admin",
  ])
  const employeeRole = employee.role === "admin" ? "admin" : "employee"

  if (employeeRole === "admin") {
    let activeShift: SharedBoothSchedule | null = null
    let products: Product[] = []
    let availableProducts: Product[] = []
    let promos: CounterPromo[] = []
    let canSell = false
    let showShiftInventoryEditor = false
    let saleBlockedMessage: string | undefined

    try {
      activeShift =
        profileSource !== "snapshot"
          ? await getActiveBoothSchedule(employee.id)
          : null

      if (activeShift) {
        ;[products, availableProducts, promos] = await Promise.all([
          getBoothScheduleProducts(activeShift.id),
          getAllAvailableProducts(),
          getActiveCounterPromos(),
        ])

        canSell = true
        showShiftInventoryEditor = true
      } else {
        ;[products, promos] = await Promise.all([
          getAllAvailableProducts() as Promise<Product[]>,
          getActiveCounterPromos(),
        ])
      }
    } catch (error) {
      console.warn("Could not fetch products from server:", error)
    }

    return (
      <CounterClient
        initialProducts={products}
        schedule={activeShift ?? undefined}
        availableProducts={availableProducts}
        boothName={activeShift?.booths.name}
        boothId={activeShift?.booth_id}
        employeeId={employee.id}
        employeeRole={employeeRole}
        scheduleId={activeShift?.id}
        promos={promos}
        preferCachedWorkspace={false}
        canSell={canSell}
        showShiftInventoryEditor={showShiftInventoryEditor}
        saleBlockedMessage={saleBlockedMessage}
      />
    )
  }

  // If employee, find active shift
  let activeShift: SharedBoothSchedule | null = null
  let shiftProducts: Product[] = []
  let availableProducts: Product[] = []
  let promos: CounterPromo[] = []

  if (profileSource !== "snapshot") {
    try {
      activeShift = await getActiveOperatorBoothSchedule(employee.id)
      if (activeShift) {
        ;[shiftProducts, availableProducts, promos] = await Promise.all([
          getBoothScheduleProducts(activeShift.id),
          getAllAvailableProducts(),
          getActiveCounterPromos(),
        ])
      } else {
        promos = await getActiveCounterPromos()
      }
    } catch (error) {
      console.warn("Could not fetch active shift from server:", error)
    }
  }

  const initialWorkspace = activeShift
    ? {
        products: shiftProducts,
        schedule: activeShift,
        boothName: activeShift.booths.name,
        boothId: activeShift.booth_id,
        scheduleId: activeShift.id,
      }
    : null

  return (
    <EmployeeHomeClient
      employeeId={employee.id}
      initialWorkspace={initialWorkspace}
      availableProducts={availableProducts}
      employeeRole={employeeRole}
      promos={promos}
      preferCachedWorkspace={profileSource === "snapshot"}
    />
  )
}
