import type {
  BoothSchedule,
  EmployeeSalesHistoryGroup,
  Product,
  SaleWithJoins,
} from "@/lib/shifts"
import type { Database } from "@/lib/database.types"
import {
  db,
  type LocalBooth,
  type LocalBoothSchedule,
  type LocalBoothScheduleAssignment,
  type LocalBoothScheduleOperatorPeriod,
  type LocalBoothScheduleProduct,
  type LocalProduct,
  type LocalSale,
  type LocalSaleItem,
} from "@/lib/db"
import { getBusinessDate, getBusinessTime } from "@/lib/utils"

const OFFLINE_HISTORY_DAYS = 45
const OFFLINE_FUTURE_DAYS = 30

export type CachedScheduleWithBooth = LocalBoothSchedule & {
  booths: LocalBooth
  booth_schedule_assignments: LocalBoothScheduleAssignment[]
  booth_schedule_operator_periods: LocalBoothScheduleOperatorPeriod[]
}

export type CachedShiftDetails = {
  schedule: CachedScheduleWithBooth | null
  products: Product[]
  sales: SaleWithJoins[]
}

export type CachedEmployeeSalesHistoryResult = {
  availability: "available" | "unavailable"
  groups: EmployeeSalesHistoryGroup[]
}

type CachedSaleItem = Database["public"]["Tables"]["sale_items"]["Row"] & {
  products: Product | null
}

export type CachedCounterWorkspace = {
  products: Product[]
  schedule: CachedScheduleWithBooth
  boothName?: string
  boothId?: string
  scheduleId?: string
}

function localProductToShiftProduct(
  product: LocalProduct,
  joint: LocalBoothScheduleProduct
): Product {
  return {
    id: product.id,
    name: product.name,
    price: product.price.toString(),
    category: product.category,
    image_url: product.image_url,
    is_available: product.is_available,
    created_at: product.created_at,
    quantity: joint.quantity,
    stock: joint.stock,
  }
}

function localSaleToSaleWithJoins(sale: LocalSale): SaleWithJoins {
  return {
    id: sale.id,
    booth_id: sale.booth_id,
    employee_id: sale.employee_id,
    schedule_id: sale.schedule_id,
    total_amount: sale.total_amount.toString(),
    payment_method: sale.payment_method,
    receipt_photo_path: sale.receipt_photo_path,
    receipt_photo_local: sale.receipt_photo_local,
    status: sale.status,
    sync_state: sale.sync_state,
    created_at: sale.created_at,
    employees: null,
    booths: null,
  }
}

function sortSchedulesDescending(a: BoothSchedule, b: BoothSchedule) {
  return (
    b.date.localeCompare(a.date) || b.start_time.localeCompare(a.start_time)
  )
}

function sortSalesDescending(a: LocalSale, b: LocalSale) {
  return (b.created_at ?? "").localeCompare(a.created_at ?? "")
}

function shiftDateByDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function isInsideOfflineHistoryWindow(date: string) {
  const fromDate = shiftDateByDays(-OFFLINE_HISTORY_DAYS)
  const toDate = shiftDateByDays(OFFLINE_FUTURE_DAYS)

  return date >= fromDate && date <= toDate
}

async function getBoothMap(boothIds: string[]) {
  const uniqueBoothIds = Array.from(new Set(boothIds))
  const booths = await db.booths.bulkGet(uniqueBoothIds)

  return new Map(
    booths
      .filter((booth): booth is LocalBooth => booth !== undefined)
      .map((booth) => [booth.id, booth])
  )
}

export async function getCachedSchedulesForEmployee(employeeId: string) {
  const assignments = await db.boothScheduleAssignments
    .where("employee_id")
    .equals(employeeId)
    .toArray()
  const schedules = await db.boothSchedules.bulkGet(
    assignments.map((assignment) => assignment.schedule_id)
  )
  const availableSchedules = schedules.filter(
    (schedule): schedule is LocalBoothSchedule => schedule !== undefined
  )

  if (availableSchedules.length === 0) {
    return []
  }

  const boothMap = await getBoothMap(
    availableSchedules.map((schedule) => schedule.booth_id)
  )
  const scheduleIds = availableSchedules.map((schedule) => schedule.id)
  const [allAssignments, allPeriods] = await Promise.all([
    db.boothScheduleAssignments
      .where("schedule_id")
      .anyOf(scheduleIds)
      .toArray(),
    db.boothScheduleOperatorPeriods
      .where("schedule_id")
      .anyOf(scheduleIds)
      .toArray(),
  ])
  const assignmentsBySchedule = new Map<
    string,
    LocalBoothScheduleAssignment[]
  >()
  for (const assignment of allAssignments) {
    const current = assignmentsBySchedule.get(assignment.schedule_id) ?? []
    current.push(assignment)
    assignmentsBySchedule.set(assignment.schedule_id, current)
  }
  const periodsBySchedule = new Map<
    string,
    LocalBoothScheduleOperatorPeriod[]
  >()
  for (const period of allPeriods) {
    const current = periodsBySchedule.get(period.schedule_id) ?? []
    current.push(period)
    periodsBySchedule.set(period.schedule_id, current)
  }

  return availableSchedules
    .slice()
    .sort(sortSchedulesDescending)
    .flatMap((schedule) => {
      const booth = boothMap.get(schedule.booth_id)
      return booth
        ? [
            {
              ...schedule,
              booths: booth,
              booth_schedule_assignments:
                assignmentsBySchedule.get(schedule.id) ?? [],
              booth_schedule_operator_periods:
                periodsBySchedule.get(schedule.id) ?? [],
            },
          ]
        : []
    })
}

export async function getCachedShiftDetails(
  scheduleId: string
): Promise<CachedShiftDetails> {
  const schedule = await db.boothSchedules.get(scheduleId)

  if (!schedule) {
    return {
      schedule: null,
      products: [],
      sales: [],
    }
  }

  const [booth, assignments, periods] = await Promise.all([
    db.booths.get(schedule.booth_id),
    db.boothScheduleAssignments
      .where("schedule_id")
      .equals(scheduleId)
      .toArray(),
    db.boothScheduleOperatorPeriods
      .where("schedule_id")
      .equals(scheduleId)
      .toArray(),
  ])
  const scheduleProducts = await db.boothScheduleProducts
    .where("schedule_id")
    .equals(scheduleId)
    .toArray()
  const productIds = scheduleProducts.map((joint) => joint.product_id)
  const products = await db.products.bulkGet(productIds)
  const productMap = new Map(
    products
      .filter((product): product is LocalProduct => product !== undefined)
      .map((product) => [product.id, product])
  )
  const sales = await db.sales
    .where("schedule_id")
    .equals(scheduleId)
    .filter((sale) => sale.sync_state !== "failed")
    .toArray()

  return {
    schedule: booth
      ? {
          ...schedule,
          booths: booth,
          booth_schedule_assignments: assignments,
          booth_schedule_operator_periods: periods,
        }
      : null,
    products: scheduleProducts.flatMap((joint) => {
      const product = productMap.get(joint.product_id)
      return product ? [localProductToShiftProduct(product, joint)] : []
    }),
    sales: sales
      .slice()
      .sort(sortSalesDescending)
      .map(localSaleToSaleWithJoins),
  }
}

export async function getCachedActiveShiftDetails(
  employeeId: string
): Promise<CachedShiftDetails> {
  const schedules = await getCachedSchedulesForEmployee(employeeId)
  const currentDate = getBusinessDate()
  const currentTime = getBusinessTime()

  const activeSchedule = schedules.find(
    (schedule) =>
      schedule.status === "scheduled" &&
      schedule.date === currentDate &&
      schedule.start_time <= currentTime &&
      schedule.end_time > currentTime
  )

  if (!activeSchedule) {
    return {
      schedule: null,
      products: [],
      sales: [],
    }
  }

  return getCachedShiftDetails(activeSchedule.id)
}

export async function getCachedEmployeeSalesHistoryForDate(
  employeeId: string,
  date: string
): Promise<CachedEmployeeSalesHistoryResult> {
  const schedules = await getCachedSchedulesForEmployee(employeeId)
  const matchingSchedules = schedules
    .filter((schedule) => schedule.date === date)
    .sort(
      (left, right) =>
        left.start_time.localeCompare(right.start_time) ||
        left.id.localeCompare(right.id)
    )

  if (matchingSchedules.length === 0) {
    return {
      availability: isInsideOfflineHistoryWindow(date)
        ? "available"
        : "unavailable",
      groups: [],
    }
  }

  const scheduleIds = matchingSchedules.map((schedule) => schedule.id)
  const sales = await db.sales
    .where("schedule_id")
    .anyOf(scheduleIds)
    .filter((sale) => sale.sync_state !== "failed")
    .toArray()

  const salesBySchedule = new Map<string, SaleWithJoins[]>()
  for (const sale of sales) {
    const current = salesBySchedule.get(sale.schedule_id) ?? []
    current.push(localSaleToSaleWithJoins(sale))
    salesBySchedule.set(sale.schedule_id, current)
  }

  return {
    availability: "available",
    groups: matchingSchedules.map((schedule) => ({
      schedule,
      sales: (salesBySchedule.get(schedule.id) ?? []).sort((left, right) =>
        (right.created_at ?? "").localeCompare(left.created_at ?? "")
      ),
    })),
  }
}

export async function getCachedCounterWorkspace(
  employeeId: string
): Promise<CachedCounterWorkspace | null> {
  const shiftDetails = await getCachedActiveShiftDetails(employeeId)

  if (!shiftDetails.schedule) {
    return null
  }

  if (shiftDetails.schedule.operator_employee_id !== employeeId) {
    return null
  }

  return {
    products: shiftDetails.products,
    schedule: shiftDetails.schedule,
    boothName: shiftDetails.schedule.booths.name,
    boothId: shiftDetails.schedule.booth_id,
    scheduleId: shiftDetails.schedule.id,
  }
}

export async function getCachedAvailableProducts(): Promise<Product[]> {
  const products = await db.products
    .filter((product) => product.is_available !== false)
    .sortBy("name")

  return products.map((product) => ({
    ...product,
    price: product.price.toString(),
  }))
}

export async function getCachedSaleItems(
  saleId: string
): Promise<CachedSaleItem[]> {
  const saleItems = await db.saleItems.where("sale_id").equals(saleId).toArray()

  if (saleItems.length === 0) {
    return []
  }

  const products = await db.products.bulkGet(
    saleItems.map((item) => item.product_id).filter(Boolean)
  )
  const productMap = new Map(
    products
      .filter((product): product is LocalProduct => product !== undefined)
      .map((product) => [product.id, product])
  )

  return saleItems.map((item) => ({
    id: item.id,
    sale_id: item.sale_id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price.toString(),
    subtotal: item.subtotal.toString(),
    products: (() => {
      const product = productMap.get(item.product_id)

      if (!product) {
        return null
      }

      return {
        id: product.id,
        name: product.name,
        price: product.price.toString(),
        category: product.category,
        image_url: product.image_url,
        is_available: product.is_available,
        created_at: product.created_at,
      }
    })(),
  }))
}

export async function cacheServerSaleItems(
  saleItems: Array<
    Database["public"]["Tables"]["sale_items"]["Row"] & {
      products?: Database["public"]["Tables"]["products"]["Row"] | null
    }
  >
) {
  if (saleItems.length === 0) {
    return
  }

  const cachedProducts = saleItems
    .map((item) => item.products)
    .filter(
      (product): product is Database["public"]["Tables"]["products"]["Row"] =>
        product !== null && product !== undefined
    )
    .map<LocalProduct>((product) => ({
      id: product.id,
      name: product.name,
      price: parseFloat(product.price),
      category: product.category,
      image_url: product.image_url,
      is_available: product.is_available,
      created_at: product.created_at,
    }))

  const cachedSaleItems = saleItems.map<LocalSaleItem>((item) => ({
    id: item.id,
    sale_id: item.sale_id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: parseFloat(item.unit_price),
    subtotal: parseFloat(item.subtotal),
    stock_before: null,
  }))

  await db.transaction("rw", [db.products, db.saleItems], async () => {
    if (cachedProducts.length > 0) {
      await db.products.bulkPut(cachedProducts)
    }

    await db.saleItems.bulkPut(cachedSaleItems)
  })
}
