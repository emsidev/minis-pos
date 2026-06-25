import { requireEmployeeRole } from "@/lib/auth.server"
import type { Database } from "@/lib/database.types"
import type { PaymentMethod, ScheduleStatus } from "@/lib/domain-types"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import {
  getBoothDisplayName,
  getBusinessDate,
  getEmployeeDisplayName,
} from "@/lib/utils"

type SalesRow = Pick<
  Database["public"]["Tables"]["sales"]["Row"],
  | "id"
  | "booth_id"
  | "employee_id"
  | "schedule_id"
  | "payment_method"
  | "receipt_photo_path"
  | "status"
  | "total_amount"
  | "created_at"
  | "updated_at"
> & {
  booths: Pick<
    Database["public"]["Tables"]["booths"]["Row"],
    "id" | "name"
  > | null
  employees: Pick<
    Database["public"]["Tables"]["employees"]["Row"],
    "id" | "name"
  > | null
  booth_schedules: Pick<
    Database["public"]["Tables"]["booth_schedules"]["Row"],
    "date" | "end_time" | "start_time" | "status"
  > | null
}

export type AdminSalesDateRange = {
  startDate: string
  endDate: string
}

export type AdminSalesLedgerView = "active" | "trash"

export type AdminSalesLedgerRow = {
  id: string
  boothId: string
  boothName: string
  employeeId: string
  employeeName: string
  scheduleId: string
  scheduleDate: string
  shiftLabel: string
  createdAt: string
  updatedAt: string
  paymentMethod: PaymentMethod
  receiptPhotoPath: string | null
  hasReceipt: boolean
  canEditReceipt: boolean
  status: string
  totalAmount: number
}

export type AdminSalesLedgerData = AdminSalesDateRange & {
  rows: AdminSalesLedgerRow[]
  nextCursor: string | null
  view: AdminSalesLedgerView
}

const ADMIN_SALES_PAGE_SIZE = 100

type AdminSalesCursor = {
  createdAt: string
  id: string
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

function normalizeScheduleStatus(
  value: string | null | undefined
): ScheduleStatus | undefined {
  switch (value) {
    case "scheduled":
    case "closed":
    case "cancelled":
      return value
    default:
      return undefined
  }
}

function encodeCursor(cursor: AdminSalesCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url")
}

function decodeCursor(value: string | undefined): AdminSalesCursor | null {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8")
    ) as Partial<AdminSalesCursor>

    return typeof parsed.createdAt === "string" && typeof parsed.id === "string"
      ? { createdAt: parsed.createdAt, id: parsed.id }
      : null
  } catch {
    return null
  }
}

function isValidDateString(value: string | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

export function normalizeAdminSalesDateRange(
  startDate?: string,
  endDate?: string
): AdminSalesDateRange {
  const businessDate = getBusinessDate()
  const normalizedStartDate = isValidDateString(startDate)
    ? startDate!
    : businessDate
  const normalizedEndDate = isValidDateString(endDate)
    ? endDate!
    : normalizedStartDate

  if (normalizedStartDate <= normalizedEndDate) {
    return {
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
    }
  }

  return {
    startDate: normalizedEndDate,
    endDate: normalizedStartDate,
  }
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

function getBusinessDayBounds({ startDate, endDate }: AdminSalesDateRange) {
  return {
    startIso: `${startDate}T00:00:00+08:00`,
    endIso: `${addBusinessDays(endDate, 1)}T00:00:00+08:00`,
  }
}

function formatShiftLabel(
  schedule: Pick<
    Database["public"]["Tables"]["booth_schedules"]["Row"],
    "date" | "end_time" | "start_time"
  > | null
) {
  if (!schedule) {
    return "Schedule unavailable"
  }

  return `${schedule.date} / ${schedule.start_time.slice(0, 5)} - ${schedule.end_time.slice(0, 5)}`
}

function canEditReceipt(
  paymentMethod: PaymentMethod,
  receiptPhotoPath: string | null,
  scheduleStatus: ScheduleStatus | undefined,
  saleStatus: string
) {
  return (
    saleStatus === "completed" &&
    paymentMethod !== "cash" &&
    Boolean(receiptPhotoPath) &&
    scheduleStatus === "scheduled"
  )
}

export function normalizeAdminSalesView(value?: string): AdminSalesLedgerView {
  return value === "trash" ? "trash" : "active"
}

export async function getAdminSalesLedger(
  startDate?: string,
  endDate?: string,
  cursorValue?: string,
  view: AdminSalesLedgerView = "active"
): Promise<AdminSalesLedgerData> {
  await requireEmployeeRole("admin")

  const range = normalizeAdminSalesDateRange(startDate, endDate)
  const { startIso, endIso } = getBusinessDayBounds(range)
  const cursor = decodeCursor(cursorValue)
  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from("sales")
    .select(
      "id, booth_id, employee_id, schedule_id, payment_method, receipt_photo_path, status, total_amount, created_at, updated_at, booths(id, name), employees(id, name), booth_schedules(date, start_time, end_time, status)"
    )
    .eq("status", view === "trash" ? "deleted" : "completed")
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(ADMIN_SALES_PAGE_SIZE + 1)

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
    )
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  const pageRows = ((data ?? []) as SalesRow[]).slice(0, ADMIN_SALES_PAGE_SIZE)
  const rows = pageRows.map((sale) => {
    const createdAt = sale.created_at ?? sale.updated_at ?? ""
    const updatedAt = sale.updated_at ?? sale.created_at ?? ""
    const paymentMethod = normalizePaymentMethod(sale.payment_method)
    const scheduleStatus = normalizeScheduleStatus(sale.booth_schedules?.status)
    const saleStatus = sale.status ?? (view === "trash" ? "deleted" : "completed")

    return {
    id: sale.id,
    boothId: sale.booth_id ?? sale.booths?.id ?? "",
    boothName: getBoothDisplayName(sale.booths),
    employeeId: sale.employee_id ?? "",
    employeeName: getEmployeeDisplayName(sale.employees),
    scheduleId: sale.schedule_id ?? "",
    scheduleDate: sale.booth_schedules?.date ?? createdAt.slice(0, 10),
    shiftLabel: formatShiftLabel(sale.booth_schedules),
    createdAt,
    updatedAt,
    paymentMethod,
    receiptPhotoPath: sale.receipt_photo_path,
    hasReceipt: Boolean(sale.receipt_photo_path),
    canEditReceipt: canEditReceipt(
      paymentMethod,
      sale.receipt_photo_path,
      scheduleStatus,
      saleStatus
    ),
    status: saleStatus,
    totalAmount: Number(sale.total_amount),
  }})

  return {
    ...range,
    rows,
    view,
    nextCursor:
      (data?.length ?? 0) > ADMIN_SALES_PAGE_SIZE && pageRows.length > 0
        ? encodeCursor({
            createdAt:
              pageRows[pageRows.length - 1].created_at ??
              pageRows[pageRows.length - 1].updated_at ??
              "",
            id: pageRows[pageRows.length - 1].id,
          })
        : null,
  }
}
