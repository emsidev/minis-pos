import { requireEmployeeRole } from "@/lib/auth"
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

export default async function EmployeeHomePage() {
  const { employee, profileSource } = await requireEmployeeRole([
    "employee",
    "admin",
  ])

  if (employee.role === "admin") {
    let activeShift: SharedBoothSchedule | null = null
    let products: Product[] = []
    let availableProducts: Product[] = []
    let canSell = false
    let showShiftInventoryEditor = false
    let saleBlockedMessage: string | undefined

    try {
      activeShift =
        profileSource !== "snapshot"
          ? await getActiveBoothSchedule(employee.id)
          : null

      if (activeShift) {
        ;[products, availableProducts] = await Promise.all([
          getBoothScheduleProducts(activeShift.id),
          getAllAvailableProducts(),
        ])

        const adminOperatesPos =
          activeShift.operator_employee_id === employee.id
        canSell = adminOperatesPos
        showShiftInventoryEditor = adminOperatesPos

        if (!adminOperatesPos) {
          saleBlockedMessage =
            "Only the current POS operator can charge sales for this booth."
        }
      } else {
        products = (await getAllAvailableProducts()) as Product[]
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
        scheduleId={activeShift?.id}
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

  if (profileSource !== "snapshot") {
    try {
      activeShift = await getActiveOperatorBoothSchedule(employee.id)
      if (activeShift) {
        ;[shiftProducts, availableProducts] = await Promise.all([
          getBoothScheduleProducts(activeShift.id),
          getAllAvailableProducts(),
        ])
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
      preferCachedWorkspace={profileSource === "snapshot"}
    />
  )
}
