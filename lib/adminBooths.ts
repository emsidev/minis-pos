import type { Database } from "@/lib/database.types"
import type { Booth, BoothSchedule, Product, SaleWithJoins } from "@/lib/shifts"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export type AdminEmployeeOption = Pick<
  Database["public"]["Tables"]["employees"]["Row"],
  "id" | "name" | "email"
>

export type AdminScheduleInventory =
  Database["public"]["Tables"]["booth_schedule_products"]["Row"] & {
    products: Product | null
  }

export type AdminInventoryEventLine =
  Database["public"]["Tables"]["inventory_event_lines"]["Row"] & {
    products: Product | null
  }

export type AdminInventoryEvent =
  Database["public"]["Tables"]["inventory_events"]["Row"] & {
    actors: AdminEmployeeOption | null
    inventory_event_lines: AdminInventoryEventLine[]
  }

export type AdminScheduleAssignment =
  Database["public"]["Tables"]["booth_schedule_assignments"]["Row"] & {
    employees: AdminEmployeeOption | null
  }

export type AdminOperatorPeriod =
  Database["public"]["Tables"]["booth_schedule_operator_periods"]["Row"] & {
    operator: AdminEmployeeOption | null
    initiated_by: AdminEmployeeOption | null
  }

export type AdminShiftCloseout =
  Database["public"]["Tables"]["shift_closeouts"]["Row"] & {
    closed_by: AdminEmployeeOption | null
    reopened_by: AdminEmployeeOption | null
  }

export type AdminSchedule = BoothSchedule & {
  booths: Booth
  operator: AdminEmployeeOption | null
  booth_schedule_assignments: AdminScheduleAssignment[]
  booth_schedule_operator_periods: AdminOperatorPeriod[]
  booth_schedule_products: AdminScheduleInventory[]
  inventory_events: AdminInventoryEvent[]
  shift_closeouts: AdminShiftCloseout[]
}

export type AdminShiftDetailData = {
  schedule: AdminSchedule | null
  products: Product[]
  sales: SaleWithJoins[]
}

export type AdminScheduleCalendarItem = Pick<
  BoothSchedule,
  | "id"
  | "booth_id"
  | "operator_employee_id"
  | "date"
  | "start_time"
  | "end_time"
  | "status"
  | "created_at"
> & {
  booths: Pick<Booth, "id" | "name">
  operator: AdminEmployeeOption | null
  booth_schedule_assignments: AdminScheduleAssignment[]
}

export async function getAdminBooths() {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("booths")
    .select("*")
    .order("name")

  if (error) {
    throw new Error(error.message)
  }

  return data as Booth[]
}

export async function getAdminBoothById(boothId: string) {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("booths")
    .select("*")
    .eq("id", boothId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data as Booth | null
}

export async function getAdminSchedules(boothId?: string) {
  const supabase = createServerSupabaseClient()
  let query = supabase
    .from("booth_schedules")
    .select(
      "*, booths(*), operator:employees!booth_schedules_operator_employee_id_fkey(id, name, email), booth_schedule_assignments(*, employees(id, name, email)), booth_schedule_products(*, products(*)), shift_closeouts(*, closed_by:employees!shift_closeouts_closed_by_employee_id_fkey(id, name, email), reopened_by:employees!shift_closeouts_reopened_by_employee_id_fkey(id, name, email))"
    )
    .order("date", { ascending: false })
    .order("start_time", { ascending: false })

  if (boothId) {
    query = query.eq("booth_id", boothId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((schedule) => ({
    ...schedule,
    booth_schedule_operator_periods: [],
    inventory_events: [],
  })) as AdminSchedule[]
}

export async function getAdminScheduleCalendarItems(
  startDate: string,
  endDate: string,
  boothId?: string
) {
  const supabase = createServerSupabaseClient()
  let query = supabase
    .from("booth_schedules")
    .select(
      "id, booth_id, operator_employee_id, date, start_time, end_time, status, created_at, booths(id, name), operator:employees!booth_schedules_operator_employee_id_fkey(id, name, email), booth_schedule_assignments(*, employees(id, name, email))"
    )
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true })

  if (boothId) {
    query = query.eq("booth_id", boothId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return data as AdminScheduleCalendarItem[]
}

export async function getAdminScheduleById(scheduleId: string) {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("booth_schedules")
    .select(
      "*, booths(*), operator:employees!booth_schedules_operator_employee_id_fkey(id, name, email), booth_schedule_assignments(*, employees(id, name, email)), booth_schedule_operator_periods(*, operator:employees!booth_schedule_operator_periods_operator_employee_id_fkey(id, name, email), initiated_by:employees!booth_schedule_operator_periods_initiated_by_employee_id_fkey(id, name, email)), booth_schedule_products(*, products(*)), inventory_events(*, actors:employees!inventory_events_actor_employee_id_fkey(id, name, email), inventory_event_lines(*, products(*))), shift_closeouts(*, closed_by:employees!shift_closeouts_closed_by_employee_id_fkey(id, name, email), reopened_by:employees!shift_closeouts_reopened_by_employee_id_fkey(id, name, email))"
    )
    .eq("id", scheduleId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data as AdminSchedule | null
}

export async function getActiveEmployeeOptions() {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("employees")
    .select("id, name, email")
    .eq("is_active", true)
    .order("name")

  if (error) {
    throw new Error(error.message)
  }

  return data as AdminEmployeeOption[]
}

export async function getAvailableProductOptions() {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_available", true)
    .order("category")
    .order("name")

  if (error) {
    throw new Error(error.message)
  }

  return data as Product[]
}
