import { createServerSupabaseClient } from "@/lib/supabase-server"
import type { Database } from "@/lib/database.types"
import type { PaymentMethod, ScheduleStatus } from "@/lib/domain-types"
import {
  formatCurrency,
  getBoothDisplayName,
  getBusinessDate,
  getEmployeeDisplayName,
  getProductDisplayName,
} from "@/lib/utils"

type BoothRow = Pick<
  Database["public"]["Tables"]["booths"]["Row"],
  "id" | "name" | "is_active"
>

type ScheduleRow = Pick<
  Database["public"]["Tables"]["booth_schedules"]["Row"],
  | "id"
  | "booth_id"
  | "status"
  | "date"
  | "start_time"
  | "end_time"
  | "operator_employee_id"
>

type SelectedSaleRow = Pick<
  Database["public"]["Tables"]["sales"]["Row"],
  | "id"
  | "booth_id"
  | "employee_id"
  | "payment_method"
  | "receipt_photo_path"
  | "schedule_id"
  | "status"
  | "total_amount"
  | "created_at"
> & {
  booths: Pick<Database["public"]["Tables"]["booths"]["Row"], "name"> | null
  employees: Pick<
    Database["public"]["Tables"]["employees"]["Row"],
    "name"
  > | null
  booth_schedules: Pick<
    Database["public"]["Tables"]["booth_schedules"]["Row"],
    "status"
  > | null
}

type SaleItemRow = Pick<
  Database["public"]["Tables"]["sale_items"]["Row"],
  "sale_id" | "product_id" | "quantity" | "subtotal"
> & {
  products: Pick<Database["public"]["Tables"]["products"]["Row"], "name"> | null
}

type ShiftCloseoutRow = Pick<
  Database["public"]["Tables"]["shift_closeouts"]["Row"],
  "id" | "schedule_id" | "cash_variance" | "stock_variance" | "closed_at"
>

type ShiftApprovalRow = Pick<
  Database["public"]["Tables"]["shift_action_approvals"]["Row"],
  "id" | "schedule_id" | "action_type" | "status" | "payload" | "created_at"
>

type BoothScheduleProductRow = Pick<
  Database["public"]["Tables"]["booth_schedule_products"]["Row"],
  "schedule_id" | "product_id" | "quantity" | "stock"
> & {
  products: Pick<Database["public"]["Tables"]["products"]["Row"], "name"> | null
}

export type DashboardDateRange = {
  startDate: string
  endDate: string
  label: string
  dayCount: number
}

export type DashboardSummary = {
  totalRevenue: number
  saleCount: number
  cashRevenue: number
  nonCashRevenue: number
  openShiftCount: number
  closedShiftCount: number
  cancelledShiftCount: number
  averageTicket: number
  sellingBoothCount: number
  unitsSold: number
  receiptRequiredCount: number
  receiptAttachedCount: number
  receiptMissingCount: number
  receiptComplianceRate: number
  pendingApprovalCount: number
  pendingRevenueIncrease: number
  pendingRevenueDecrease: number
  approvedCashDeductionTotal: number
  pendingCashDeductionTotal: number
  closeoutCount: number
  totalCashVariance: number
  totalStockVariance: number
  lowStockLineCount: number
}

export type DashboardPaymentBreakdown = {
  method: PaymentMethod
  count: number
  total: number
  share: number
}

export type DashboardBoothCard = {
  boothId: string
  boothName: string
  isActive: boolean
  totalRevenue: number
  saleCount: number
  cashRevenue: number
  nonCashRevenue: number
  openShiftCount: number
  closedShiftCount: number
  cancelledShiftCount: number
  averageTicket: number
  unitsSold: number
  receiptMissingCount: number
  cashVariance: number
  stockVariance: number
}

export type DashboardTrendPoint = {
  date: string
  revenue: number
  transactions: number
  cashRevenue: number
  nonCashRevenue: number
  unitsSold: number
}

export type DashboardBoothDaySale = {
  date: string
  boothId: string
  boothName: string
  saleCount: number
  totalRevenue: number
  cashRevenue: number
  nonCashRevenue: number
  unitsSold: number
  averageTicket: number
}

export type DashboardTopProduct = {
  productId: string
  productName: string
  quantitySold: number
  revenue: number
  shareOfRevenue: number
}

export type DashboardEmployeeCard = {
  employeeId: string
  employeeName: string
  totalRevenue: number
  saleCount: number
  averageTicket: number
  unitsSold: number
}

export type DashboardInventoryInsight = {
  productId: string
  productName: string
  openingStock: number
  remainingStock: number
  unitsSold: number
  lowStockLineCount: number
}

export type DashboardCloseoutInsight = {
  closeoutCount: number
  totalCashVariance: number
  totalStockVariance: number
  cashVarianceLabel: string
  stockVarianceLabel: string
}

export type DashboardRecentTransaction = {
  id: string
  createdAt: string
  boothName: string
  employeeName: string
  paymentMethod: PaymentMethod
  totalAmount: number
  hasReceipt: boolean
  receiptPhotoPath: string | null
  canEditReceipt: boolean
  status: string
}

export type AdminDashboardData = {
  dateRange: DashboardDateRange
  isLiveRange: boolean
  summary: DashboardSummary
  paymentBreakdown: DashboardPaymentBreakdown[]
  boothCards: DashboardBoothCard[]
  trendSeries: DashboardTrendPoint[]
  boothDaySales: DashboardBoothDaySale[]
  topProducts: DashboardTopProduct[]
  employeeCards: DashboardEmployeeCard[]
  inventoryInsights: DashboardInventoryInsight[]
  closeoutInsight: DashboardCloseoutInsight
  recentTransactions: DashboardRecentTransaction[]
}

const BUSINESS_TIME_ZONE = "Asia/Manila"

const businessDayFormatter = new Intl.DateTimeFormat("en", {
  day: "2-digit",
  month: "2-digit",
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
})

const sameDayRangeFormatter = new Intl.DateTimeFormat("en-PH", {
  day: "numeric",
  month: "short",
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
})

const rangeStartFormatter = new Intl.DateTimeFormat("en-PH", {
  day: "numeric",
  month: "short",
  timeZone: BUSINESS_TIME_ZONE,
})

const rangeEndFormatter = new Intl.DateTimeFormat("en-PH", {
  day: "numeric",
  month: "short",
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
})

const yearFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
})

const paymentMethods: PaymentMethod[] = [
  "cash",
  "gcash",
  "maya",
  "maribank",
  "unionbank",
  "other",
]

function normalizePaymentMethod(
  value: string | null | undefined
): PaymentMethod {
  return paymentMethods.includes(value as PaymentMethod)
    ? (value as PaymentMethod)
    : "cash"
}

function normalizeScheduleStatus(
  value: string | null | undefined
): ScheduleStatus {
  if (value === "closed" || value === "cancelled") {
    return value
  }

  return "scheduled"
}

function isValidDateString(value: string | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

function addBusinessDays(date: string, offset: number) {
  const [year, month, day] = date.split("-").map(Number)
  const nextDate = new Date(Date.UTC(year, month - 1, day))
  nextDate.setUTCDate(nextDate.getUTCDate() + offset)

  const nextYear = nextDate.getUTCFullYear()
  const nextMonth = String(nextDate.getUTCMonth() + 1).padStart(2, "0")
  const nextDay = String(nextDate.getUTCDate()).padStart(2, "0")

  return `${nextYear}-${nextMonth}-${nextDay}`
}

function getBusinessRange(startDate: string, endDate: string) {
  return {
    startIso: `${startDate}T00:00:00+08:00`,
    endIso: `${addBusinessDays(endDate, 1)}T00:00:00+08:00`,
  }
}

function getBusinessDayKey(value: string | null | undefined) {
  if (!value) {
    return ""
  }

  const parts = businessDayFormatter.formatToParts(new Date(value))
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value

  return `${year}-${month}-${day}`
}

function getInclusiveDateKeys(startDate: string, endDate: string) {
  const dates: string[] = []
  let currentDate = startDate

  while (currentDate <= endDate) {
    dates.push(currentDate)
    currentDate = addBusinessDays(currentDate, 1)
  }

  return dates
}

function dateLabelToDate(value: string) {
  return new Date(`${value}T12:00:00+08:00`)
}

function formatDashboardRangeLabel(startDate: string, endDate: string) {
  const start = dateLabelToDate(startDate)
  const end = dateLabelToDate(endDate)

  if (startDate === endDate) {
    return sameDayRangeFormatter.format(start)
  }

  const startYear = yearFormatter.format(start)
  const endYear = yearFormatter.format(end)

  if (startYear === endYear) {
    return `${rangeStartFormatter.format(start)} - ${rangeEndFormatter.format(end)}`
  }

  return `${rangeEndFormatter.format(start)} - ${rangeEndFormatter.format(end)}`
}

function normalizeDashboardDateRange(params?: {
  date?: string
  startDate?: string
  endDate?: string
}): DashboardDateRange {
  const today = getBusinessDate()

  let startDate = params?.startDate
  let endDate = params?.endDate

  if (!startDate && !endDate && isValidDateString(params?.date)) {
    startDate = params?.date
    endDate = params?.date
  }

  if (!isValidDateString(startDate) && !isValidDateString(endDate)) {
    startDate = today
    endDate = today
  } else {
    if (!isValidDateString(startDate)) {
      startDate = endDate
    }

    if (!isValidDateString(endDate)) {
      endDate = startDate
    }
  }

  if (startDate! > endDate!) {
    ;[startDate, endDate] = [endDate!, startDate!]
  }

  const dayCount = getInclusiveDateKeys(startDate!, endDate!).length

  return {
    startDate: startDate!,
    endDate: endDate!,
    label: formatDashboardRangeLabel(startDate!, endDate!),
    dayCount,
  }
}

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return value
  }

  return Number(value ?? 0)
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getPayloadNumber(payload: unknown, key: string) {
  if (!isObjectRecord(payload)) {
    return null
  }

  const value = payload[key]

  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function formatSignedCurrency(value: number) {
  if (value > 0) {
    return `+${formatCurrency(value)}`
  }

  if (value < 0) {
    return `-${formatCurrency(Math.abs(value))}`
  }

  return formatCurrency(0)
}

function formatSignedNumber(value: number) {
  if (value > 0) {
    return `+${value}`
  }

  return value.toString()
}

function emptySummary(): DashboardSummary {
  return {
    totalRevenue: 0,
    saleCount: 0,
    cashRevenue: 0,
    nonCashRevenue: 0,
    openShiftCount: 0,
    closedShiftCount: 0,
    cancelledShiftCount: 0,
    averageTicket: 0,
    sellingBoothCount: 0,
    unitsSold: 0,
    receiptRequiredCount: 0,
    receiptAttachedCount: 0,
    receiptMissingCount: 0,
    receiptComplianceRate: 0,
    pendingApprovalCount: 0,
    pendingRevenueIncrease: 0,
    pendingRevenueDecrease: 0,
    approvedCashDeductionTotal: 0,
    pendingCashDeductionTotal: 0,
    closeoutCount: 0,
    totalCashVariance: 0,
    totalStockVariance: 0,
    lowStockLineCount: 0,
  }
}

function incrementScheduleCount(
  summary: Pick<
    DashboardSummary | DashboardBoothCard,
    "openShiftCount" | "closedShiftCount" | "cancelledShiftCount"
  >,
  status: ScheduleStatus
) {
  if (status === "scheduled") {
    summary.openShiftCount += 1
    return
  }

  if (status === "closed") {
    summary.closedShiftCount += 1
    return
  }

  summary.cancelledShiftCount += 1
}

function buildBoothCards(booths: BoothRow[]) {
  const boothCards = booths.map<DashboardBoothCard>((booth) => ({
    boothId: booth.id,
    boothName: booth.name,
    isActive: Boolean(booth.is_active),
    totalRevenue: 0,
    saleCount: 0,
    cashRevenue: 0,
    nonCashRevenue: 0,
    openShiftCount: 0,
    closedShiftCount: 0,
    cancelledShiftCount: 0,
    averageTicket: 0,
    unitsSold: 0,
    receiptMissingCount: 0,
    cashVariance: 0,
    stockVariance: 0,
  }))

  return {
    boothCards,
    boothCardMap: new Map(boothCards.map((card) => [card.boothId, card])),
  }
}

function buildPaymentMap() {
  return new Map<PaymentMethod, DashboardPaymentBreakdown>(
    paymentMethods.map((method) => [
      method,
      {
        method,
        count: 0,
        total: 0,
        share: 0,
      },
    ])
  )
}

function buildTrendMap(dateRange: DashboardDateRange) {
  return new Map(
    getInclusiveDateKeys(dateRange.startDate, dateRange.endDate).map((date) => [
      date,
      {
        date,
        revenue: 0,
        transactions: 0,
        cashRevenue: 0,
        nonCashRevenue: 0,
        unitsSold: 0,
      } satisfies DashboardTrendPoint,
    ])
  )
}

function buildRecentTransactions(sales: SelectedSaleRow[]) {
  return sales
    .map<DashboardRecentTransaction>((sale) => ({
      id: sale.id,
      createdAt: sale.created_at ?? "",
      boothName: getBoothDisplayName(sale.booths),
      employeeName: getEmployeeDisplayName(sale.employees),
      paymentMethod: normalizePaymentMethod(sale.payment_method),
      totalAmount: toNumber(sale.total_amount),
      hasReceipt: Boolean(sale.receipt_photo_path),
      receiptPhotoPath: sale.receipt_photo_path,
      canEditReceipt:
        normalizePaymentMethod(sale.payment_method) !== "cash" &&
        Boolean(sale.receipt_photo_path) &&
        normalizeScheduleStatus(sale.booth_schedules?.status) === "scheduled",
      status: sale.status ?? "completed",
    }))
    .sort((left, right) => {
      if (left.createdAt === right.createdAt) {
        return right.id.localeCompare(left.id)
      }

      return right.createdAt.localeCompare(left.createdAt)
    })
    .slice(0, 50)
}

function createEmployeeCard(employeeId: string, employeeName: string) {
  return {
    employeeId,
    employeeName,
    totalRevenue: 0,
    saleCount: 0,
    averageTicket: 0,
    unitsSold: 0,
  } satisfies DashboardEmployeeCard
}

function createInventoryInsight(productId: string, productName: string) {
  return {
    productId,
    productName,
    openingStock: 0,
    remainingStock: 0,
    unitsSold: 0,
    lowStockLineCount: 0,
  } satisfies DashboardInventoryInsight
}

function createBoothDaySale(
  date: string,
  boothId: string,
  boothName: string
): DashboardBoothDaySale {
  return {
    date,
    boothId,
    boothName,
    saleCount: 0,
    totalRevenue: 0,
    cashRevenue: 0,
    nonCashRevenue: 0,
    unitsSold: 0,
    averageTicket: 0,
  }
}

export async function getAdminDashboardData(params?: {
  date?: string
  startDate?: string
  endDate?: string
}) {
  const dateRange = normalizeDashboardDateRange(params)
  const today = getBusinessDate()
  const isLiveRange = dateRange.startDate <= today && dateRange.endDate >= today
  const { startIso, endIso } = getBusinessRange(
    dateRange.startDate,
    dateRange.endDate
  )

  const supabase = await createServerSupabaseClient()
  const [boothsResult, schedulesResult, salesResult] = await Promise.all([
    supabase.from("booths").select("id, name, is_active").order("name"),
    supabase
      .from("booth_schedules")
      .select(
        "id, booth_id, status, date, start_time, end_time, operator_employee_id"
      )
      .gte("date", dateRange.startDate)
      .lte("date", dateRange.endDate),
    supabase
      .from("sales")
      .select(
        "id, booth_id, employee_id, payment_method, receipt_photo_path, schedule_id, status, total_amount, created_at, booths(name), employees(name), booth_schedules(status)"
      )
      .eq("status", "completed")
      .gte("created_at", startIso)
      .lt("created_at", endIso),
  ])

  if (boothsResult.error) {
    throw new Error(boothsResult.error.message)
  }

  if (schedulesResult.error) {
    throw new Error(schedulesResult.error.message)
  }

  if (salesResult.error) {
    throw new Error(salesResult.error.message)
  }

  const booths = (boothsResult.data ?? []) as BoothRow[]
  const schedules = (schedulesResult.data ?? []) as ScheduleRow[]
  const sales = (salesResult.data ?? []) as SelectedSaleRow[]

  const saleIds = sales.map((sale) => sale.id)
  const scheduleIds = schedules.map((schedule) => schedule.id)

  const [
    saleItemsResult,
    shiftCloseoutsResult,
    shiftApprovalsResult,
    boothScheduleProductsResult,
  ] = await Promise.all([
    saleIds.length
      ? supabase
          .from("sale_items")
          .select("sale_id, product_id, quantity, subtotal, products(name)")
          .in("sale_id", saleIds)
      : Promise.resolve({ data: [], error: null }),
    scheduleIds.length
      ? supabase
          .from("shift_closeouts")
          .select("id, schedule_id, cash_variance, stock_variance, closed_at")
          .in("schedule_id", scheduleIds)
      : Promise.resolve({ data: [], error: null }),
    scheduleIds.length
      ? supabase
          .from("shift_action_approvals")
          .select("id, schedule_id, action_type, status, payload, created_at")
          .in("schedule_id", scheduleIds)
      : Promise.resolve({ data: [], error: null }),
    scheduleIds.length
      ? supabase
          .from("booth_schedule_products")
          .select("schedule_id, product_id, quantity, stock, products(name)")
          .in("schedule_id", scheduleIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (saleItemsResult.error) {
    throw new Error(saleItemsResult.error.message)
  }

  if (shiftCloseoutsResult.error) {
    throw new Error(shiftCloseoutsResult.error.message)
  }

  if (shiftApprovalsResult.error) {
    throw new Error(shiftApprovalsResult.error.message)
  }

  if (boothScheduleProductsResult.error) {
    throw new Error(boothScheduleProductsResult.error.message)
  }

  const saleItems = (saleItemsResult.data ?? []) as SaleItemRow[]
  const shiftCloseouts = (shiftCloseoutsResult.data ?? []) as ShiftCloseoutRow[]
  const shiftApprovals = (shiftApprovalsResult.data ?? []) as ShiftApprovalRow[]
  const boothScheduleProducts = (boothScheduleProductsResult.data ??
    []) as BoothScheduleProductRow[]

  const summary = emptySummary()
  const { boothCards, boothCardMap } = buildBoothCards(booths)
  const paymentMap = buildPaymentMap()
  const trendMap = buildTrendMap(dateRange)
  const topProductMap = new Map<string, DashboardTopProduct>()
  const employeeCardMap = new Map<string, DashboardEmployeeCard>()
  const inventoryInsightMap = new Map<string, DashboardInventoryInsight>()
  const boothDaySaleMap = new Map<string, DashboardBoothDaySale>()
  const sellingBoothIds = new Set<string>()
  const scheduleMap = new Map(
    schedules.map((schedule) => [schedule.id, schedule])
  )
  const saleMap = new Map(sales.map((sale) => [sale.id, sale]))

  for (const schedule of schedules) {
    const scheduleStatus = normalizeScheduleStatus(schedule.status)
    incrementScheduleCount(summary, scheduleStatus)

    if (!schedule.booth_id) {
      continue
    }

    const boothCard = boothCardMap.get(schedule.booth_id)
    if (boothCard) {
      incrementScheduleCount(boothCard, scheduleStatus)
    }
  }

  for (const sale of sales) {
    const amount = toNumber(sale.total_amount)
    const paymentMethod = normalizePaymentMethod(sale.payment_method)
    const isCash = paymentMethod === "cash"
    const boothCard = sale.booth_id
      ? boothCardMap.get(sale.booth_id)
      : undefined
    const saleDate = getBusinessDayKey(sale.created_at)
    const trendPoint = trendMap.get(saleDate)
    const employeeId = sale.employee_id ?? "unknown"
    const employeeName = getEmployeeDisplayName(sale.employees)
    const employeeCard =
      employeeCardMap.get(employeeId) ??
      createEmployeeCard(employeeId, employeeName)
    const boothName = getBoothDisplayName(sale.booths)
    const boothDaySaleKey =
      sale.booth_id && saleDate ? `${saleDate}:${sale.booth_id}` : null
    const boothDaySale =
      boothDaySaleKey && sale.booth_id
        ? (boothDaySaleMap.get(boothDaySaleKey) ??
          createBoothDaySale(saleDate, sale.booth_id, boothName))
        : null

    summary.totalRevenue += amount
    summary.saleCount += 1

    if (isCash) {
      summary.cashRevenue += amount
    } else {
      summary.nonCashRevenue += amount
      summary.receiptRequiredCount += 1

      if (sale.receipt_photo_path) {
        summary.receiptAttachedCount += 1
      } else {
        summary.receiptMissingCount += 1
      }
    }

    if (sale.booth_id) {
      sellingBoothIds.add(sale.booth_id)
    }

    if (boothCard) {
      boothCard.totalRevenue += amount
      boothCard.saleCount += 1

      if (isCash) {
        boothCard.cashRevenue += amount
      } else {
        boothCard.nonCashRevenue += amount

        if (!sale.receipt_photo_path) {
          boothCard.receiptMissingCount += 1
        }
      }
    }

    if (boothDaySale && boothDaySaleKey) {
      boothDaySale.totalRevenue += amount
      boothDaySale.saleCount += 1

      if (isCash) {
        boothDaySale.cashRevenue += amount
      } else {
        boothDaySale.nonCashRevenue += amount
      }

      boothDaySaleMap.set(boothDaySaleKey, boothDaySale)
    }

    const paymentEntry = paymentMap.get(paymentMethod)
    if (paymentEntry) {
      paymentEntry.count += 1
      paymentEntry.total += amount
    }

    employeeCard.totalRevenue += amount
    employeeCard.saleCount += 1
    employeeCardMap.set(employeeId, employeeCard)

    if (trendPoint) {
      trendPoint.revenue += amount
      trendPoint.transactions += 1

      if (isCash) {
        trendPoint.cashRevenue += amount
      } else {
        trendPoint.nonCashRevenue += amount
      }
    }
  }

  for (const item of saleItems) {
    if (!item.product_id) {
      continue
    }

    const revenue = toNumber(item.subtotal)
    const quantity = item.quantity
    const productName = getProductDisplayName(item.products)
    const topProduct =
      topProductMap.get(item.product_id) ??
      ({
        productId: item.product_id,
        productName,
        quantitySold: 0,
        revenue: 0,
        shareOfRevenue: 0,
      } satisfies DashboardTopProduct)

    topProduct.quantitySold += quantity
    topProduct.revenue += revenue
    topProductMap.set(item.product_id, topProduct)

    summary.unitsSold += quantity

    if (!item.sale_id) {
      continue
    }

    const sale = saleMap.get(item.sale_id)
    if (sale) {
      const employeeId = sale.employee_id ?? "unknown"
      const employeeCard = employeeCardMap.get(employeeId)
      if (employeeCard) {
        employeeCard.unitsSold += quantity
      }

      const boothCard = sale.booth_id
        ? boothCardMap.get(sale.booth_id)
        : undefined
      if (boothCard) {
        boothCard.unitsSold += quantity
      }

      const saleDate = getBusinessDayKey(sale.created_at)
      if (sale.booth_id && saleDate) {
        const boothDaySale = boothDaySaleMap.get(`${saleDate}:${sale.booth_id}`)
        if (boothDaySale) {
          boothDaySale.unitsSold += quantity
        }
      }

      const trendPoint = trendMap.get(saleDate)
      if (trendPoint) {
        trendPoint.unitsSold += quantity
      }
    }

    const inventoryInsight =
      inventoryInsightMap.get(item.product_id) ??
      createInventoryInsight(item.product_id, productName)

    inventoryInsight.unitsSold += quantity
    inventoryInsightMap.set(item.product_id, inventoryInsight)
  }

  for (const scheduleProduct of boothScheduleProducts) {
    if (!scheduleProduct.product_id) {
      continue
    }

    const inventoryInsight =
      inventoryInsightMap.get(scheduleProduct.product_id) ??
      createInventoryInsight(
        scheduleProduct.product_id,
        getProductDisplayName(scheduleProduct.products)
      )

    inventoryInsight.openingStock += toNumber(scheduleProduct.quantity)
    inventoryInsight.remainingStock += toNumber(scheduleProduct.stock)

    if (toNumber(scheduleProduct.stock) <= 5) {
      inventoryInsight.lowStockLineCount += 1
      summary.lowStockLineCount += 1
    }

    inventoryInsightMap.set(scheduleProduct.product_id, inventoryInsight)
  }

  for (const closeout of shiftCloseouts) {
    const cashVariance = toNumber(closeout.cash_variance)
    const stockVariance = toNumber(closeout.stock_variance)

    summary.closeoutCount += 1
    summary.totalCashVariance += cashVariance
    summary.totalStockVariance += stockVariance

    const schedule = closeout.schedule_id
      ? scheduleMap.get(closeout.schedule_id)
      : undefined
    const boothCard = schedule?.booth_id
      ? boothCardMap.get(schedule.booth_id)
      : undefined

    if (boothCard) {
      boothCard.cashVariance += cashVariance
      boothCard.stockVariance += stockVariance
    }
  }

  for (const approval of shiftApprovals) {
    const isPending = approval.status === "pending"

    if (isPending) {
      summary.pendingApprovalCount += 1
    }

    if (approval.action_type === "cash_deduction") {
      const amount = getPayloadNumber(approval.payload, "amount") ?? 0

      if (approval.status === "approved") {
        summary.approvedCashDeductionTotal += amount
      }

      if (isPending) {
        summary.pendingCashDeductionTotal += amount
      }
    }

    if (
      isPending &&
      ["edit_sale", "delete_sale", "apply_promo"].includes(
        approval.action_type ?? ""
      )
    ) {
      let revenueDelta = getPayloadNumber(approval.payload, "revenue_delta")

      if (revenueDelta === null && approval.action_type === "apply_promo") {
        const promoDiscount =
          getPayloadNumber(approval.payload, "promo_discount_total") ?? 0
        revenueDelta = -promoDiscount
      }

      if ((revenueDelta ?? 0) > 0) {
        summary.pendingRevenueIncrease += revenueDelta ?? 0
      } else if ((revenueDelta ?? 0) < 0) {
        summary.pendingRevenueDecrease += Math.abs(revenueDelta ?? 0)
      }
    }
  }

  summary.averageTicket =
    summary.saleCount > 0 ? summary.totalRevenue / summary.saleCount : 0
  summary.sellingBoothCount = sellingBoothIds.size
  summary.receiptComplianceRate =
    summary.receiptRequiredCount > 0
      ? (summary.receiptAttachedCount / summary.receiptRequiredCount) * 100
      : 100

  for (const paymentEntry of paymentMap.values()) {
    paymentEntry.share =
      summary.totalRevenue > 0
        ? (paymentEntry.total / summary.totalRevenue) * 100
        : 0
  }

  const boothCardList = boothCards
    .map((card) => ({
      ...card,
      averageTicket:
        card.saleCount > 0 ? card.totalRevenue / card.saleCount : 0,
    }))
    .sort((left, right) => {
      if (right.totalRevenue !== left.totalRevenue) {
        return right.totalRevenue - left.totalRevenue
      }

      return left.boothName.localeCompare(right.boothName)
    })

  const boothDaySales = Array.from(boothDaySaleMap.values())
    .map((entry) => ({
      ...entry,
      averageTicket:
        entry.saleCount > 0 ? entry.totalRevenue / entry.saleCount : 0,
    }))
    .sort((left, right) => {
      if (left.date !== right.date) {
        return right.date.localeCompare(left.date)
      }

      if (right.totalRevenue !== left.totalRevenue) {
        return right.totalRevenue - left.totalRevenue
      }

      return left.boothName.localeCompare(right.boothName)
    })

  const topProducts = Array.from(topProductMap.values())
    .map((product) => ({
      ...product,
      shareOfRevenue:
        summary.totalRevenue > 0 ? product.revenue / summary.totalRevenue : 0,
    }))
    .sort((left, right) => {
      if (right.revenue !== left.revenue) {
        return right.revenue - left.revenue
      }

      if (right.quantitySold !== left.quantitySold) {
        return right.quantitySold - left.quantitySold
      }

      return left.productName.localeCompare(right.productName)
    })
    .slice(0, 8)

  const employeeCards = Array.from(employeeCardMap.values())
    .map((card) => ({
      ...card,
      averageTicket:
        card.saleCount > 0 ? card.totalRevenue / card.saleCount : 0,
    }))
    .sort((left, right) => {
      if (right.totalRevenue !== left.totalRevenue) {
        return right.totalRevenue - left.totalRevenue
      }

      if (right.saleCount !== left.saleCount) {
        return right.saleCount - left.saleCount
      }

      return left.employeeName.localeCompare(right.employeeName)
    })
    .slice(0, 8)

  const inventoryInsights = Array.from(inventoryInsightMap.values())
    .sort((left, right) => {
      if (right.lowStockLineCount !== left.lowStockLineCount) {
        return right.lowStockLineCount - left.lowStockLineCount
      }

      if (right.unitsSold !== left.unitsSold) {
        return right.unitsSold - left.unitsSold
      }

      return left.productName.localeCompare(right.productName)
    })
    .slice(0, 8)

  const closeoutInsight = {
    closeoutCount: summary.closeoutCount,
    totalCashVariance: summary.totalCashVariance,
    totalStockVariance: summary.totalStockVariance,
    cashVarianceLabel: formatSignedCurrency(summary.totalCashVariance),
    stockVarianceLabel: formatSignedNumber(summary.totalStockVariance),
  } satisfies DashboardCloseoutInsight

  return {
    dateRange,
    isLiveRange,
    summary,
    paymentBreakdown: paymentMethods.map((method) => paymentMap.get(method)!),
    boothCards: boothCardList,
    trendSeries: Array.from(trendMap.values()),
    boothDaySales,
    topProducts,
    employeeCards,
    inventoryInsights,
    closeoutInsight,
    recentTransactions: buildRecentTransactions(sales),
  } satisfies AdminDashboardData
}
