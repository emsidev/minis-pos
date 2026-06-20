import { createServerSupabaseClient } from "@/lib/supabase-server"
import type {
  Database,
  Json,
  PaymentMethod,
  ScheduleStatus,
} from "@/lib/database.types"
import { getBusinessDate } from "@/lib/utils"

type BoothRow = Pick<
  Database["public"]["Tables"]["booths"]["Row"],
  "id" | "name" | "is_active"
>

type ScheduleRow = Pick<
  Database["public"]["Tables"]["booth_schedules"]["Row"],
  "id" | "booth_id" | "status"
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

type TrendSaleRow = Pick<
  Database["public"]["Tables"]["sales"]["Row"],
  "created_at" | "total_amount"
>

type SaleItemRow = Pick<
  Database["public"]["Tables"]["sale_items"]["Row"],
  "product_id" | "quantity" | "sale_id" | "subtotal"
> & {
  products: Pick<Database["public"]["Tables"]["products"]["Row"], "name"> | null
}

export type DashboardSummary = {
  totalRevenue: number
  saleCount: number
  cashRevenue: number
  nonCashRevenue: number
  openShiftCount: number
  closedShiftCount: number
  cancelledShiftCount: number
}

export type DashboardPaymentBreakdown = {
  method: PaymentMethod
  count: number
  total: number
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
}

export type DashboardTrendPoint = {
  date: string
  revenue: number
  transactions: number
}

export type DashboardTopProduct = {
  productId: string
  productName: string
  quantitySold: number
  revenue: number
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
  selectedDate: string
  isLiveDate: boolean
  summary: DashboardSummary
  paymentBreakdown: DashboardPaymentBreakdown[]
  boothCards: DashboardBoothCard[]
  trendSeries: DashboardTrendPoint[]
  topProducts: DashboardTopProduct[]
  recentTransactions: DashboardRecentTransaction[]
}

type DashboardRpcPayload = Omit<
  AdminDashboardData,
  "isLiveDate" | "selectedDate"
>

const BUSINESS_TIME_ZONE = "Asia/Manila"

const businessDayFormatter = new Intl.DateTimeFormat("en", {
  day: "2-digit",
  month: "2-digit",
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

function getBusinessDayRange(date: string) {
  return {
    startIso: `${date}T00:00:00+08:00`,
    endIso: `${addBusinessDays(date, 1)}T00:00:00+08:00`,
  }
}

function getBusinessDayKey(value: string) {
  const parts = businessDayFormatter.formatToParts(new Date(value))
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value

  return `${year}-${month}-${day}`
}

function getTrendDateKeys(selectedDate: string) {
  return Array.from({ length: 7 }, (_, index) =>
    addBusinessDays(selectedDate, index - 6)
  )
}

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return value
  }

  return Number(value ?? 0)
}

function isRecord(value: Json): value is Record<string, Json | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
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
  }
}

function incrementScheduleCount(
  summary: DashboardSummary,
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

function parseSummary(value: Json | undefined): DashboardSummary | null {
  if (!value || !isRecord(value)) {
    return null
  }

  return {
    totalRevenue: Number(value.totalRevenue ?? 0),
    saleCount: Number(value.saleCount ?? 0),
    cashRevenue: Number(value.cashRevenue ?? 0),
    nonCashRevenue: Number(value.nonCashRevenue ?? 0),
    openShiftCount: Number(value.openShiftCount ?? 0),
    closedShiftCount: Number(value.closedShiftCount ?? 0),
    cancelledShiftCount: Number(value.cancelledShiftCount ?? 0),
  }
}

function parsePaymentBreakdown(
  value: Json | undefined
): DashboardPaymentBreakdown[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.method !== "string") {
      return []
    }

    return [
      {
        method: entry.method as PaymentMethod,
        count: Number(entry.count ?? 0),
        total: Number(entry.total ?? 0),
      },
    ]
  })
}

function parseBoothCards(value: Json | undefined): DashboardBoothCard[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  return value.flatMap((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.boothId !== "string" ||
      typeof entry.boothName !== "string"
    ) {
      return []
    }

    return [
      {
        boothId: entry.boothId,
        boothName: entry.boothName,
        isActive: Boolean(entry.isActive),
        totalRevenue: Number(entry.totalRevenue ?? 0),
        saleCount: Number(entry.saleCount ?? 0),
        cashRevenue: Number(entry.cashRevenue ?? 0),
        nonCashRevenue: Number(entry.nonCashRevenue ?? 0),
        openShiftCount: Number(entry.openShiftCount ?? 0),
        closedShiftCount: Number(entry.closedShiftCount ?? 0),
        cancelledShiftCount: Number(entry.cancelledShiftCount ?? 0),
      },
    ]
  })
}

function parseTrendSeries(
  value: Json | undefined
): DashboardTrendPoint[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.date !== "string") {
      return []
    }

    return [
      {
        date: entry.date,
        revenue: Number(entry.revenue ?? 0),
        transactions: Number(entry.transactions ?? 0),
      },
    ]
  })
}

function parseTopProducts(
  value: Json | undefined
): DashboardTopProduct[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  return value.flatMap((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.productId !== "string" ||
      typeof entry.productName !== "string"
    ) {
      return []
    }

    return [
      {
        productId: entry.productId,
        productName: entry.productName,
        quantitySold: Number(entry.quantitySold ?? 0),
        revenue: Number(entry.revenue ?? 0),
      },
    ]
  })
}

function parseRecentTransactions(
  value: Json | undefined
): DashboardRecentTransaction[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const transactions: DashboardRecentTransaction[] = []

  for (const entry of value) {
    if (
      !isRecord(entry) ||
      typeof entry.id !== "string" ||
      typeof entry.createdAt !== "string" ||
      typeof entry.boothName !== "string" ||
      typeof entry.employeeName !== "string" ||
      typeof entry.paymentMethod !== "string" ||
      typeof entry.canEditReceipt !== "boolean" ||
      typeof entry.status !== "string"
    ) {
      return null
    }

    if (
      entry.receiptPhotoPath !== null &&
      typeof entry.receiptPhotoPath !== "string"
    ) {
      return null
    }

    transactions.push({
      id: entry.id,
      createdAt: entry.createdAt,
      boothName: entry.boothName,
      employeeName: entry.employeeName,
      paymentMethod: entry.paymentMethod as PaymentMethod,
      totalAmount: Number(entry.totalAmount ?? 0),
      hasReceipt: Boolean(entry.hasReceipt),
      receiptPhotoPath:
        typeof entry.receiptPhotoPath === "string"
          ? entry.receiptPhotoPath
          : null,
      canEditReceipt: entry.canEditReceipt,
      status: entry.status,
    })
  }

  return transactions
}

function normalizeDashboardRpcPayload(value: Json): DashboardRpcPayload | null {
  if (!isRecord(value)) {
    return null
  }

  const summary = parseSummary(value.summary)
  const paymentBreakdown = parsePaymentBreakdown(value.paymentBreakdown)
  const boothCards = parseBoothCards(value.boothCards)
  const trendSeries = parseTrendSeries(value.trendSeries)
  const topProducts = parseTopProducts(value.topProducts)
  const recentTransactions = parseRecentTransactions(value.recentTransactions)

  if (
    !summary ||
    !paymentBreakdown ||
    !boothCards ||
    !trendSeries ||
    !topProducts ||
    !recentTransactions
  ) {
    return null
  }

  return {
    summary,
    paymentBreakdown,
    boothCards,
    trendSeries,
    topProducts,
    recentTransactions,
  }
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
      },
    ])
  )
}

function buildTrendSeries(trendSales: TrendSaleRow[], selectedDate: string) {
  const trendMap = new Map(
    getTrendDateKeys(selectedDate).map((date) => [
      date,
      { date, revenue: 0, transactions: 0 },
    ])
  )

  for (const sale of trendSales) {
    const trendPoint = trendMap.get(getBusinessDayKey(sale.created_at))

    if (!trendPoint) {
      continue
    }

    trendPoint.revenue += toNumber(sale.total_amount)
    trendPoint.transactions += 1
  }

  return Array.from(trendMap.values())
}

function buildTopProducts(saleItems: SaleItemRow[]) {
  const topProductMap = new Map<string, DashboardTopProduct>()

  for (const item of saleItems) {
    const current = topProductMap.get(item.product_id)
    const revenue = toNumber(item.subtotal)
    const productName = item.products?.name ?? "Unknown Product"

    if (current) {
      current.quantitySold += item.quantity
      current.revenue += revenue
      continue
    }

    topProductMap.set(item.product_id, {
      productId: item.product_id,
      productName,
      quantitySold: item.quantity,
      revenue,
    })
  }

  return Array.from(topProductMap.values())
    .sort((left, right) => {
      if (right.revenue !== left.revenue) {
        return right.revenue - left.revenue
      }

      if (right.quantitySold !== left.quantitySold) {
        return right.quantitySold - left.quantitySold
      }

      return left.productName.localeCompare(right.productName)
    })
    .slice(0, 5)
}

function buildRecentTransactions(sales: SelectedSaleRow[]) {
  return sales
    .map<DashboardRecentTransaction>((sale) => ({
      id: sale.id,
      createdAt: sale.created_at,
      boothName: sale.booths?.name ?? "Unknown booth",
      employeeName: sale.employees?.name ?? "Unknown employee",
      paymentMethod: sale.payment_method,
      totalAmount: toNumber(sale.total_amount),
      hasReceipt: Boolean(sale.receipt_photo_path),
      receiptPhotoPath: sale.receipt_photo_path,
      canEditReceipt:
        sale.payment_method !== "cash" &&
        Boolean(sale.receipt_photo_path) &&
        sale.booth_schedules?.status === "scheduled",
      status: sale.status,
    }))
    .sort((left, right) => {
      if (left.createdAt === right.createdAt) {
        return right.id.localeCompare(left.id)
      }

      return right.createdAt.localeCompare(left.createdAt)
    })
}

export async function getAdminDashboardData(requestedDate?: string) {
  const selectedDate = isValidDateString(requestedDate)
    ? requestedDate!
    : getBusinessDate()
  const isLiveDate = selectedDate === getBusinessDate()
  const { startIso, endIso } = getBusinessDayRange(selectedDate)
  const trendStartIso = `${addBusinessDays(selectedDate, -6)}T00:00:00+08:00`

  const supabase = createServerSupabaseClient()
  const dashboardResult = await supabase.rpc("get_admin_dashboard", {
    p_date: selectedDate,
  })
  const dashboardPayload = dashboardResult.data
    ? normalizeDashboardRpcPayload(dashboardResult.data)
    : null

  if (!dashboardResult.error && dashboardPayload) {
    return {
      selectedDate,
      isLiveDate,
      ...dashboardPayload,
    } satisfies AdminDashboardData
  }

  if (
    dashboardResult.error &&
    !["42883", "PGRST202"].includes(dashboardResult.error.code ?? "")
  ) {
    throw new Error(dashboardResult.error.message)
  }

  const [boothsResult, schedulesResult, salesResult, trendSalesResult] =
    await Promise.all([
      supabase.from("booths").select("id, name, is_active").order("name"),
      supabase
        .from("booth_schedules")
        .select("id, booth_id, status")
        .eq("date", selectedDate),
      supabase
        .from("sales")
        .select(
          "id, booth_id, employee_id, payment_method, receipt_photo_path, schedule_id, status, total_amount, created_at, booths(name), employees(name), booth_schedules(status)"
        )
        .gte("created_at", startIso)
        .lt("created_at", endIso),
      supabase
        .from("sales")
        .select("created_at, total_amount")
        .gte("created_at", trendStartIso)
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

  if (trendSalesResult.error) {
    throw new Error(trendSalesResult.error.message)
  }

  const sales = (salesResult.data ?? []) as SelectedSaleRow[]
  const saleIds = sales.map((sale) => sale.id)
  const saleItemsResult = saleIds.length
    ? await supabase
        .from("sale_items")
        .select("sale_id, product_id, quantity, subtotal, products(name)")
        .in("sale_id", saleIds)
    : { data: [], error: null }

  if (saleItemsResult.error) {
    throw new Error(saleItemsResult.error.message)
  }

  const booths = (boothsResult.data ?? []) as BoothRow[]
  const schedules = (schedulesResult.data ?? []) as ScheduleRow[]
  const trendSales = (trendSalesResult.data ?? []) as TrendSaleRow[]
  const saleItems = (saleItemsResult.data ?? []) as SaleItemRow[]

  const summary = emptySummary()
  const { boothCards, boothCardMap } = buildBoothCards(booths)
  const paymentMap = buildPaymentMap()

  for (const schedule of schedules) {
    incrementScheduleCount(summary, schedule.status)
    const boothCard = boothCardMap.get(schedule.booth_id)

    if (boothCard) {
      incrementScheduleCount(boothCard, schedule.status)
    }
  }

  for (const sale of sales) {
    const amount = toNumber(sale.total_amount)
    const isCash = sale.payment_method === "cash"

    summary.totalRevenue += amount
    summary.saleCount += 1

    if (isCash) {
      summary.cashRevenue += amount
    } else {
      summary.nonCashRevenue += amount
    }

    const boothCard = boothCardMap.get(sale.booth_id)
    if (boothCard) {
      boothCard.totalRevenue += amount
      boothCard.saleCount += 1

      if (isCash) {
        boothCard.cashRevenue += amount
      } else {
        boothCard.nonCashRevenue += amount
      }
    }

    const paymentEntry = paymentMap.get(sale.payment_method)
    if (paymentEntry) {
      paymentEntry.count += 1
      paymentEntry.total += amount
    }
  }

  return {
    selectedDate,
    isLiveDate,
    summary,
    paymentBreakdown: Array.from(paymentMap.values()),
    boothCards: boothCards.sort((left, right) => {
      if (right.totalRevenue !== left.totalRevenue) {
        return right.totalRevenue - left.totalRevenue
      }

      return left.boothName.localeCompare(right.boothName)
    }),
    trendSeries: buildTrendSeries(trendSales, selectedDate),
    topProducts: buildTopProducts(saleItems),
    recentTransactions: buildRecentTransactions(sales),
  } satisfies AdminDashboardData
}
