import { createServerSupabaseClient } from "@/lib/supabase-server"
import type { Database } from "@/lib/database.types"
import { getBusinessDate, getBusinessTime } from "@/lib/utils"

export type Booth = Database["public"]["Tables"]["booths"]["Row"]
export type BoothSchedule =
  Database["public"]["Tables"]["booth_schedules"]["Row"]
export type BoothScheduleAssignment =
  Database["public"]["Tables"]["booth_schedule_assignments"]["Row"]
export type BoothScheduleOperatorPeriod =
  Database["public"]["Tables"]["booth_schedule_operator_periods"]["Row"]
export type Product = Database["public"]["Tables"]["products"]["Row"] & {
  stock?: number
  quantity?: number
}
export type ShiftCloseout =
  Database["public"]["Tables"]["shift_closeouts"]["Row"]
export type SharedBoothSchedule = BoothSchedule & {
  booths: Booth
  booth_schedule_assignments: BoothScheduleAssignment[]
  booth_schedule_operator_periods: BoothScheduleOperatorPeriod[]
  shift_closeouts?: ShiftCloseout[]
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
      "*, booths(*), booth_schedule_assignments!inner(*), booth_schedule_operator_periods(*), shift_closeouts(*)"
    )
    .eq("booth_schedule_assignments.employee_id", employeeId)
    .eq("status", "scheduled")
    .eq("date", currentDate)
    .lte("start_time", currentTime)
    .gt("end_time", currentTime)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data as SharedBoothSchedule | null
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
      "*, booths(*), booth_schedule_assignments(*), booth_schedule_operator_periods(*), shift_closeouts(*)"
    )
    .eq("operator_employee_id", employeeId)
    .eq("status", "scheduled")
    .eq("date", currentDate)
    .lte("start_time", currentTime)
    .gt("end_time", currentTime)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data as SharedBoothSchedule | null
}

export type SaleWithJoins = Database["public"]["Tables"]["sales"]["Row"] & {
  employees: { name: string } | null
  booths: { name: string } | null
}

export type EmployeeSalesHistoryGroup = {
  schedule: SharedBoothSchedule
  sales: SaleWithJoins[]
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
      "*, booths(*), booth_schedule_assignments!inner(*), booth_schedule_operator_periods(*), shift_closeouts(*)"
    )
    .eq("booth_schedule_assignments.employee_id", employeeId)
    .order("date", { ascending: false })
    .order("start_time", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data as SharedBoothSchedule[]
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
      "*, booths(*), booth_schedule_assignments!inner(*), booth_schedule_operator_periods(*), shift_closeouts(*)"
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
      "*, booths(*), booth_schedule_assignments(*), booth_schedule_operator_periods(*), shift_closeouts(*)"
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

  return data as (Database["public"]["Tables"]["sale_items"]["Row"] & {
    products: Product
  })[]
}
