import { createServerSupabaseClient } from "@/lib/supabase-server"
import type { Database } from "@/lib/database.types"
import type { ShiftApprovalRecord } from "@/lib/shiftApprovals"
import {
  getBusinessDate,
  getBusinessShiftState,
  getBusinessTime,
  hasStartedOperatorPeriod,
} from "@/lib/utils"

export type Booth = Database["public"]["Tables"]["booths"]["Row"]
export type BoothSchedule =
  Database["public"]["Tables"]["booth_schedules"]["Row"]
export type BoothScheduleAssignment =
  Database["public"]["Tables"]["booth_schedule_assignments"]["Row"]
export type BoothScheduleOperatorPeriod =
  Database["public"]["Tables"]["booth_schedule_operator_periods"]["Row"]
export type ShiftEmployeeSummary = Pick<
  Database["public"]["Tables"]["employees"]["Row"],
  "id" | "name" | "email"
>
export type BoothScheduleAssignmentWithEmployee = BoothScheduleAssignment & {
  employees?: ShiftEmployeeSummary | null
}
export type Product = Database["public"]["Tables"]["products"]["Row"] & {
  stock?: number
  quantity?: number
}
export type SaleReceiptSyncState = "pending" | "syncing" | "synced" | "failed"
export type ShiftCloseout =
  Database["public"]["Tables"]["shift_closeouts"]["Row"]
export type SharedBoothSchedule = BoothSchedule & {
  booths: Booth
  operator?: ShiftEmployeeSummary | null
  booth_schedule_assignments: BoothScheduleAssignmentWithEmployee[]
  booth_schedule_operator_periods: BoothScheduleOperatorPeriod[]
  shift_closeouts?: ShiftCloseout[]
}

export type ScheduleBrowserItem = Pick<
  BoothSchedule,
  | "id"
  | "booth_id"
  | "date"
  | "start_time"
  | "end_time"
  | "status"
  | "created_at"
  | "operator_employee_id"
> & {
  booth_name: string
  booth_location_text: string | null
  operator_name: string | null
  assigned_employee_names: string[]
  is_assigned: boolean
}

type ActiveScheduleCandidate = SharedBoothSchedule & {
  booth_schedule_products?: Array<{ id: string }> | null
}

/**
 * Fetches the active shared booth schedule visible to an assigned employee.
 */
export async function getActiveBoothSchedule(employeeId: string) {
  const supabase = createServerSupabaseClient()
  const currentDate = getBusinessDate()
  const currentTime = getBusinessTime()

  const { data, error } = await supabase
    .from("booth_schedules")
    .select(
      "*, booths(*), operator:employees!booth_schedules_operator_employee_id_fkey(id, name, email), booth_schedule_assignments!inner(*, employees(id, name, email)), booth_schedule_operator_periods(*), booth_schedule_products(id), shift_closeouts(*)"
    )
    .eq("booth_schedule_assignments.employee_id", employeeId)
    .eq("status", "scheduled")
    .eq("date", currentDate)
    .gt("end_time", currentTime)
    .order("start_time", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const schedules = (data ?? []) as ActiveScheduleCandidate[]
  return (
    schedules.find(
      (schedule) =>
        getBusinessShiftState(schedule, {
          inventoryReady: (schedule.booth_schedule_products?.length ?? 0) > 0,
          manuallyStarted: hasStartedOperatorPeriod(
            schedule.booth_schedule_operator_periods
          ),
        }).isOperational
    ) ?? null
  )
}

/**
 * Fetches the active shift only when this employee currently operates POS.
 */
export async function getActiveOperatorBoothSchedule(employeeId: string) {
  const supabase = createServerSupabaseClient()
  const currentDate = getBusinessDate()
  const currentTime = getBusinessTime()

  const { data, error } = await supabase
    .from("booth_schedules")
    .select(
      "*, booths(*), operator:employees!booth_schedules_operator_employee_id_fkey(id, name, email), booth_schedule_assignments(*, employees(id, name, email)), booth_schedule_operator_periods(*), booth_schedule_products(id), shift_closeouts(*)"
    )
    .eq("operator_employee_id", employeeId)
    .eq("status", "scheduled")
    .eq("date", currentDate)
    .gt("end_time", currentTime)
    .order("start_time", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const schedules = (data ?? []) as ActiveScheduleCandidate[]
  return (
    schedules.find(
      (schedule) =>
        getBusinessShiftState(schedule, {
          inventoryReady: (schedule.booth_schedule_products?.length ?? 0) > 0,
          manuallyStarted: hasStartedOperatorPeriod(
            schedule.booth_schedule_operator_periods
          ),
        }).isOperational
    ) ?? null
  )
}

export type SaleWithJoins = Database["public"]["Tables"]["sales"]["Row"] & {
  employees: { name: string } | null
  booths: { name: string } | null
  receipt_photo_local?: string | null
  sync_state?: SaleReceiptSyncState | null
}

export type SaleItemWithProduct =
  Database["public"]["Tables"]["sale_items"]["Row"] & {
    products: Product | null
  }

export type EmployeeSalesHistoryGroup = {
  schedule: SharedBoothSchedule
  sales: SaleWithJoins[]
}

export type ShiftDetailData = {
  schedule: SharedBoothSchedule | null
  products: Product[]
  sales: SaleWithJoins[]
  saleItems: SaleItemWithProduct[]
  approvalHistory?: ShiftApprovalRecord[]
  pendingRevenueIncrease?: number
  pendingRevenueDecrease?: number
}

export type TodayShiftListItem = SharedBoothSchedule & {
  hasOpeningInventory: boolean
}

/**
 * Fetches products assigned to a specific booth schedule.
 */
export async function getBoothScheduleProducts(scheduleId: string) {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("booth_schedule_products")
    .select("*, products(*)")
    .eq("schedule_id", scheduleId)

  if (error) {
    throw new Error(error.message)
  }

  return data.flatMap((item) =>
    item.products
      ? [
          {
            ...item.products,
            quantity: item.quantity,
            stock: item.stock,
          },
        ]
      : []
  )
}

/**
 * Fetches all available products (for admins or general use).
 */
export async function getAllAvailableProducts() {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_available", true)
    .order("category", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

/**
 * Fetches sales for a specific booth schedule.
 */
export async function getBoothScheduleSales(scheduleId: string) {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("sales")
    .select("*, employees(name), booths(name)")
    .eq("schedule_id", scheduleId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data as SaleWithJoins[]
}

/**
 * Fetches all booth schedules for a specific employee.
 */
export async function getEmployeeSchedules(employeeId: string) {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("booth_schedules")
    .select(
      "*, booths(*), operator:employees!booth_schedules_operator_employee_id_fkey(id, name, email), booth_schedule_assignments!inner(*, employees(id, name, email)), booth_schedule_operator_periods(*), shift_closeouts(*)"
    )
    .eq("booth_schedule_assignments.employee_id", employeeId)
    .order("date", { ascending: false })
    .order("start_time", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data as SharedBoothSchedule[]
}

export async function getEmployeeSchedulesForDate(
  employeeId: string,
  date: string
) {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("booth_schedules")
    .select(
      "*, booths(*), operator:employees!booth_schedules_operator_employee_id_fkey(id, name, email), booth_schedule_assignments!inner(*, employees(id, name, email)), booth_schedule_operator_periods(*), booth_schedule_products(id), shift_closeouts(*)"
    )
    .eq("booth_schedule_assignments.employee_id", employeeId)
    .eq("date", date)
    .order("start_time", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as ActiveScheduleCandidate[]).map((schedule) => ({
    ...schedule,
    hasOpeningInventory: (schedule.booth_schedule_products?.length ?? 0) > 0,
  })) as TodayShiftListItem[]
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function emptyShiftDetailData(): ShiftDetailData {
  return {
    schedule: null,
    products: [],
    sales: [],
    saleItems: [],
    approvalHistory: [],
    pendingRevenueIncrease: 0,
    pendingRevenueDecrease: 0,
  }
}

function parseSharedBoothSchedule(value: unknown): SharedBoothSchedule | null {
  if (!isJsonRecord(value) || !isJsonRecord(value.booths)) {
    return null
  }

  return {
    ...(value as unknown as BoothSchedule),
    booths: value.booths as Booth,
    operator: isJsonRecord(value.operator)
      ? (value.operator as ShiftEmployeeSummary)
      : null,
    booth_schedule_assignments: Array.isArray(value.booth_schedule_assignments)
      ? (value.booth_schedule_assignments as BoothScheduleAssignmentWithEmployee[])
      : [],
    booth_schedule_operator_periods: Array.isArray(
      value.booth_schedule_operator_periods
    )
      ? (value.booth_schedule_operator_periods as BoothScheduleOperatorPeriod[])
      : [],
    shift_closeouts: Array.isArray(value.shift_closeouts)
      ? (value.shift_closeouts as ShiftCloseout[])
      : [],
  }
}

function parseProducts(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as Product[]
  }

  return value.filter(isJsonRecord) as Product[]
}

function parseSales(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as SaleWithJoins[]
  }

  return value.filter(isJsonRecord) as SaleWithJoins[]
}

function parseSaleItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as SaleItemWithProduct[]
  }

  return value.filter(isJsonRecord) as SaleItemWithProduct[]
}

export async function getEmployeeScheduleBrowser(
  startDate: string,
  endDate: string
) {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase.rpc("get_employee_schedule_browser", {
    p_start_date: startDate,
    p_end_date: endDate,
  })

  if (error) {
    throw new Error(error.message)
  }

  if (!Array.isArray(data)) {
    return [] as ScheduleBrowserItem[]
  }

  const items = data as Array<Record<string, unknown>>

  return items.flatMap((item) => {
    if (!isJsonRecord(item)) {
      return []
    }

    return [
      {
        id: String(item.id),
        booth_id: String(item.booth_id),
        date: String(item.date),
        start_time: String(item.start_time),
        end_time: String(item.end_time),
        status: item.status as BoothSchedule["status"],
        created_at: String(item.created_at ?? ""),
        operator_employee_id:
          typeof item.operator_employee_id === "string"
            ? item.operator_employee_id
            : null,
        booth_name: String(item.booth_name ?? ""),
        booth_location_text:
          typeof item.booth_location_text === "string"
            ? item.booth_location_text
            : null,
        operator_name:
          typeof item.operator_name === "string" ? item.operator_name : null,
        assigned_employee_names: Array.isArray(item.assigned_employee_names)
          ? item.assigned_employee_names.filter(
              (value: unknown): value is string => typeof value === "string"
            )
          : [],
        is_assigned: Boolean(item.is_assigned),
      },
    ]
  })
}

export async function getEmployeeBrowsableShiftDetails(scheduleId: string) {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase.rpc("get_employee_schedule_detail", {
    p_schedule_id: scheduleId,
  })

  if (error) {
    throw new Error(error.message)
  }

  if (!isJsonRecord(data)) {
    return emptyShiftDetailData()
  }

  return {
    schedule: parseSharedBoothSchedule(data.schedule),
    products: parseProducts(data.products),
    sales: parseSales(data.sales),
    saleItems: parseSaleItems(data.saleItems),
  } satisfies ShiftDetailData
}

export async function getEmployeeBrowsableSaleItems(saleId: string) {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase.rpc(
    "get_employee_schedule_sale_items",
    {
      p_sale_id: saleId,
    }
  )

  if (error) {
    throw new Error(error.message)
  }

  return parseSaleItems(data)
}

/**
 * Fetches grouped sales history for an employee on one business date.
 */
export async function getEmployeeSalesHistoryForDate(
  employeeId: string,
  date: string
) {
  const supabase = createServerSupabaseClient()

  const { data: schedules, error: schedulesError } = await supabase
    .from("booth_schedules")
    .select(
      "*, booths(*), operator:employees!booth_schedules_operator_employee_id_fkey(id, name, email), booth_schedule_assignments!inner(*, employees(id, name, email)), booth_schedule_operator_periods(*), shift_closeouts(*)"
    )
    .eq("booth_schedule_assignments.employee_id", employeeId)
    .eq("date", date)
    .order("start_time", { ascending: true })

  if (schedulesError) {
    throw new Error(schedulesError.message)
  }

  const groupedSchedules = (schedules ?? []) as SharedBoothSchedule[]

  if (groupedSchedules.length === 0) {
    return [] as EmployeeSalesHistoryGroup[]
  }

  const scheduleIds = groupedSchedules.map((schedule) => schedule.id)
  const { data: sales, error: salesError } = await supabase
    .from("sales")
    .select("*, employees(name), booths(name)")
    .in("schedule_id", scheduleIds)
    .eq("status", "completed")
    .order("created_at", { ascending: false })

  if (salesError) {
    throw new Error(salesError.message)
  }

  const salesBySchedule = new Map<string, SaleWithJoins[]>()
  for (const sale of (sales ?? []) as SaleWithJoins[]) {
    const current = salesBySchedule.get(sale.schedule_id) ?? []
    current.push(sale)
    salesBySchedule.set(sale.schedule_id, current)
  }

  return groupedSchedules.map((schedule) => ({
    schedule,
    sales: salesBySchedule.get(schedule.id) ?? [],
  }))
}

/**
 * Fetches a specific booth schedule by ID.
 */
export async function getBoothScheduleById(scheduleId: string) {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("booth_schedules")
    .select(
      "*, booths(*), operator:employees!booth_schedules_operator_employee_id_fkey(id, name, email), booth_schedule_assignments(*, employees(id, name, email)), booth_schedule_operator_periods(*), shift_closeouts(*)"
    )
    .eq("id", scheduleId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data as SharedBoothSchedule | null
}

/**
 * Fetches items for a specific sale.
 */
export async function getSaleItems(saleId: string) {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("sale_items")
    .select("*, products(*)")
    .eq("sale_id", saleId)

  if (error) {
    throw new Error(error.message)
  }

  return data as SaleItemWithProduct[]
}

export async function getSaleItemsForSales(
  sales: Array<Pick<SaleWithJoins, "id">>
) {
  const saleIds = sales.map((sale) => sale.id)

  if (saleIds.length === 0) {
    return [] as SaleItemWithProduct[]
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("sale_items")
    .select("*, products(*)")
    .in("sale_id", saleIds)

  if (error) {
    throw new Error(error.message)
  }

  return data as SaleItemWithProduct[]
}
