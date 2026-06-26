import { createClient } from "./supabase"
import {
  deleteReceiptPhoto,
  uploadReceiptPhotoForSale,
} from "@/app/actions/receipts"
import { finalizePosSale } from "@/app/actions/pos"
import {
  db,
  type LocalBooth,
  type LocalBoothSchedule,
  type LocalBoothScheduleAssignment,
  type LocalBoothScheduleOperatorPeriod,
  type LocalBoothScheduleProduct,
  type LocalEmployee,
  type LocalInventoryEvent,
  type LocalInventoryEventLine,
  type LocalProduct,
  type LocalPromo,
  type LocalPromoProduct,
  type LocalSale,
  type LocalSalePayment,
  type LocalSaleItem,
  type LocalSyncFailureKind,
  type LocalSyncState,
} from "./db"
import {
  createClientId,
  getBusinessDate,
  getBusinessTime,
  hasStartedOperatorPeriod,
} from "./utils"
import type { Database, Json } from "./database.types"
import type { InventoryEventType, PaymentMethod } from "./domain-types"
import type { CounterPromo } from "./promos"
import type { Product, SharedBoothSchedule } from "./shifts"

const OFFLINE_HISTORY_DAYS = 45
const OFFLINE_FUTURE_DAYS = 30
const OFFLINE_BOOTSTRAP_FRESHNESS_MS = 5 * 60 * 1000
const RETRY_DELAYS_MS = [30_000, 120_000, 600_000, 1_800_000] as const
const IN_FLIGHT_SYNC_STATES = ["pending", "syncing"] satisfies LocalSyncState[]

function normalizeInventoryEventType(value: string): InventoryEventType {
  switch (value) {
    case "opening":
    case "adjustment":
    case "admin_override":
    case "closeout":
      return value
    default:
      return "adjustment"
  }
}

function normalizePaymentMethod(
  value: string | null | undefined
): PaymentMethod {
  switch (value) {
    case "cash":
    case "gcash":
    case "maya":
    case "maribank":
    case "unionbank":
    case "other":
      return value
    default:
      return "cash"
  }
}

function getOfflineBootstrapStorageKey(employeeId: string) {
  return `mini-pos:offline-bootstrap:${employeeId}`
}

export function isEmployeeOfflineBootstrapFresh(employeeId: string) {
  if (typeof window === "undefined") {
    return false
  }

  try {
    const value = window.localStorage.getItem(
      getOfflineBootstrapStorageKey(employeeId)
    )
    const refreshedAt = value ? Number(value) : Number.NaN
    return (
      Number.isFinite(refreshedAt) &&
      Date.now() - refreshedAt < OFFLINE_BOOTSTRAP_FRESHNESS_MS
    )
  } catch {
    return false
  }
}

export type SyncProgressCallback = (
  step: number,
  totalSteps: number,
  label: string
) => void

export type InventoryEventPayload = {
  scheduleId: string
  schedule?: SharedBoothSchedule
  employeeId: string
  eventType: Extract<InventoryEventType, "opening" | "adjustment">
  reason?: string
  products: Product[]
  currentInventory?: Product[]
  lines: {
    productId: string
    resultingStock: number
  }[]
}

export type PosSyncResult = {
  inventory: number
  sales: number
  conflicts: number
  failed: number
}

let activeSync: Promise<PosSyncResult> | null = null
const activeBootstraps = new Map<string, Promise<OfflineBootstrapResult>>()

function shiftDateByDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function productToLocalProduct(
  product: Database["public"]["Tables"]["products"]["Row"]
): LocalProduct {
  return {
    ...product,
    price: Number(product.price),
  }
}

type SyncFailureInfo = {
  message: string
  isConflict: boolean
  kind: LocalSyncFailureKind
}

type OfflineBootstrapResult = {
  scheduleCount: number
  saleCount: number
  saleItemCount: number
  skipped?: boolean
}

type SyncAttemptResult =
  | {
      synced: true
    }
  | {
      synced: false
      isConflict: boolean
      kind: LocalSyncFailureKind
      message: string
    }

type ActiveShiftRow = LocalBoothSchedule & {
  booths: LocalBooth
  booth_schedule_assignments: LocalBoothScheduleAssignment[]
  booth_schedule_operator_periods: LocalBoothScheduleOperatorPeriod[]
  booth_schedule_products?: Array<{ id: string }>
}

type ActiveShiftWorkspacePayload = {
  activeShift: ActiveShiftRow
  scheduleProducts: LocalBoothScheduleProduct[]
  products: Database["public"]["Tables"]["products"]["Row"][]
  sales: Database["public"]["Tables"]["sales"]["Row"][]
  salePayments: Database["public"]["Tables"]["sale_payments"]["Row"][]
  saleItems: Database["public"]["Tables"]["sale_items"]["Row"][]
}

function isErrorLikeRecord(
  value: unknown
): value is Record<string, string | number | null | undefined> {
  return typeof value === "object" && value !== null
}

function readFirstSyncErrorString(values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim()
    }

    if (typeof value === "number") {
      return String(value)
    }
  }

  return null
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function readSyncErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim()
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim()
  }

  if (isErrorLikeRecord(error)) {
    const recordMessage = readFirstSyncErrorString([
      error.message,
      error.error_description,
      error.details,
      error.hint,
      error.error,
      error.code,
    ])

    if (recordMessage) {
      return recordMessage
    }
  }

  return "Unknown synchronization error."
}

function getSyncError(error: unknown): SyncFailureInfo {
  const message = readSyncErrorMessage(error)
  const normalized = message.toUpperCase()

  if (
    normalized.includes("INVENTORY_STALE") ||
    normalized.includes("INVENTORY_NOT_INITIALIZED")
  ) {
    return {
      message:
        "Inventory conflict: stock changed remotely. Review this shift before retrying.",
      isConflict: true,
      kind: "conflict",
    }
  }

  if (
    normalized.includes("SHIFT_NOT_ACTIVE_FOR_INVENTORY") ||
    normalized.includes("INVALID_ACTIVE_SCHEDULE") ||
    normalized.includes("INVENTORY_ALREADY_INITIALIZED")
  ) {
    return {
      message:
        "POS responsibility changed before this entry synced. Review the shift handoff and stock.",
      isConflict: true,
      kind: "conflict",
    }
  }

  if (normalized.includes("RECEIPT_PHOTO_REQUIRED")) {
    return {
      message:
        "This non-cash sale is missing its receipt photo. Add the receipt photo before retrying.",
      isConflict: false,
      kind: "permanent",
    }
  }

  if (normalized.includes("RECEIPT_PHOTO_UPLOAD_FAILED")) {
    return {
      message:
        "The receipt photo could not be uploaded. Retry after reconnecting. If it still fails, retake the receipt photo.",
      isConflict: false,
      kind: "transient",
    }
  }

  if (
    normalized.includes("PRODUCT_PRICE_STALE") ||
    normalized.includes("PROMO_NOT_ELIGIBLE") ||
    normalized.includes("INVALID_PROMO") ||
    normalized.includes("PROMO_APPROVAL_REQUIRED") ||
    normalized.includes("PROMO_APPROVAL_PENDING") ||
    normalized.includes("PROMO_APPROVAL_REJECTED") ||
    normalized.includes("PROMO_APPROVAL_STALE") ||
    normalized.includes("PROMO_APPROVAL_USED")
  ) {
    return {
      message:
        "Promo or product pricing changed before sync could finish. Review the sale in Needs Review.",
      isConflict: true,
      kind: "permanent",
    }
  }

  if (
    normalized.includes("RECEIPT_PHOTO_NOT_FOUND") ||
    normalized.includes("INVALID_RECEIPT_PHOTO_PATH")
  ) {
    return {
      message:
        "The receipt photo could not be matched online. Retry after reconnecting. If it still fails, retake the receipt photo.",
      isConflict: false,
      kind: normalized.includes("INVALID_RECEIPT_PHOTO_PATH")
        ? "permanent"
        : "transient",
    }
  }

  if (
    normalized.includes("EMPLOYEE_NOT_AUTHORIZED") ||
    normalized.includes("JWT") ||
    normalized.includes("NOT AUTHENTICATED") ||
    normalized.includes("INVALID REFRESH TOKEN") ||
    normalized.includes("REFRESH TOKEN NOT FOUND") ||
    normalized.includes("SESSION")
  ) {
    return {
      message:
        "Your sign-in session expired before sync could finish. Sign in again, then retry.",
      isConflict: false,
      kind: "permanent",
    }
  }

  if (
    normalized.includes("FAILED TO FETCH") ||
    normalized.includes("FETCH FAILED") ||
    normalized.includes("NETWORK") ||
    normalized.includes("OFFLINE") ||
    normalized.includes("TIMEOUT") ||
    normalized.includes("TIMED OUT") ||
    normalized.includes("CONNECTION") ||
    normalized.includes("ENOTFOUND")
  ) {
    return {
      message: "The connection to Supabase failed. Reconnect and retry sync.",
      isConflict: false,
      kind: "transient",
    }
  }

  return { message, isConflict: false, kind: "transient" }
}

function getNextRetryAt(attemptCount: number) {
  const retryIndex =
    Math.min(Math.max(attemptCount, 1), RETRY_DELAYS_MS.length) - 1
  const delay = RETRY_DELAYS_MS[retryIndex]
  return new Date(Date.now() + delay).toISOString()
}

function isInFlightSyncState(state: LocalSyncState) {
  return state === "pending" || state === "syncing"
}

async function hasPendingOperations(scheduleId: string) {
  const [pendingEvents, pendingSales] = await Promise.all([
    db.inventoryEvents
      .where("schedule_id")
      .equals(scheduleId)
      .filter((event) => isInFlightSyncState(event.sync_state))
      .count(),
    db.sales
      .where("schedule_id")
      .equals(scheduleId)
      .filter((sale) => isInFlightSyncState(sale.sync_state))
      .count(),
  ])

  return pendingEvents > 0 || pendingSales > 0
}

export async function getPendingOperationCountsForSchedule(scheduleId: string) {
  const [pendingEvents, pendingSales] = await Promise.all([
    db.inventoryEvents
      .where("schedule_id")
      .equals(scheduleId)
      .filter((event) => event.sync_state !== "synced")
      .count(),
    db.sales
      .where("schedule_id")
      .equals(scheduleId)
      .filter((sale) => sale.sync_state !== "synced")
      .count(),
  ])

  return {
    pendingInventoryEvents: pendingEvents,
    pendingSales,
    total: pendingEvents + pendingSales,
  }
}

export async function cacheAvailableProducts(products: Product[]) {
  if (products.length === 0) {
    return
  }

  await db.products.bulkPut(
    products.map((product) =>
      productToLocalProduct({
        id: product.id,
        name: product.name,
        price: product.price,
        category: product.category,
        image_url: product.image_url,
        is_available: product.is_available,
        created_at: product.created_at,
      })
    )
  )
}

export async function cacheCounterPromos(promos: CounterPromo[]) {
  await db.transaction("rw", [db.promos, db.promoProducts], async () => {
    await db.promos.clear()
    await db.promoProducts.clear()

    if (promos.length === 0) {
      return
    }

    await db.promos.bulkPut(
      promos.map<LocalPromo>((promo) => ({
        id: promo.id,
        name: promo.name,
        promo_type: promo.promoType,
        starts_on: promo.startsOn,
        ends_on: promo.endsOn,
        criteria: promo.criteria,
        benefit: promo.benefit,
        requires_admin_approval: promo.requiresAdminApproval,
        is_active: promo.isActive,
        created_at: promo.createdAt ?? new Date().toISOString(),
        updated_at: promo.updatedAt ?? new Date().toISOString(),
      }))
    )

    const promoProducts = promos.flatMap<LocalPromoProduct>((promo) =>
      promo.products.map((product) => ({
        promo_id: promo.id,
        product_id: product.productId,
        role: product.role,
        created_at: promo.updatedAt ?? new Date().toISOString(),
      }))
    )

    if (promoProducts.length > 0) {
      await db.promoProducts.bulkPut(promoProducts)
    }
  })
}

export async function primeLocalShiftInventory(
  schedule: SharedBoothSchedule,
  inventoryProducts: Product[],
  availableProducts: Product[]
) {
  await cacheAvailableProducts([...inventoryProducts, ...availableProducts])
  const preserveLocalStock = await hasPendingOperations(schedule.id)

  await db.transaction(
    "rw",
    [
      db.booths,
      db.boothSchedules,
      db.boothScheduleAssignments,
      db.boothScheduleOperatorPeriods,
      db.boothScheduleProducts,
    ],
    async () => {
      await db.booths.put(schedule.booths)
      await db.boothSchedules.put({
        id: schedule.id,
        booth_id: schedule.booth_id,
        operator_employee_id: schedule.operator_employee_id,
        date: schedule.date,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        status: schedule.status,
        created_at: schedule.created_at,
      })
      await db.boothScheduleAssignments.bulkPut(
        schedule.booth_schedule_assignments
      )
      await db.boothScheduleOperatorPeriods.bulkPut(
        schedule.booth_schedule_operator_periods
      )

      if (inventoryProducts.length === 0 || preserveLocalStock) {
        return
      }

      const existingRows = await db.boothScheduleProducts
        .where("schedule_id")
        .equals(schedule.id)
        .count()
      if (existingRows > 0) {
        return
      }

      await db.boothScheduleProducts.bulkPut(
        inventoryProducts.map((product) => ({
          id: createClientId(),
          schedule_id: schedule.id,
          product_id: product.id,
          quantity: product.quantity ?? 0,
          stock: product.stock ?? 0,
          created_at: new Date().toISOString(),
        }))
      )
    }
  )
}

async function cacheShiftSummaries(shifts: ActiveShiftRow[]) {
  await db.transaction(
    "rw",
    [
      db.boothSchedules,
      db.booths,
      db.boothScheduleAssignments,
      db.boothScheduleOperatorPeriods,
    ],
    async () => {
      for (const shift of shifts) {
        await db.booths.put(shift.booths)
        await db.boothSchedules.put({
          id: shift.id,
          booth_id: shift.booth_id,
          operator_employee_id: shift.operator_employee_id,
          date: shift.date,
          start_time: shift.start_time,
          end_time: shift.end_time,
          status: shift.status,
          created_at: shift.created_at,
        })
        await db.boothScheduleAssignments.bulkPut(
          shift.booth_schedule_assignments
        )
        await db.boothScheduleOperatorPeriods.bulkPut(
          shift.booth_schedule_operator_periods
        )
      }
    }
  )
}

async function cacheActiveShiftWorkspace({
  activeShift,
  scheduleProducts,
  products,
  sales,
  salePayments,
  saleItems,
}: ActiveShiftWorkspacePayload) {
  const pendingScheduleOperations = await hasPendingOperations(activeShift.id)
  const pendingSales = await db.sales
    .where("schedule_id")
    .equals(activeShift.id)
    .filter((sale) => isInFlightSyncState(sale.sync_state))
    .toArray()
  const protectedSaleIds = new Set(pendingSales.map((sale) => sale.id))
  const cachedSales = sales
    .filter((sale) => !protectedSaleIds.has(sale.id))
    .map<LocalSale>((sale) => ({
      id: sale.id,
      booth_id: sale.booth_id,
      employee_id: sale.employee_id,
      schedule_id: sale.schedule_id,
      total_amount: Number(sale.total_amount),
      payment_method: sale.payment_method,
      promo_id: sale.promo_id,
      promo_name: sale.promo_name,
      promo_type: sale.promo_type,
      promo_discount_total: Number(sale.promo_discount_total ?? 0),
      promo_approval_id: sale.promo_approval_id,
      receipt_photo_local: null,
      receipt_photo_path: sale.receipt_photo_path,
      status: sale.status,
      sync_state: "synced",
      sync_error: null,
      sync_attempt_count: 0,
      sync_failure_kind: null,
      sync_next_retry_at: null,
      created_at: sale.created_at,
      updated_at: sale.updated_at,
    }))
  const remoteSaleIds = cachedSales.map((sale) => sale.id)
  const cachedSaleItems = saleItems
    .filter(
      (item) => item.sale_id !== null && remoteSaleIds.includes(item.sale_id)
    )
    .map<LocalSaleItem>((item) => ({
      id: item.id,
      sale_id: item.sale_id,
      product_id: item.product_id,
      quantity: item.quantity,
      base_unit_price: Number(item.base_unit_price),
      discount_amount: Number(item.discount_amount),
      unit_price: Number(item.unit_price),
      subtotal: Number(item.subtotal),
      stock_before: null,
    }))
  const cachedSalePayments = salePayments.map<LocalSalePayment>((payment) => ({
    id: payment.id,
    sale_id: payment.sale_id,
    payment_method: normalizePaymentMethod(payment.payment_method),
    amount: Number(payment.amount),
    receipt_photo_local: null,
    receipt_photo_path: payment.receipt_photo_path,
    created_at: payment.created_at,
  }))

  await db.transaction(
    "rw",
    [
      db.products,
      db.booths,
      db.boothSchedules,
      db.boothScheduleAssignments,
      db.boothScheduleOperatorPeriods,
      db.boothScheduleProducts,
      db.sales,
      db.salePayments,
      db.saleItems,
    ],
    async () => {
      await db.booths.put(activeShift.booths)
      await db.boothSchedules.put({
        id: activeShift.id,
        booth_id: activeShift.booth_id,
        operator_employee_id: activeShift.operator_employee_id,
        date: activeShift.date,
        start_time: activeShift.start_time,
        end_time: activeShift.end_time,
        status: activeShift.status,
        created_at: activeShift.created_at,
      })
      await db.boothScheduleAssignments.bulkPut(
        activeShift.booth_schedule_assignments
      )
      await db.boothScheduleOperatorPeriods.bulkPut(
        activeShift.booth_schedule_operator_periods
      )
      await db.products.bulkPut(products.map(productToLocalProduct))

      if (!pendingScheduleOperations) {
        await db.boothScheduleProducts
          .where("schedule_id")
          .equals(activeShift.id)
          .delete()
        if (scheduleProducts.length > 0) {
          await db.boothScheduleProducts.bulkPut(
            scheduleProducts.map((item) => ({
              id: item.id,
              schedule_id: item.schedule_id,
              product_id: item.product_id,
              quantity: item.quantity,
              stock: item.stock,
              created_at: item.created_at,
            }))
          )
        }
      }

      const existingSales = await db.sales
        .where("schedule_id")
        .equals(activeShift.id)
        .toArray()
      const replaceableSaleIds = existingSales
        .filter(
          (sale) =>
            sale.sync_state === "synced" && !protectedSaleIds.has(sale.id)
        )
        .map((sale) => sale.id)
      const saleIdsToClear = Array.from(
        new Set([...replaceableSaleIds, ...remoteSaleIds])
      )

      if (saleIdsToClear.length > 0) {
        await db.salePayments.where("sale_id").anyOf(saleIdsToClear).delete()
        await db.saleItems.where("sale_id").anyOf(saleIdsToClear).delete()
      }
      if (replaceableSaleIds.length > 0) {
        await db.sales.bulkDelete(replaceableSaleIds)
      }
      if (cachedSales.length > 0) {
        await db.sales.bulkPut(cachedSales)
      }
      if (cachedSalePayments.length > 0) {
        await db.salePayments.bulkPut(cachedSalePayments)
      }
      if (cachedSaleItems.length > 0) {
        await db.saleItems.bulkPut(cachedSaleItems)
      }
    }
  )
}

export async function refreshActiveShiftWorkspace(employeeId: string) {
  const supabase = createClient()
  const currentDate = getBusinessDate()
  const currentTime = getBusinessTime()

  const { data: shifts, error: shiftError } = await supabase
    .from("booth_schedules")
    .select(
      "*, booths(*), booth_schedule_assignments!inner(*), booth_schedule_operator_periods(*), booth_schedule_products(id)"
    )
    .eq("booth_schedule_assignments.employee_id", employeeId)
    .eq("date", currentDate)

  if (shiftError) throw shiftError

  const todaysShifts = (shifts ?? []) as ActiveShiftRow[]
  const activeShift =
    todaysShifts.find(
      (shift) =>
        shift.status === "scheduled" &&
        shift.end_time > currentTime &&
        (shift.start_time <= currentTime ||
          (shift.booth_schedule_products?.length ?? 0) > 0 ||
          hasStartedOperatorPeriod(shift.booth_schedule_operator_periods))
    ) ?? null

  await cacheShiftSummaries(todaysShifts)

  if (!activeShift) {
    return null
  }

  const [scheduleProductsResult, productsResult, salesResult] =
    await Promise.all([
      supabase
        .from("booth_schedule_products")
        .select("*")
        .eq("schedule_id", activeShift.id),
      supabase.from("products").select("*"),
      supabase
        .from("sales")
        .select("*")
        .eq("schedule_id", activeShift.id)
        .order("created_at", { ascending: false }),
    ])

  if (scheduleProductsResult.error) throw scheduleProductsResult.error
  if (productsResult.error) throw productsResult.error
  if (salesResult.error) throw salesResult.error

  const shiftProducts = (scheduleProductsResult.data ??
    []) as LocalBoothScheduleProduct[]
  const sales = (salesResult.data ??
    []) as Database["public"]["Tables"]["sales"]["Row"][]
  const saleIds = sales.map((sale) => sale.id)
  const [saleItemsResult, salePaymentsResult] = await Promise.all([
    saleIds.length > 0
      ? supabase.from("sale_items").select("*").in("sale_id", saleIds)
      : Promise.resolve({ data: [], error: null }),
    saleIds.length > 0
      ? supabase
          .from("sale_payments")
          .select("*")
          .in("sale_id", saleIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ])

  if (saleItemsResult.error) throw saleItemsResult.error
  if (salePaymentsResult.error) throw salePaymentsResult.error

  await cacheActiveShiftWorkspace({
    activeShift,
    scheduleProducts: shiftProducts,
    products: (productsResult.data ??
      []) as Database["public"]["Tables"]["products"]["Row"][],
    sales,
    salePayments: (salePaymentsResult.data ??
      []) as Database["public"]["Tables"]["sale_payments"]["Row"][],
    saleItems: (saleItemsResult.data ??
      []) as Database["public"]["Tables"]["sale_items"]["Row"][],
  })

  return activeShift
}

/**
 * Refreshes the currently active schedule and its products without replacing
 * locally in-flight inventory or sales operations.
 */
export async function syncActiveShiftProducts(employeeId: string) {
  return refreshActiveShiftWorkspace(employeeId)
}

async function pruneOfflineCache(
  fromDate: string,
  toDate: string,
  fromIso: string,
  protectedScheduleIds: Set<string>
) {
  const [olderSchedules, futureSchedules, oldSales, oldEvents] =
    await Promise.all([
      db.boothSchedules.where("date").below(fromDate).toArray(),
      db.boothSchedules.where("date").above(toDate).toArray(),
      db.sales
        .where("created_at")
        .below(fromIso)
        .filter((sale) => sale.sync_state === "synced")
        .toArray(),
      db.inventoryEvents
        .where("occurred_at")
        .below(fromIso)
        .filter((event) => event.sync_state === "synced")
        .toArray(),
    ])

  const removableScheduleIds = Array.from(
    new Set(
      [...olderSchedules, ...futureSchedules].map((schedule) => schedule.id)
    )
  ).filter((scheduleId) => !protectedScheduleIds.has(scheduleId))
  const removableScheduleSet = new Set(removableScheduleIds)
  const removableSales = oldSales.filter(
    (sale) =>
      !sale.schedule_id ||
      !protectedScheduleIds.has(sale.schedule_id) ||
      removableScheduleSet.has(sale.schedule_id)
  )
  const removableEvents = oldEvents.filter(
    (event) =>
      !event.schedule_id ||
      !protectedScheduleIds.has(event.schedule_id) ||
      removableScheduleSet.has(event.schedule_id)
  )
  const saleIds = removableSales.map((sale) => sale.id)
  const eventIds = removableEvents.map((event) => event.id)

  await db.transaction(
    "rw",
    [
      db.boothSchedules,
      db.boothScheduleAssignments,
      db.boothScheduleOperatorPeriods,
      db.boothScheduleProducts,
      db.sales,
      db.salePayments,
      db.saleItems,
      db.inventoryEvents,
      db.inventoryEventLines,
    ],
    async () => {
      if (saleIds.length > 0) {
        await db.salePayments.where("sale_id").anyOf(saleIds).delete()
        await db.saleItems.where("sale_id").anyOf(saleIds).delete()
        await db.sales.bulkDelete(saleIds)
      }

      if (eventIds.length > 0) {
        await db.inventoryEventLines.where("event_id").anyOf(eventIds).delete()
        await db.inventoryEvents.bulkDelete(eventIds)
      }

      if (removableScheduleIds.length > 0) {
        await Promise.all([
          db.boothScheduleAssignments
            .where("schedule_id")
            .anyOf(removableScheduleIds)
            .delete(),
          db.boothScheduleOperatorPeriods
            .where("schedule_id")
            .anyOf(removableScheduleIds)
            .delete(),
          db.boothScheduleProducts
            .where("schedule_id")
            .anyOf(removableScheduleIds)
            .delete(),
        ])
        await db.boothSchedules.bulkDelete(removableScheduleIds)
      }
    }
  )
}

/**
 * Warms offline employee data, including all sellable products needed to
 * initialize an upcoming shift after connectivity is lost.
 */
export async function bootstrapEmployeeOfflineData(
  employeeId: string,
  onProgress?: SyncProgressCallback
) {
  const report = onProgress ?? (() => {})
  const supabase = createClient()
  const fromDate = shiftDateByDays(-OFFLINE_HISTORY_DAYS).slice(0, 10)
  const toDate = shiftDateByDays(OFFLINE_FUTURE_DAYS).slice(0, 10)
  const fromIso = shiftDateByDays(-OFFLINE_HISTORY_DAYS)
  const toIso = shiftDateByDays(1)

  report(1, 5, "Syncing employee profile and schedules...")

  const [employeeResult, schedulesResult, productsResult] = await Promise.all([
    supabase.from("employees").select("*").eq("id", employeeId).maybeSingle(),
    supabase
      .from("booth_schedules")
      .select(
        "*, booths(*), booth_schedule_assignments!inner(*), booth_schedule_operator_periods(*)"
      )
      .eq("booth_schedule_assignments.employee_id", employeeId)
      .gte("date", fromDate)
      .lte("date", toDate)
      .order("date", { ascending: false })
      .order("start_time", { ascending: false }),
    supabase.from("products").select("*").eq("is_available", true),
  ])

  if (employeeResult.error) throw employeeResult.error
  if (schedulesResult.error) throw schedulesResult.error
  if (productsResult.error) throw productsResult.error

  const employee = employeeResult.data as LocalEmployee | null
  const schedules = (schedulesResult.data ?? []) as (LocalBoothSchedule & {
    booths: LocalBooth
    booth_schedule_assignments: LocalBoothScheduleAssignment[]
    booth_schedule_operator_periods: LocalBoothScheduleOperatorPeriod[]
  })[]
  const scheduleIds = schedules.map((schedule) => schedule.id)
  const salesResult =
    scheduleIds.length > 0
      ? await supabase
          .from("sales")
          .select("*")
          .in("schedule_id", scheduleIds)
          .gte("created_at", fromIso)
          .lte("created_at", toIso)
          .order("created_at", { ascending: false })
      : { data: [], error: null }

  if (salesResult.error) throw salesResult.error

  const sales = (salesResult.data ??
    []) as Database["public"]["Tables"]["sales"]["Row"][]
  const saleIds = sales.map((sale) => sale.id)

  report(2, 5, "Syncing booth inventory...")

  const [
    scheduleProductsResult,
    saleItemsResult,
    salePaymentsResult,
    inventoryEventsResult,
  ] = await Promise.all([
    scheduleIds.length > 0
      ? supabase
          .from("booth_schedule_products")
          .select("*")
          .in("schedule_id", scheduleIds)
      : Promise.resolve({ data: [], error: null }),
    saleIds.length > 0
      ? supabase.from("sale_items").select("*").in("sale_id", saleIds)
      : Promise.resolve({ data: [], error: null }),
    saleIds.length > 0
      ? supabase
          .from("sale_payments")
          .select("*")
          .in("sale_id", saleIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    scheduleIds.length > 0
      ? supabase
          .from("inventory_events")
          .select("*")
          .in("schedule_id", scheduleIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (scheduleProductsResult.error) throw scheduleProductsResult.error
  if (saleItemsResult.error) throw saleItemsResult.error
  if (salePaymentsResult.error) throw salePaymentsResult.error
  if (inventoryEventsResult.error) throw inventoryEventsResult.error

  const scheduleProducts = (scheduleProductsResult.data ??
    []) as LocalBoothScheduleProduct[]
  const saleItems = (saleItemsResult.data ??
    []) as Database["public"]["Tables"]["sale_items"]["Row"][]
  const inventoryEvents = (inventoryEventsResult.data ??
    []) as Database["public"]["Tables"]["inventory_events"]["Row"][]
  const inventoryEventIds = inventoryEvents.map((event) => event.id)
  const inventoryLinesResult =
    inventoryEventIds.length > 0
      ? await supabase
          .from("inventory_event_lines")
          .select("*")
          .in("event_id", inventoryEventIds)
      : { data: [], error: null }

  if (inventoryLinesResult.error) throw inventoryLinesResult.error

  report(3, 5, "Processing products...")

  const booths = Array.from(
    new Map(
      schedules
        .map((schedule) => schedule.booths)
        .filter((booth): booth is LocalBooth => Boolean(booth))
        .map((booth) => [booth.id, booth])
    ).values()
  )
  const cachedSchedules: LocalBoothSchedule[] = schedules.map((schedule) => ({
    id: schedule.id,
    booth_id: schedule.booth_id,
    operator_employee_id: schedule.operator_employee_id,
    date: schedule.date,
    start_time: schedule.start_time,
    end_time: schedule.end_time,
    status: schedule.status,
    created_at: schedule.created_at,
  }))
  const cachedAssignments = schedules.flatMap(
    (schedule) => schedule.booth_schedule_assignments
  )
  const cachedOperatorPeriods = schedules.flatMap(
    (schedule) => schedule.booth_schedule_operator_periods
  )
  const cachedScheduleProducts = scheduleProducts.map((item) => ({
    id: item.id,
    schedule_id: item.schedule_id,
    product_id: item.product_id,
    quantity: item.quantity,
    stock: item.stock,
    created_at: item.created_at,
  }))
  const cachedProducts = (productsResult.data ?? []).map(productToLocalProduct)
  const cachedSales = sales.map<LocalSale>((sale) => ({
    id: sale.id,
    booth_id: sale.booth_id,
    employee_id: sale.employee_id,
    schedule_id: sale.schedule_id,
    total_amount: Number(sale.total_amount),
    payment_method: sale.payment_method,
    promo_id: sale.promo_id,
    promo_name: sale.promo_name,
    promo_type: sale.promo_type,
    promo_discount_total: Number(sale.promo_discount_total ?? 0),
    promo_approval_id: sale.promo_approval_id,
    receipt_photo_local: null,
    receipt_photo_path: sale.receipt_photo_path,
    status: sale.status,
    sync_state: "synced",
    sync_error: null,
    sync_attempt_count: 0,
    sync_failure_kind: null,
    sync_next_retry_at: null,
    created_at: sale.created_at,
    updated_at: sale.updated_at,
  }))
  const cachedSalePayments = (
    salePaymentsResult.data ?? []
  ).map<LocalSalePayment>((payment) => ({
    id: payment.id,
    sale_id: payment.sale_id,
    payment_method: normalizePaymentMethod(payment.payment_method),
    amount: Number(payment.amount),
    receipt_photo_local: null,
    receipt_photo_path: payment.receipt_photo_path,
    created_at: payment.created_at,
  }))
  const cachedSaleItems = saleItems.map<LocalSaleItem>((item) => ({
    id: item.id,
    sale_id: item.sale_id,
    product_id: item.product_id,
    quantity: item.quantity,
    base_unit_price: Number(item.base_unit_price),
    discount_amount: Number(item.discount_amount),
    unit_price: Number(item.unit_price),
    subtotal: Number(item.subtotal),
    stock_before: null,
  }))
  const cachedInventoryEvents = inventoryEvents.map<LocalInventoryEvent>(
    (event) => ({
      ...event,
      event_type: normalizeInventoryEventType(event.event_type),
      sync_state: "synced",
      sync_error: null,
      sync_attempt_count: 0,
      sync_failure_kind: null,
      sync_next_retry_at: null,
    })
  )
  const cachedInventoryLines = (inventoryLinesResult.data ??
    []) as LocalInventoryEventLine[]
  const [localPendingEvents, localPendingSales] = await Promise.all([
    db.inventoryEvents
      .where("sync_state")
      .anyOf(IN_FLIGHT_SYNC_STATES)
      .toArray(),
    db.sales.where("sync_state").anyOf(IN_FLIGHT_SYNC_STATES).toArray(),
  ])
  const protectedScheduleIds = new Set(
    [
      ...localPendingEvents.map((event) => event.schedule_id),
      ...localPendingSales.map((sale) => sale.schedule_id),
    ].filter((scheduleId): scheduleId is string => Boolean(scheduleId))
  )

  report(4, 5, "Saving to local database...")

  await db.transaction(
    "rw",
    [
      db.employees,
      db.booths,
      db.boothSchedules,
      db.boothScheduleAssignments,
      db.boothScheduleOperatorPeriods,
      db.boothScheduleProducts,
      db.products,
      db.sales,
      db.salePayments,
      db.saleItems,
      db.inventoryEvents,
      db.inventoryEventLines,
    ],
    async () => {
      if (employee) await db.employees.put(employee)
      if (booths.length > 0) await db.booths.bulkPut(booths)
      if (cachedSchedules.length > 0) {
        await db.boothSchedules.bulkPut(cachedSchedules)
      }
      if (cachedAssignments.length > 0) {
        await db.boothScheduleAssignments.bulkPut(cachedAssignments)
      }
      if (cachedOperatorPeriods.length > 0) {
        await db.boothScheduleOperatorPeriods.bulkPut(cachedOperatorPeriods)
      }
      if (cachedProducts.length > 0) await db.products.bulkPut(cachedProducts)
      if (cachedSales.length > 0) await db.sales.bulkPut(cachedSales)
      if (cachedSalePayments.length > 0) {
        await db.salePayments.bulkPut(cachedSalePayments)
      }
      if (cachedSaleItems.length > 0)
        await db.saleItems.bulkPut(cachedSaleItems)
      if (cachedInventoryEvents.length > 0) {
        await db.inventoryEvents.bulkPut(cachedInventoryEvents)
      }
      if (cachedInventoryLines.length > 0) {
        await db.inventoryEventLines.bulkPut(cachedInventoryLines)
      }

      for (const scheduleId of scheduleIds) {
        if (protectedScheduleIds.has(scheduleId)) {
          continue
        }

        await db.boothScheduleProducts
          .where("schedule_id")
          .equals(scheduleId)
          .delete()
      }

      const replaceableRows = cachedScheduleProducts.filter(
        (item) => !protectedScheduleIds.has(item.schedule_id)
      )
      if (replaceableRows.length > 0) {
        await db.boothScheduleProducts.bulkPut(replaceableRows)
      }
    }
  )

  await pruneOfflineCache(fromDate, toDate, fromIso, protectedScheduleIds)

  report(5, 5, "Offline data ready!")

  return {
    scheduleCount: cachedSchedules.length,
    saleCount: cachedSales.length,
    saleItemCount: cachedSaleItems.length,
  }
}

export function bootstrapEmployeeOfflineDataIfStale(
  employeeId: string,
  onProgress?: SyncProgressCallback,
  force = false
): Promise<OfflineBootstrapResult> {
  if (!force && isEmployeeOfflineBootstrapFresh(employeeId)) {
    return Promise.resolve({
      scheduleCount: 0,
      saleCount: 0,
      saleItemCount: 0,
      skipped: true,
    })
  }

  const existing = activeBootstraps.get(employeeId)
  if (existing) {
    return existing
  }

  const bootstrap = bootstrapEmployeeOfflineData(employeeId, onProgress)
    .then((result) => {
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            getOfflineBootstrapStorageKey(employeeId),
            String(Date.now())
          )
        } catch {
          // Storage can be unavailable in hardened/private browser contexts.
        }
      }
      return result
    })
    .finally(() => {
      activeBootstraps.delete(employeeId)
    })

  activeBootstraps.set(employeeId, bootstrap)
  return bootstrap
}

export async function syncEmployeeProfile(employeeId: string) {
  const supabase = createClient()
  const { data: employee, error } = await supabase
    .from("employees")
    .select("*")
    .eq("id", employeeId)
    .maybeSingle()

  if (error) throw error
  if (!employee) return null

  await db.employees.put(employee as LocalEmployee)
  return employee as LocalEmployee
}

export async function saveInventoryEventLocally(
  data: InventoryEventPayload
): Promise<LocalInventoryEvent> {
  const occurredAt = new Date().toISOString()
  const event: LocalInventoryEvent = {
    id: createClientId(),
    schedule_id: data.scheduleId,
    actor_employee_id: data.employeeId,
    event_type: data.eventType,
    reason: data.reason?.trim() || null,
    occurred_at: occurredAt,
    created_at: occurredAt,
    sync_state: "pending",
    sync_error: null,
    sync_attempt_count: 0,
    sync_failure_kind: null,
    sync_next_retry_at: null,
  }
  const availableProductMap = new Map(
    data.products
      .filter((product) => product.is_available !== false)
      .map((product) => [product.id, product])
  )

  if (
    data.lines.length === 0 ||
    new Set(data.lines.map((line) => line.productId)).size !== data.lines.length
  ) {
    throw new Error("Select at least one product with a valid quantity.")
  }

  await cacheAvailableProducts(data.products)

  await db.transaction(
    "rw",
    [
      db.inventoryEvents,
      db.inventoryEventLines,
      db.boothScheduleProducts,
      db.boothSchedules,
      db.booths,
      db.boothScheduleAssignments,
      db.boothScheduleOperatorPeriods,
    ],
    async () => {
      if (data.schedule) {
        await db.booths.put(data.schedule.booths)
        await db.boothSchedules.put({
          id: data.schedule.id,
          booth_id: data.schedule.booth_id,
          operator_employee_id: data.schedule.operator_employee_id,
          date: data.schedule.date,
          start_time: data.schedule.start_time,
          end_time: data.schedule.end_time,
          status: data.schedule.status,
          created_at: data.schedule.created_at,
        })
        await db.boothScheduleAssignments.bulkPut(
          data.schedule.booth_schedule_assignments
        )
        await db.boothScheduleOperatorPeriods.bulkPut(
          data.schedule.booth_schedule_operator_periods
        )
      }

      let currentRows = await db.boothScheduleProducts
        .where("schedule_id")
        .equals(data.scheduleId)
        .toArray()

      if (
        data.eventType === "adjustment" &&
        currentRows.length === 0 &&
        data.currentInventory &&
        data.currentInventory.length > 0
      ) {
        currentRows = data.currentInventory.map((product) => ({
          id: createClientId(),
          schedule_id: data.scheduleId,
          product_id: product.id,
          quantity: product.quantity ?? 0,
          stock: product.stock ?? 0,
          created_at: occurredAt,
        }))
        await db.boothScheduleProducts.bulkPut(currentRows)
      }

      const currentMap = new Map(
        currentRows.map((row) => [row.product_id, row])
      )

      if (data.eventType === "opening" && currentRows.length > 0) {
        throw new Error("Opening inventory has already been recorded.")
      }
      if (data.eventType === "adjustment" && currentRows.length === 0) {
        throw new Error("Record opening inventory before adjusting stock.")
      }

      const lines: LocalInventoryEventLine[] = []
      for (const line of data.lines) {
        const current = currentMap.get(line.productId)
        const product = availableProductMap.get(line.productId)
        if (
          (!product &&
            !(data.eventType === "adjustment" && current !== undefined)) ||
          !Number.isInteger(line.resultingStock) ||
          line.resultingStock < 0
        ) {
          throw new Error("Enter valid quantities for available products.")
        }

        const previousStock = current?.stock ?? 0
        if (data.eventType === "opening" && line.resultingStock <= 0) {
          throw new Error("Opening quantities must be positive whole numbers.")
        }
        if (
          data.eventType === "adjustment" &&
          previousStock === line.resultingStock
        ) {
          continue
        }
        if (
          data.eventType === "adjustment" &&
          !current &&
          line.resultingStock <= 0
        ) {
          continue
        }

        const nextRow: LocalBoothScheduleProduct = current
          ? { ...current, stock: line.resultingStock }
          : {
              id: createClientId(),
              schedule_id: data.scheduleId,
              product_id: line.productId,
              quantity: data.eventType === "opening" ? line.resultingStock : 0,
              stock: line.resultingStock,
              created_at: occurredAt,
            }
        await db.boothScheduleProducts.put(nextRow)
        lines.push({
          id: createClientId(),
          event_id: event.id,
          product_id: line.productId,
          previous_stock: previousStock,
          resulting_stock: line.resultingStock,
          delta: line.resultingStock - previousStock,
        })
      }

      if (lines.length === 0) {
        throw new Error("Change at least one stock quantity.")
      }

      await db.inventoryEvents.put(event)
      await db.inventoryEventLines.bulkPut(lines)
    }
  )

  return event
}

export async function pushInventoryEventToSupabase(
  eventId: string
): Promise<SyncAttemptResult> {
  const event = await db.inventoryEvents.get(eventId)
  if (!event || event.sync_state === "synced") {
    return { synced: true }
  }

  const lines = await db.inventoryEventLines
    .where("event_id")
    .equals(eventId)
    .toArray()

  try {
    await db.inventoryEvents.update(eventId, {
      sync_state: "syncing",
      sync_error: null,
      sync_failure_kind: null,
      sync_next_retry_at: null,
    })

    const supabase = createClient()
    const rpcArgs = {
      p_event_id: event.id,
      p_schedule_id: event.schedule_id,
      p_event_type: event.event_type as "opening" | "adjustment",
      p_reason: event.reason,
      p_occurred_at: event.occurred_at,
      p_lines: lines.map((line) => ({
        product_id: line.product_id,
        previous_stock: line.previous_stock,
        resulting_stock: line.resulting_stock,
      })) satisfies Json,
    } as unknown as Database["public"]["Functions"]["record_shift_inventory_event"]["Args"]
    const { error } = await supabase.rpc(
      "record_shift_inventory_event",
      rpcArgs
    )

    if (error) throw error

    await db.inventoryEvents.update(eventId, {
      sync_state: "synced",
      sync_error: null,
      sync_attempt_count: 0,
      sync_failure_kind: null,
      sync_next_retry_at: null,
    })
    return { synced: true }
  } catch (error) {
    const syncFailure = getSyncError(error)
    const attemptCount = (event.sync_attempt_count ?? 0) + 1

    await db.inventoryEvents.update(eventId, {
      sync_state: "failed",
      sync_error: syncFailure.message,
      sync_attempt_count: attemptCount,
      sync_failure_kind: syncFailure.kind,
      sync_next_retry_at:
        syncFailure.kind === "transient" ? getNextRetryAt(attemptCount) : null,
    })
    return {
      synced: false,
      isConflict: syncFailure.isConflict,
      kind: syncFailure.kind,
      message: syncFailure.message,
    }
  }
}

export type LocalSalePayload = {
  id: string
  boothId: string
  employeeId: string
  scheduleId: string
  totalAmount: number
  paymentMethod: PaymentMethod
  payments: {
    id?: string
    paymentMethod: PaymentMethod
    amount: number
    receiptPhotoLocal?: string | null
  }[]
  promoId?: string | null
  promoName?: string | null
  promoType?: string | null
  promoDiscountTotal?: number
  promoApprovalId?: string | null
  items: {
    productId: string
    quantity: number
    price: number
    basePrice: number
    discountAmount: number
  }[]
}

function validateLocalSalePayments(
  payments: LocalSalePayload["payments"],
  totalAmount: number
) {
  if (payments.length === 0) {
    throw new Error("At least one payment is required.")
  }

  const hasInvalidAmounts = payments.some(
    (payment) =>
      !Number.isFinite(payment.amount) || roundCurrency(payment.amount) <= 0
  )

  if (hasInvalidAmounts) {
    throw new Error("Each payment must be greater than zero.")
  }

  const paymentTotal = roundCurrency(
    payments.reduce((sum, payment) => sum + roundCurrency(payment.amount), 0)
  )

  if (Math.abs(paymentTotal - roundCurrency(totalAmount)) >= 0.01) {
    throw new Error("Payment amounts must match the sale total.")
  }

  const missingReceipt = payments.some(
    (payment) =>
      payment.paymentMethod !== "cash" &&
      (!payment.receiptPhotoLocal ||
        payment.receiptPhotoLocal.trim().length === 0)
  )

  if (missingReceipt) {
    throw new Error("Each non-cash payment needs its own receipt photo.")
  }
}

export async function saveSaleLocally(
  data: LocalSalePayload
): Promise<LocalSale> {
  validateLocalSalePayments(data.payments, data.totalAmount)

  const now = new Date().toISOString()
  const summaryReceiptPhotoLocal =
    data.payments.find((payment) => payment.paymentMethod !== "cash")
      ?.receiptPhotoLocal ?? null
  const sale: LocalSale = {
    id: data.id,
    booth_id: data.boothId,
    employee_id: data.employeeId,
    schedule_id: data.scheduleId,
    total_amount: data.totalAmount,
    payment_method: data.paymentMethod,
    promo_id: data.promoId ?? null,
    promo_name: data.promoName ?? null,
    promo_type: data.promoType ?? null,
    promo_discount_total: data.promoDiscountTotal ?? 0,
    promo_approval_id: data.promoApprovalId ?? null,
    receipt_photo_local: summaryReceiptPhotoLocal,
    receipt_photo_path: null,
    status: "completed",
    sync_state: "pending",
    sync_error: null,
    sync_attempt_count: 0,
    sync_failure_kind: null,
    sync_next_retry_at: null,
    created_at: now,
    updated_at: now,
  }
  const salePayments: LocalSalePayment[] = data.payments.map((payment) => ({
    id: payment.id ?? createClientId(),
    sale_id: data.id,
    payment_method: payment.paymentMethod,
    amount: roundCurrency(payment.amount),
    receipt_photo_local:
      payment.paymentMethod === "cash"
        ? null
        : (payment.receiptPhotoLocal ?? null),
    receipt_photo_path: null,
    created_at: now,
  }))

  await db.transaction(
    "rw",
    [db.sales, db.saleItems, db.salePayments, db.boothScheduleProducts],
    async () => {
      const saleItems: LocalSaleItem[] = []

      for (const item of data.items) {
        const scheduleProduct = await db.boothScheduleProducts
          .where("[schedule_id+product_id]")
          .equals([data.scheduleId, item.productId])
          .first()

        if (!scheduleProduct || scheduleProduct.stock < item.quantity) {
          throw new Error("Inventory changed. Review available stock.")
        }

        saleItems.push({
          id: createClientId(),
          sale_id: data.id,
          product_id: item.productId,
          quantity: item.quantity,
          base_unit_price: item.basePrice,
          discount_amount: item.discountAmount,
          unit_price: item.price,
          subtotal: item.price * item.quantity,
          stock_before: scheduleProduct.stock,
        })
        await db.boothScheduleProducts.update(scheduleProduct.id, {
          stock: scheduleProduct.stock - item.quantity,
        })
      }

      await db.sales.put(sale)
      await db.saleItems.bulkPut(saleItems)
      await db.salePayments.bulkPut(salePayments)
    }
  )

  return sale
}

export async function replaceLocalSaleReceiptPhoto(
  saleId: string,
  receiptPhotoDataUrl: string
) {
  if (!saleId.trim()) {
    throw new Error("Sale record is missing.")
  }

  if (!receiptPhotoDataUrl.trim()) {
    throw new Error("Receipt photo is required.")
  }

  const sale = await db.sales.get(saleId)

  if (!sale) {
    throw new Error("This sale is no longer available on this device.")
  }

  if (sale.payment_method === "cash") {
    throw new Error("Cash sales do not have receipt photos.")
  }

  if (sale.sync_state === "synced") {
    throw new Error("Reconnect to update synced receipt photos.")
  }

  const schedule = await db.boothSchedules.get(sale.schedule_id)

  if (!schedule || schedule.status !== "scheduled") {
    throw new Error(
      "Receipt photos can be changed only while the shift is open."
    )
  }

  const shouldResetSyncState =
    sale.sync_state !== "failed" || sale.sync_failure_kind !== "conflict"

  await db.sales.update(saleId, {
    receipt_photo_local: receiptPhotoDataUrl,
    ...(shouldResetSyncState
      ? {
          sync_state: "pending",
          sync_error: null,
          sync_attempt_count: 0,
          sync_failure_kind: null,
          sync_next_retry_at: null,
        }
      : {}),
  })
}

export async function pushSaleToSupabase(
  saleId: string
): Promise<SyncAttemptResult> {
  const sale = await db.sales.get(saleId)
  if (!sale || sale.sync_state === "synced") {
    return { synced: true }
  }

  const [items, storedPayments] = await Promise.all([
    db.saleItems.where("sale_id").equals(saleId).toArray(),
    db.salePayments.where("sale_id").equals(saleId).sortBy("created_at"),
  ])

  try {
    await db.sales.update(saleId, {
      sync_state: "syncing",
      sync_error: null,
      sync_failure_kind: null,
      sync_next_retry_at: null,
    })

    const localPayments =
      storedPayments.length > 0
        ? storedPayments
        : [
            {
              id: sale.id,
              sale_id: sale.id,
              payment_method: normalizePaymentMethod(sale.payment_method),
              amount: roundCurrency(sale.total_amount),
              receipt_photo_local: sale.receipt_photo_local,
              receipt_photo_path: sale.receipt_photo_path,
              created_at: sale.created_at ?? new Date().toISOString(),
            } satisfies LocalSalePayment,
          ]
    const syncedPayments: LocalSalePayment[] = []
    const receiptPathsToCleanup: string[] = []

    for (const payment of localPayments) {
      let receiptPhotoPath =
        payment.payment_method === "cash" ? null : payment.receipt_photo_path
      const previousReceiptPhotoPath = payment.receipt_photo_path

      if (payment.payment_method !== "cash" && payment.receipt_photo_local) {
        const uploadResult = await uploadReceiptPhotoForSale(
          sale.id,
          payment.receipt_photo_local,
          payment.id
        )

        if (!uploadResult.ok || !uploadResult.receiptPhotoPath) {
          console.error("Receipt photo upload failed for sale sync.", {
            saleId: sale.id,
            scheduleId: sale.schedule_id,
            employeeId: sale.employee_id,
            paymentId: payment.id,
            error: uploadResult.error ?? "Missing receipt photo path.",
          })
          throw new Error(
            uploadResult.error ??
              "RECEIPT_PHOTO_UPLOAD_FAILED: Missing receipt photo path."
          )
        }

        receiptPhotoPath = uploadResult.receiptPhotoPath

        await db.salePayments.update(payment.id, {
          receipt_photo_path: receiptPhotoPath,
          receipt_photo_local: null,
        })
      }

      if (payment.payment_method !== "cash" && !receiptPhotoPath) {
        throw new Error(
          "A receipt photo is required before syncing a non-cash sale."
        )
      }

      if (
        payment.receipt_photo_local &&
        previousReceiptPhotoPath &&
        previousReceiptPhotoPath !== receiptPhotoPath
      ) {
        receiptPathsToCleanup.push(previousReceiptPhotoPath)
      }

      syncedPayments.push({
        ...payment,
        receipt_photo_path: receiptPhotoPath,
        receipt_photo_local: null,
      })
    }

    const summaryPaymentMethod: PaymentMethod =
      syncedPayments.length === 1
        ? normalizePaymentMethod(syncedPayments[0].payment_method)
        : "other"
    const receiptPhotoPath =
      syncedPayments.find((payment) => payment.payment_method !== "cash")
        ?.receipt_photo_path ?? null

    const aggregatedItems = Array.from(
      items
        .reduce(
          (map, item) => {
            if (!item.product_id) {
              return map
            }

            const existing = map.get(item.product_id)
            if (existing) {
              existing.quantity += item.quantity
            } else {
              map.set(item.product_id, {
                productId: item.product_id,
                quantity: item.quantity,
                expectedStock: item.stock_before ?? 0,
                baseUnitPrice: item.base_unit_price,
              })
            }
            return map
          },
          new Map<
            string,
            {
              productId: string
              quantity: number
              expectedStock: number
              baseUnitPrice: number
            }
          >()
        )
        .values()
    )

    if (
      !sale.booth_id ||
      !sale.schedule_id ||
      !sale.employee_id ||
      !sale.created_at
    ) {
      throw new Error("The queued sale is missing required shift details.")
    }

    const finalizeResult = await finalizePosSale({
      saleId: sale.id,
      boothId: sale.booth_id,
      scheduleId: sale.schedule_id,
      paymentMethod: summaryPaymentMethod,
      receiptPhotoPath,
      createdAt: sale.created_at,
      items: aggregatedItems,
      payments: syncedPayments.map((payment) => ({
        id: payment.id,
        paymentMethod: normalizePaymentMethod(payment.payment_method),
        amount: payment.amount,
        receiptPhotoPath:
          payment.payment_method === "cash" ? null : payment.receipt_photo_path,
      })),
      promoId: sale.promo_id ?? null,
      promoApprovalId: sale.promo_approval_id ?? null,
    })

    if (!finalizeResult.ok) {
      throw new Error(finalizeResult.error ?? "Unable to finalize the sale.")
    }

    await db.transaction("rw", [db.sales, db.salePayments], async () => {
      await db.sales.update(saleId, {
        payment_method: summaryPaymentMethod,
        sync_state: "synced",
        sync_error: null,
        sync_attempt_count: 0,
        sync_failure_kind: null,
        sync_next_retry_at: null,
        receipt_photo_path: receiptPhotoPath,
        receipt_photo_local: null,
      })

      await db.salePayments.bulkPut(
        syncedPayments.map((payment) => ({
          ...payment,
          receipt_photo_local: null,
        }))
      )
    })

    for (const previousReceiptPhotoPath of receiptPathsToCleanup) {
      const cleanupResult = await deleteReceiptPhoto(previousReceiptPhotoPath)

      if (!cleanupResult.ok) {
        console.warn("Unable to clean up replaced receipt photo after sync:", {
          saleId,
          previousReceiptPhotoPath,
          receiptPhotoPath,
          error: cleanupResult.error,
        })
      }
    }

    return { synced: true }
  } catch (error) {
    const syncFailure = getSyncError(error)
    const attemptCount = (sale.sync_attempt_count ?? 0) + 1

    await db.sales.update(saleId, {
      sync_state: "failed",
      sync_error: syncFailure.message,
      sync_attempt_count: attemptCount,
      sync_failure_kind: syncFailure.kind,
      sync_next_retry_at:
        syncFailure.kind === "transient" ? getNextRetryAt(attemptCount) : null,
    })
    return {
      synced: false,
      isConflict: syncFailure.isConflict,
      kind: syncFailure.kind,
      message: syncFailure.message,
    }
  }
}

async function rollbackStagedSale(saleId: string, cleanupReceiptPhoto = false) {
  const sale = await db.sales.get(saleId)
  if (!sale) {
    return
  }

  const [saleItems, salePayments] = await Promise.all([
    db.saleItems.where("sale_id").equals(saleId).toArray(),
    db.salePayments.where("sale_id").equals(saleId).toArray(),
  ])

  await db.transaction(
    "rw",
    [db.sales, db.saleItems, db.salePayments, db.boothScheduleProducts],
    async () => {
      for (const item of saleItems) {
        if (
          item.stock_before === null ||
          !sale.schedule_id ||
          !item.product_id
        ) {
          continue
        }

        const scheduleProduct = await db.boothScheduleProducts
          .where("[schedule_id+product_id]")
          .equals([sale.schedule_id, item.product_id])
          .first()

        if (!scheduleProduct) {
          continue
        }

        await db.boothScheduleProducts.update(scheduleProduct.id, {
          stock: item.stock_before,
        })
      }

      if (saleItems.length > 0) {
        await db.saleItems.where("sale_id").equals(saleId).delete()
      }
      if (salePayments.length > 0) {
        await db.salePayments.where("sale_id").equals(saleId).delete()
      }
      await db.sales.delete(saleId)
    }
  )

  if (cleanupReceiptPhoto) {
    const receiptPaths = Array.from(
      new Set(
        [
          sale.receipt_photo_path,
          ...salePayments.map((payment) => payment.receipt_photo_path),
        ].filter((value): value is string => Boolean(value))
      )
    )

    for (const receiptPath of receiptPaths) {
      const result = await deleteReceiptPhoto(receiptPath)

      if (!result.ok) {
        console.warn(
          "Unable to clean up receipt photo for rolled-back sale:",
          result.error
        )
      }
    }
  }
}

export async function cancelFailedLocalSale(saleId: string) {
  const sale = await db.sales.get(saleId)

  if (!sale) {
    throw new Error("This failed sale is no longer available.")
  }

  if (sale.sync_state !== "failed") {
    throw new Error("Only failed local sales can be cancelled.")
  }

  if (
    sale.sync_failure_kind !== "conflict" &&
    sale.sync_failure_kind !== "permanent"
  ) {
    throw new Error(
      "This failed sale is still retryable and cannot be cancelled."
    )
  }

  await rollbackStagedSale(saleId, true)
}

export async function saveSaleOnlineConfirmed(data: LocalSalePayload) {
  await saveSaleLocally(data)

  const syncResult = await pushSaleToSupabase(data.id)
  if (!syncResult.synced) {
    await rollbackStagedSale(data.id, true)
    throw new Error(syncResult.message)
  }

  try {
    await refreshActiveShiftWorkspace(data.employeeId)
  } catch (error) {
    console.warn("Sale synced, but active shift refresh failed:", error)
  }
}

type PendingSyncOptions = {
  manual?: boolean
}

function shouldAttemptFailedOperation(
  operation: Pick<
    LocalSale | LocalInventoryEvent,
    "sync_state" | "sync_failure_kind" | "sync_next_retry_at"
  >,
  manual: boolean,
  now: string
) {
  if (operation.sync_state !== "failed") {
    return true
  }

  if (manual) {
    return true
  }

  return (
    operation.sync_failure_kind === "transient" &&
    (!operation.sync_next_retry_at || operation.sync_next_retry_at <= now)
  )
}

async function performPendingPosSync(
  options: PendingSyncOptions = {}
): Promise<PosSyncResult> {
  const manual = options.manual === true
  const now = new Date().toISOString()
  const [allEvents, allSales] = await Promise.all([
    db.inventoryEvents
      .where("sync_state")
      .anyOf(["pending", "failed", "syncing"] satisfies LocalSyncState[])
      .toArray(),
    db.sales
      .where("sync_state")
      .anyOf(["pending", "failed", "syncing"] satisfies LocalSyncState[])
      .toArray(),
  ])
  const operations = [
    ...allEvents.map((event) => ({
      id: event.id,
      scheduleId: event.schedule_id ?? "",
      at: event.occurred_at ?? "",
      type: "inventory" as const,
      eligible: shouldAttemptFailedOperation(event, manual, now),
    })),
    ...allSales.map((sale) => ({
      id: sale.id,
      scheduleId: sale.schedule_id ?? "",
      at: sale.created_at ?? "",
      type: "sale" as const,
      eligible: shouldAttemptFailedOperation(sale, manual, now),
    })),
  ].sort(
    (left, right) =>
      left.at.localeCompare(right.at) || (left.type === "inventory" ? -1 : 1)
  )

  const result: PosSyncResult = {
    inventory: 0,
    sales: 0,
    conflicts: 0,
    failed: 0,
  }
  const blockedSchedules = new Set<string>()

  for (const operation of operations) {
    if (blockedSchedules.has(operation.scheduleId)) {
      continue
    }

    if (!operation.eligible) {
      blockedSchedules.add(operation.scheduleId)
      continue
    }

    const synced =
      operation.type === "inventory"
        ? await pushInventoryEventToSupabase(operation.id)
        : await pushSaleToSupabase(operation.id)

    if (!synced.synced) {
      blockedSchedules.add(operation.scheduleId)
      if (synced.isConflict) {
        result.conflicts += 1
      } else {
        result.failed += 1
      }
      continue
    }

    if (operation.type === "inventory") {
      result.inventory += 1
    } else {
      result.sales += 1
    }
  }

  return result
}

export function syncPendingPosOperations(
  options: PendingSyncOptions = {}
): Promise<PosSyncResult> {
  if (activeSync) {
    return activeSync
  }

  activeSync = performPendingPosSync(options).finally(() => {
    activeSync = null
  })
  return activeSync
}
