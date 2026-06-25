import type {
  BoothSchedule,
  EmployeeSalesHistoryGroup,
  Product,
  SaleItemWithProduct,
  ShiftDetailData,
  SaleWithJoins,
} from "@/lib/shifts"
import type { CounterPromo } from "@/lib/promos"
import type { Database } from "@/lib/database.types"
import {
  db,
  type LocalBooth,
  type LocalEmployee,
  type LocalBoothSchedule,
  type LocalBoothScheduleAssignment,
  type LocalBoothScheduleOperatorPeriod,
  type LocalBoothScheduleProduct,
  type LocalProduct,
  type LocalSale,
  type LocalSaleItem,
  type LocalSyncState,
} from "@/lib/db"
import {
  getBusinessDate,
  getBusinessShiftState,
  hasStartedOperatorPeriod,
} from "@/lib/utils"
import { normalizePromoBenefit, normalizePromoCriteria } from "@/lib/promos"

const OFFLINE_HISTORY_DAYS = 45
const OFFLINE_FUTURE_DAYS = 30
function isInFlightSyncState(state: LocalSyncState) {
  return state === "pending" || state === "syncing"
}

export type CachedScheduleWithBooth = LocalBoothSchedule & {
  booths: LocalBooth
  booth_schedule_assignments: Array<
    LocalBoothScheduleAssignment & {
      employees?: Pick<LocalEmployee, "id" | "name" | "email"> | null
    }
  >
  booth_schedule_operator_periods: LocalBoothScheduleOperatorPeriod[]
  operator?: Pick<LocalEmployee, "id" | "name" | "email"> | null
}

export type CachedShiftDetails = {
  schedule: CachedScheduleWithBooth | null
  products: Product[]
  sales: SaleWithJoins[]
  saleItems: SaleItemWithProduct[]
  approvalHistory?: ShiftDetailData["approvalHistory"]
  pendingRevenueIncrease?: number
  pendingRevenueDecrease?: number
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
    ...sale,
    total_amount: sale.total_amount.toString(),
    promo_discount_total: sale.promo_discount_total.toString(),
    receipt_photo_local: sale.receipt_photo_local,
    sync_state: sale.sync_state,
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
  const employeeIds = Array.from(
    new Set(
      [
        ...allAssignments.map((assignment) => assignment.employee_id),
        ...availableSchedules
          .map((schedule) => schedule.operator_employee_id)
          .filter((employeeId): employeeId is string => Boolean(employeeId)),
      ].filter(Boolean)
    )
  )
  const employees =
    employeeIds.length > 0 ? await db.employees.bulkGet(employeeIds) : []
  const employeeMap = new Map(
    employees
      .filter((employee): employee is LocalEmployee => employee !== undefined)
      .map((employee) => [employee.id, employee])
  )
  const assignmentsBySchedule = new Map<
    string,
    CachedScheduleWithBooth["booth_schedule_assignments"]
  >()
  for (const assignment of allAssignments) {
    const current = assignmentsBySchedule.get(assignment.schedule_id) ?? []
    current.push({
      ...assignment,
      employees: employeeMap.get(assignment.employee_id) ?? null,
    })
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
              operator: schedule.operator_employee_id
                ? (employeeMap.get(schedule.operator_employee_id) ?? null)
                : null,
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
      saleItems: [],
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
  const employeeIds = Array.from(
    new Set(
      [
        ...assignments.map((assignment) => assignment.employee_id),
        schedule.operator_employee_id,
      ].filter((employeeId): employeeId is string => Boolean(employeeId))
    )
  )
  const employees =
    employeeIds.length > 0 ? await db.employees.bulkGet(employeeIds) : []
  const employeeMap = new Map(
    employees
      .filter((employee): employee is LocalEmployee => employee !== undefined)
      .map((employee) => [employee.id, employee])
  )
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
  const saleIds = sales.map((sale) => sale.id)
  const saleItems =
    saleIds.length > 0
      ? await db.saleItems.where("sale_id").anyOf(saleIds).toArray()
      : []
  const saleItemProductIds = saleItems.map((item) => item.product_id)
  const saleItemProducts =
    saleItemProductIds.length > 0
      ? await db.products.bulkGet(saleItemProductIds)
      : []
  const saleItemProductMap = new Map(
    saleItemProducts
      .filter((product): product is LocalProduct => product !== undefined)
      .map((product) => [product.id, product])
  )

  return {
    schedule: booth
      ? {
          ...schedule,
          booths: booth,
          booth_schedule_assignments: assignments.map((assignment) => ({
            ...assignment,
            employees: employeeMap.get(assignment.employee_id) ?? null,
          })),
          booth_schedule_operator_periods: periods,
          operator: schedule.operator_employee_id
            ? (employeeMap.get(schedule.operator_employee_id) ?? null)
            : null,
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
    saleItems: saleItems.map((item) => ({
      ...item,
      base_unit_price: item.base_unit_price.toString(),
      discount_amount: item.discount_amount.toString(),
      unit_price: item.unit_price.toString(),
      subtotal: item.subtotal.toString(),
      products: (() => {
        const product = saleItemProductMap.get(item.product_id)

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
    })),
  }
}

export async function getCachedActiveShiftDetails(
  employeeId: string
): Promise<CachedShiftDetails> {
  const schedules = await getCachedSchedulesForEmployee(employeeId)
  const currentDate = getBusinessDate()
  const scheduleIds = schedules
    .filter(
      (schedule) =>
        schedule.status === "scheduled" && schedule.date === currentDate
    )
    .map((schedule) => schedule.id)
  const scheduleProducts =
    scheduleIds.length > 0
      ? await db.boothScheduleProducts
          .where("schedule_id")
          .anyOf(scheduleIds)
          .toArray()
      : []
  const productCountBySchedule = new Map<string, number>()
  for (const row of scheduleProducts) {
    productCountBySchedule.set(
      row.schedule_id,
      (productCountBySchedule.get(row.schedule_id) ?? 0) + 1
    )
  }

  const activeSchedule = schedules.find(
    (schedule) =>
      getBusinessShiftState(schedule, {
        inventoryReady: (productCountBySchedule.get(schedule.id) ?? 0) > 0,
        manuallyStarted: hasStartedOperatorPeriod(
          schedule.booth_schedule_operator_periods
        ),
      }).isOperational
  )

  if (!activeSchedule) {
    return {
      schedule: null,
      products: [],
      sales: [],
      saleItems: [],
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

export async function hasInFlightScheduleOperations(scheduleId: string) {
  const [pendingSales, pendingInventoryEvents] = await Promise.all([
    db.sales
      .where("schedule_id")
      .equals(scheduleId)
      .filter((sale) => isInFlightSyncState(sale.sync_state))
      .count(),
    db.inventoryEvents
      .where("schedule_id")
      .equals(scheduleId)
      .filter((event) => isInFlightSyncState(event.sync_state))
      .count(),
  ])

  return pendingSales + pendingInventoryEvents > 0
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

export async function getCachedCounterPromos(): Promise<CounterPromo[]> {
  const businessDate = getBusinessDate()
  const promos = await db.promos
    .filter(
      (promo) =>
        promo.is_active !== false &&
        promo.starts_on <= businessDate &&
        promo.ends_on >= businessDate
    )
    .sortBy("name")

  if (promos.length === 0) {
    return []
  }

  const [promoProducts, products] = await Promise.all([
    db.promoProducts.toArray(),
    db.products.toArray(),
  ])
  const productNameById = new Map(
    products.map((product) => [product.id, product.name])
  )

  return promos.map((promo) => ({
    id: promo.id,
    name: promo.name,
    promoType: promo.promo_type,
    startsOn: promo.starts_on,
    endsOn: promo.ends_on,
    isActive: promo.is_active !== false,
    requiresAdminApproval: promo.requires_admin_approval === true,
    criteria: normalizePromoCriteria(promo.criteria),
    benefit: normalizePromoBenefit(promo.promo_type, promo.benefit),
    products: promoProducts
      .filter((product) => product.promo_id === promo.id)
      .map((product) => ({
        productId: product.product_id,
        productName: productNameById.get(product.product_id),
        role: product.role,
      })),
    createdAt: promo.created_at,
    updatedAt: promo.updated_at,
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
    ...item,
    base_unit_price: item.base_unit_price.toString(),
    discount_amount: item.discount_amount.toString(),
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
    base_unit_price: parseFloat(item.base_unit_price),
    discount_amount: parseFloat(item.discount_amount),
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
