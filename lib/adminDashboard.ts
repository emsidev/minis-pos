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

type SaleRow = Pick<
  Database["public"]["Tables"]["sales"]["Row"],
  "id" | "booth_id" | "payment_method" | "total_amount"
>

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

export type AdminDashboardData = {
  selectedDate: string
  isLiveDate: boolean
  summary: DashboardSummary
  paymentBreakdown: DashboardPaymentBreakdown[]
  boothCards: DashboardBoothCard[]
}

type DashboardRpcPayload = {
  summary: DashboardSummary
  paymentBreakdown: DashboardPaymentBreakdown[]
  boothCards: DashboardBoothCard[]
}

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

function getBusinessDayRange(date: string) {
  const [year, month, day] = date.split("-").map(Number)
  const nextDay = new Date(Date.UTC(year, month - 1, day))
  nextDay.setUTCDate(nextDay.getUTCDate() + 1)

  const nextYear = nextDay.getUTCFullYear()
  const nextMonth = String(nextDay.getUTCMonth() + 1).padStart(2, "0")
  const nextDate = String(nextDay.getUTCDate()).padStart(2, "0")

  return {
    startIso: `${date}T00:00:00+08:00`,
    endIso: `${nextYear}-${nextMonth}-${nextDate}T00:00:00+08:00`,
  }
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

function normalizeDashboardRpcPayload(value: Json): DashboardRpcPayload | null {
  if (!isRecord(value)) {
    return null
  }

  const summary = value.summary
  const paymentBreakdown = value.paymentBreakdown
  const boothCards = value.boothCards

  if (
    !summary ||
    !isRecord(summary) ||
    !Array.isArray(paymentBreakdown) ||
    !Array.isArray(boothCards)
  ) {
    return null
  }

  return {
    summary: {
      totalRevenue: Number(summary.totalRevenue ?? 0),
      saleCount: Number(summary.saleCount ?? 0),
      cashRevenue: Number(summary.cashRevenue ?? 0),
      nonCashRevenue: Number(summary.nonCashRevenue ?? 0),
      openShiftCount: Number(summary.openShiftCount ?? 0),
      closedShiftCount: Number(summary.closedShiftCount ?? 0),
      cancelledShiftCount: Number(summary.cancelledShiftCount ?? 0),
    },
    paymentBreakdown: paymentBreakdown.flatMap((entry) => {
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
    }),
    boothCards: boothCards.flatMap((entry) => {
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
    }),
  }
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

export async function getAdminDashboardData(requestedDate?: string) {
  const selectedDate = isValidDateString(requestedDate)
    ? requestedDate!
    : getBusinessDate()
  const isLiveDate = selectedDate === getBusinessDate()
  const { startIso, endIso } = getBusinessDayRange(selectedDate)

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

  // Compatibility fallback until the latest schema is applied.
  const [boothsResult, schedulesResult, salesResult] = await Promise.all([
    supabase.from("booths").select("id, name, is_active").order("name"),
    supabase
      .from("booth_schedules")
      .select("id, booth_id, status")
      .eq("date", selectedDate),
    supabase
      .from("sales")
      .select("id, booth_id, payment_method, total_amount")
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
  const sales = (salesResult.data ?? []) as SaleRow[]

  const summary = emptySummary()
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
  const boothCardMap = new Map(boothCards.map((card) => [card.boothId, card]))
  const paymentMap = new Map<PaymentMethod, DashboardPaymentBreakdown>(
    paymentMethods.map((method) => [
      method,
      {
        method,
        count: 0,
        total: 0,
      },
    ])
  )

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
  } satisfies AdminDashboardData
}
