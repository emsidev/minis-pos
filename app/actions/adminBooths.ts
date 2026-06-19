"use server"

import { revalidatePath } from "next/cache"

import { requireEmployeeRole } from "@/lib/auth"
import {
  type AdminShiftDetailData,
  type BulkScheduleEditableRow,
  type BulkScheduleLoadFilters,
  type BulkScheduleSaveResult,
  type BulkScheduleSaveRowInput,
  getBulkEditableScheduleRows,
  getAdminScheduleById,
  getAdminScheduleCalendarItems,
} from "@/lib/adminBooths"
import { buildGoogleMapsLink } from "@/lib/boothMaps"
import type { Booth } from "@/lib/shifts"
import type { Json } from "@/lib/database.types"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import {
  getBusinessDate,
  getBusinessTime,
  hasBusinessShiftStarted,
} from "@/lib/utils"
import { getBoothScheduleSales } from "@/lib/shifts"

export type BoothFormInput = {
  id?: string
  name: string
  locationText: string
  googleMapsUrl: string
  latitude: string
  longitude: string
}

type ScheduleFormInputBase = {
  boothId: string
  employeeIds: string[]
  operatorEmployeeId: string | null
  startTime: string
  endTime: string
}

type ScheduleRowInput = ScheduleFormInputBase & {
  id?: string
  date: string
}

export type ScheduleFormInput =
  | (ScheduleFormInputBase & {
      id: string
      date: string
    })
  | (ScheduleFormInputBase & {
      id?: undefined
      startDate: string
      endDate: string
    })

export async function loadAdminScheduleCalendarItems(
  startDate: string,
  endDate: string,
  boothId?: string
) {
  await requireEmployeeRole("admin")

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endDate) ||
    startDate > endDate ||
    (Date.parse(`${endDate}T00:00:00Z`) -
      Date.parse(`${startDate}T00:00:00Z`)) /
      86_400_000 >
      31
  ) {
    throw new Error("Invalid schedule month range.")
  }

  return getAdminScheduleCalendarItems(startDate, endDate, boothId)
}

export async function loadAdminShiftDetail(
  scheduleId: string
): Promise<AdminShiftDetailData> {
  await requireEmployeeRole("admin")

  if (!scheduleId.trim()) {
    return {
      schedule: null,
      products: [],
      sales: [],
    }
  }

  const schedule = await getAdminScheduleById(scheduleId)
  if (!schedule) {
    return {
      schedule: null,
      products: [],
      sales: [],
    }
  }

  const sales = await getBoothScheduleSales(scheduleId)

  return {
    schedule,
    products: schedule.booth_schedule_products.flatMap((item) =>
      item.products
        ? [
            {
              ...item.products,
              quantity: item.quantity,
              stock: item.stock,
            },
          ]
        : []
    ),
    sales,
  }
}

export type InventoryOverrideInput = {
  scheduleId: string
  boothId: string
  reason: string
  lines: {
    productId: string
    previousStock: number
    resultingStock: number
  }[]
}

export type AdminActionResult = {
  ok: boolean
  message?: string
  error?: string
  booth?: Booth
}

type BoothWrite = {
  name: string
  location_text: string | null
  google_maps_url: string | null
  location_lat: string | null
  location_lng: string | null
}

function optionalText(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseCoordinate(value: string, minimum: number, maximum: number) {
  const cleaned = value.trim()

  if (!cleaned) {
    return { value: null as string | null }
  }

  const parsed = Number(cleaned)
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    return { error: `Coordinates must be between ${minimum} and ${maximum}.` }
  }

  return { value: parsed.toString() }
}

function parseBoothInput(input: BoothFormInput): {
  value?: BoothWrite
  error?: string
} {
  const name = input.name.trim()
  if (!name) {
    return { error: "Booth name is required." }
  }

  const latitude = parseCoordinate(input.latitude, -90, 90)
  if (latitude.error) {
    return { error: `Latitude ${latitude.error.toLowerCase()}` }
  }

  const longitude = parseCoordinate(input.longitude, -180, 180)
  if (longitude.error) {
    return { error: `Longitude ${longitude.error.toLowerCase()}` }
  }

  const mapsUrl = optionalText(input.googleMapsUrl)
  const normalizedMapsUrl =
    latitude.value && longitude.value
      ? buildGoogleMapsLink(Number(latitude.value), Number(longitude.value))
      : mapsUrl
  if (normalizedMapsUrl) {
    try {
      const url = new URL(normalizedMapsUrl)
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return { error: "Map link must be a valid web link." }
      }
    } catch {
      return { error: "Map link must be a valid web link." }
    }
  }

  return {
    value: {
      name,
      location_text: optionalText(input.locationText),
      google_maps_url: normalizedMapsUrl,
      location_lat: latitude.value ?? null,
      location_lng: longitude.value ?? null,
    },
  }
}

type ParsedScheduleInput =
  | ({
      mode: "edit"
    } & ParsedScheduleRowInput)
  | ({
      mode: "create-range"
      startDate: string
      endDate: string
    } & ScheduleFormInputBase & { employeeIds: string[] })

type ParsedScheduleRowInput = {
  id?: string
  boothId: string
  employeeIds: string[]
  operatorEmployeeId: string | null
  date: string
  startTime: string
  endTime: string
}

type EmployeeScheduleConflictRow = {
  employee_id: string
  booth_schedules: {
    id: string
    date: string
    start_time: string
    end_time: string
    status: string
  } | null
}

type ScheduleConflictLookupInput = {
  employeeIds: string[]
  targetDates: string[]
  startTime: string
  endTime: string
  ignoreScheduleId?: string
}

const ymdPattern = /^\d{4}-\d{2}-\d{2}$/

function isYmd(value: string) {
  return ymdPattern.test(value)
}

function enumerateDateRange(startDate: string, endDate: string) {
  const dates: string[] = []
  const cursor = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return dates
}

function parseScheduleRowInput(input: ScheduleRowInput): {
  value?: ParsedScheduleRowInput
  error?: string
} {
  const operatorEmployeeId = input.operatorEmployeeId?.trim() || null
  const employeeIds = Array.from(
    new Set(
      input.employeeIds.map((employeeId) => employeeId.trim()).filter(Boolean)
    )
  )

  if (
    !input.boothId ||
    !input.date ||
    !input.startTime ||
    !input.endTime ||
    !isYmd(input.date)
  ) {
    return {
      error: "Booth, date, start time, and end time are required.",
    }
  }

  if (operatorEmployeeId && !employeeIds.includes(operatorEmployeeId)) {
    return { error: "Select a POS operator from the assigned employees." }
  }

  if (input.startTime >= input.endTime) {
    return { error: "End time must be later than start time." }
  }

  return {
    value: {
      id: input.id,
      boothId: input.boothId,
      employeeIds,
      operatorEmployeeId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
    },
  }
}

function parseScheduleInput(input: ScheduleFormInput): {
  value?: ParsedScheduleInput
  error?: string
} {
  if ("date" in input && input.id) {
    const rowParsed = parseScheduleRowInput(input)
    if (!rowParsed.value) {
      return { error: rowParsed.error }
    }

    return {
      value: {
        mode: "edit",
        ...rowParsed.value,
      },
    }
  }

  if (
    !("startDate" in input) ||
    !("endDate" in input) ||
    !input.startDate ||
    !input.endDate ||
    !input.startTime ||
    !input.endTime
  ) {
    return {
      error:
        "Booth, employee, date range, start time, and end time are required.",
    }
  }

  const operatorEmployeeId = input.operatorEmployeeId?.trim() || null
  const employeeIds = Array.from(
    new Set(
      input.employeeIds.map((employeeId) => employeeId.trim()).filter(Boolean)
    )
  )

  if (!input.boothId) {
    return {
      error:
        "Booth, date or date range, start time, and end time are required.",
    }
  }

  if (operatorEmployeeId && !employeeIds.includes(operatorEmployeeId)) {
    return { error: "Select a POS operator from the assigned employees." }
  }

  if (input.startTime >= input.endTime) {
    return { error: "End time must be later than start time." }
  }

  if (input.startDate > input.endDate) {
    return { error: "Range end date must be on or after the start date." }
  }

  return {
    value: {
      mode: "create-range",
      boothId: input.boothId,
      employeeIds,
      operatorEmployeeId,
      startDate: input.startDate,
      endDate: input.endDate,
      startTime: input.startTime,
      endTime: input.endTime,
    },
  }
}

function revalidateBoothRoutes(boothIds?: string | string[]) {
  revalidatePath("/admin/booths")
  revalidatePath("/admin/booths/bulk")

  const boothIdList = Array.isArray(boothIds)
    ? boothIds
    : boothIds
      ? [boothIds]
      : []

  Array.from(new Set(boothIdList.filter(Boolean))).forEach((boothId) => {
    revalidatePath(`/admin/booths/${boothId}`)
  })
  revalidatePath("/")
  revalidatePath("/schedule")
  revalidatePath("/shift")
}

async function getScheduleConflictDates(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  input: ScheduleConflictLookupInput
): Promise<{ dates: string[]; error?: string }> {
  if (input.employeeIds.length === 0 || input.targetDates.length === 0) {
    return { dates: [] as string[] }
  }

  const { data, error } = await supabase
    .from("booth_schedule_assignments")
    .select(
      "employee_id, booth_schedules!inner(id, date, start_time, end_time, status)"
    )
    .in("employee_id", input.employeeIds)
    .in("booth_schedules.date", input.targetDates)
    .eq("booth_schedules.status", "scheduled")

  if (error) {
    return { dates: [], error: getActionErrorMessage(error.message) }
  }

  const conflictDates = new Set<string>()

  for (const row of (data ?? []) as EmployeeScheduleConflictRow[]) {
    const schedule = row.booth_schedules
    if (!schedule) {
      continue
    }

    if (input.ignoreScheduleId && schedule.id === input.ignoreScheduleId) {
      continue
    }

    if (
      schedule.start_time < input.endTime &&
      schedule.end_time > input.startTime
    ) {
      conflictDates.add(schedule.date)
    }
  }

  return { dates: Array.from(conflictDates).sort() }
}

function buildScheduleConflictMessage(conflictDates: string[]) {
  const conflictLabel =
    conflictDates.length <= 4
      ? conflictDates.join(", ")
      : `${conflictDates.slice(0, 4).join(", ")}, and ${conflictDates.length - 4} more`

  return `An assigned employee already has an overlapping shift on: ${conflictLabel}.`
}

async function persistScheduleRow(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  row: ParsedScheduleRowInput
) {
  const { data, error } = await supabase.rpc("save_booth_schedule", {
    p_schedule_id: row.id ?? null,
    p_booth_id: row.boothId,
    p_employee_ids: row.employeeIds,
    p_operator_employee_id: row.operatorEmployeeId,
    p_date: row.date,
    p_start_time: row.startTime,
    p_end_time: row.endTime,
    p_current_date: getBusinessDate(),
    p_current_time: getBusinessTime(),
  })

  if (error) {
    return { error: getActionErrorMessage(error.message) }
  }

  return { id: data }
}

function buildBulkEditableRow(
  row: ParsedScheduleRowInput,
  savedId?: string | null
): BulkScheduleEditableRow {
  return {
    id: savedId ?? row.id,
    boothId: row.boothId,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    employeeIds: row.employeeIds,
    operatorEmployeeId: row.operatorEmployeeId,
    startedLocked: Boolean(savedId ?? row.id)
      ? hasBusinessShiftStarted(row.date, row.startTime)
      : false,
  }
}

function getActionErrorMessage(message: string) {
  if (message.includes("ACTIVE_SHIFT_BLOCKS_DEACTIVATION")) {
    return "This booth has an active shift. Finish or cancel that shift before deactivating the booth."
  }
  if (
    message.includes("SCHEDULE_CONFLICT") ||
    message.includes("booth_schedules_employee_times_no_overlap")
  ) {
    return "An assigned employee already has an overlapping shift on that date."
  }
  if (message.includes("SHIFT_EDIT_WINDOW_CLOSED")) {
    return "Started shifts can no longer be edited. You can cancel the shift if needed."
  }
  if (message.includes("SCHEDULE_CANCELLED")) {
    return "Only scheduled shifts can be edited or cancelled."
  }
  if (message.includes("BOOTH_INACTIVE")) {
    return "Only active booths can receive new or updated schedules."
  }
  if (message.includes("EMPLOYEE_INACTIVE")) {
    return "Only active employees can be scheduled."
  }
  if (
    message.includes("INVALID_ASSIGNMENTS") ||
    message.includes("OPERATOR_NOT_ASSIGNED")
  ) {
    return "If you choose a POS operator, they must also be part of the assigned team."
  }
  if (message.includes("LIVE_SHIFT_CORE_FIELDS_LOCKED")) {
    return "Once a shift has started, only the assigned employees and POS operator can be changed."
  }
  if (message.includes("ACTIVE_INITIALIZED_SHIFT_REQUIRED")) {
    return "Stock overrides are available only for an active shift after opening inventory is saved."
  }
  if (message.includes("OVERRIDE_REASON_REQUIRED")) {
    return "Add a reason for this stock override."
  }
  if (message.includes("INVENTORY_STALE")) {
    return "Inventory changed since this form was opened. Refresh and review the latest stock."
  }
  if (message.includes("INVALID_INVENTORY")) {
    return "Enter valid non-negative stock quantities for available products."
  }
  if (message.includes("ADMIN_NOT_AUTHORIZED")) {
    return "Your admin profile could not be verified. Sign out and sign in again."
  }
  if (message.includes("SCHEDULE_NOT_FOUND")) {
    return "This shift no longer exists. Refresh and try again."
  }
  if (message.includes("INVALID_SHIFT_TIME")) {
    return "End time must be later than start time."
  }
  if (message.includes("INVALID_DATE_RANGE")) {
    return "Range end date must be on or after the start date."
  }
  if (
    message.includes("row-level security") ||
    message.includes("violates row-level security")
  ) {
    return "You do not have permission to save this shift. Apply the latest database schema and try again."
  }
  return "Unable to save your changes. Please try again."
}

export async function createBooth(
  input: BoothFormInput
): Promise<AdminActionResult> {
  await requireEmployeeRole("admin")

  const parsed = parseBoothInput(input)
  if (!parsed.value) {
    return { ok: false, error: parsed.error }
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("booths")
    .insert(parsed.value)
    .select("*")
    .single()

  if (error) {
    return { ok: false, error: getActionErrorMessage(error.message) }
  }

  revalidateBoothRoutes()
  return { ok: true, message: "Booth created.", booth: data as Booth }
}

export async function updateBooth(
  input: BoothFormInput
): Promise<AdminActionResult> {
  await requireEmployeeRole("admin")

  if (!input.id) {
    return { ok: false, error: "Booth record is missing." }
  }

  const parsed = parseBoothInput(input)
  if (!parsed.value) {
    return { ok: false, error: parsed.error }
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("booths")
    .update(parsed.value)
    .eq("id", input.id)
    .select("*")
    .single()

  if (error) {
    return { ok: false, error: getActionErrorMessage(error.message) }
  }

  revalidateBoothRoutes(input.id)
  return { ok: true, message: "Booth updated.", booth: data as Booth }
}

export async function deactivateBooth(
  boothId: string
): Promise<AdminActionResult> {
  await requireEmployeeRole("admin")

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase.rpc(
    "deactivate_booth_and_cancel_future_schedules",
    {
      p_booth_id: boothId,
      p_current_date: getBusinessDate(),
      p_current_time: getBusinessTime(),
    }
  )

  if (error) {
    return { ok: false, error: getActionErrorMessage(error.message) }
  }

  revalidateBoothRoutes(boothId)
  const count = data ?? 0
  return {
    ok: true,
    message:
      count === 0
        ? "Booth deactivated."
        : `Booth deactivated and ${count} upcoming shift${count === 1 ? "" : "s"} cancelled.`,
  }
}

export async function reactivateBooth(
  boothId: string
): Promise<AdminActionResult> {
  await requireEmployeeRole("admin")

  if (!boothId.trim()) {
    return { ok: false, error: "Booth record is missing." }
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("booths")
    .update({ is_active: true })
    .eq("id", boothId)
    .select("*")
    .maybeSingle()

  if (error) {
    return { ok: false, error: getActionErrorMessage(error.message) }
  }

  if (!data) {
    return {
      ok: false,
      error: "This booth no longer exists. Refresh and try again.",
    }
  }

  revalidateBoothRoutes(boothId)
  return { ok: true, message: "Booth reactivated.", booth: data as Booth }
}

export async function loadBulkScheduleRows(input: BulkScheduleLoadFilters) {
  await requireEmployeeRole("admin")

  if (
    !isYmd(input.startDate) ||
    !isYmd(input.endDate) ||
    input.startDate > input.endDate
  ) {
    throw new Error("Invalid bulk schedule range.")
  }

  return getBulkEditableScheduleRows(
    input.startDate,
    input.endDate,
    input.boothIds
  )
}

export async function saveBulkScheduleRows(
  rows: BulkScheduleSaveRowInput[]
): Promise<BulkScheduleSaveResult[]> {
  await requireEmployeeRole("admin")

  if (rows.length === 0) {
    return []
  }

  const supabase = createServerSupabaseClient()
  const results: BulkScheduleSaveResult[] = []
  const touchedBoothIds = new Set<string>()

  for (const row of rows) {
    const parsed = parseScheduleRowInput(row)
    if (!parsed.value) {
      results.push({
        rowKey: row.rowKey,
        ok: false,
        error: parsed.error,
      })
      continue
    }

    const conflicts = await getScheduleConflictDates(supabase, {
      employeeIds: parsed.value.employeeIds,
      targetDates: [parsed.value.date],
      startTime: parsed.value.startTime,
      endTime: parsed.value.endTime,
      ignoreScheduleId: parsed.value.id,
    })

    if (conflicts.error) {
      results.push({
        rowKey: row.rowKey,
        ok: false,
        error: conflicts.error,
      })
      continue
    }

    if (conflicts.dates.length > 0) {
      results.push({
        rowKey: row.rowKey,
        ok: false,
        error: buildScheduleConflictMessage(conflicts.dates),
      })
      continue
    }

    const persisted = await persistScheduleRow(supabase, parsed.value)
    if (persisted.error) {
      results.push({
        rowKey: row.rowKey,
        ok: false,
        error: persisted.error,
      })
      continue
    }

    touchedBoothIds.add(parsed.value.boothId)
    results.push({
      rowKey: row.rowKey,
      ok: true,
      row: buildBulkEditableRow(parsed.value, persisted.id),
    })
  }

  if (touchedBoothIds.size > 0) {
    revalidateBoothRoutes(Array.from(touchedBoothIds))
  }

  return results
}

export async function saveBoothSchedule(
  input: ScheduleFormInput
): Promise<AdminActionResult> {
  await requireEmployeeRole("admin")

  const parsed = parseScheduleInput(input)
  const value = parsed.value
  if (!value) {
    return { ok: false, error: parsed.error }
  }

  const supabase = createServerSupabaseClient()
  const targetDates =
    value.mode === "edit"
      ? [value.date]
      : enumerateDateRange(value.startDate, value.endDate)

  const conflicts = await getScheduleConflictDates(supabase, {
    employeeIds: value.employeeIds,
    targetDates,
    startTime: value.startTime,
    endTime: value.endTime,
    ignoreScheduleId: value.mode === "edit" ? value.id : undefined,
  })

  if (conflicts.error) {
    return { ok: false, error: conflicts.error }
  }

  if (conflicts.dates.length > 0) {
    return {
      ok: false,
      error: buildScheduleConflictMessage(conflicts.dates),
    }
  }

  if (value.mode === "edit") {
    const persisted = await persistScheduleRow(supabase, value)
    if (persisted.error) {
      return { ok: false, error: persisted.error }
    }
  } else {
    const rpcResult = await supabase.rpc("save_booth_schedule_range", {
      p_booth_id: value.boothId,
      p_employee_ids: value.employeeIds,
      p_operator_employee_id: value.operatorEmployeeId,
      p_start_date: value.startDate,
      p_end_date: value.endDate,
      p_start_time: value.startTime,
      p_end_time: value.endTime,
      p_current_date: getBusinessDate(),
      p_current_time: getBusinessTime(),
    })

    if (rpcResult.error) {
      return {
        ok: false,
        error: getActionErrorMessage(rpcResult.error.message),
      }
    }
  }

  revalidateBoothRoutes(value.boothId)
  return {
    ok: true,
    message: value.mode === "edit" ? "Shift updated." : "Shifts scheduled.",
  }
}

export async function overrideShiftInventory(
  input: InventoryOverrideInput
): Promise<AdminActionResult> {
  await requireEmployeeRole("admin")

  const reason = input.reason.trim()
  if (!input.scheduleId || !input.boothId || !reason) {
    return { ok: false, error: "Add a reason for this stock override." }
  }

  if (
    input.lines.length === 0 ||
    input.lines.some(
      (line) =>
        !line.productId ||
        !Number.isInteger(line.previousStock) ||
        line.previousStock < 0 ||
        !Number.isInteger(line.resultingStock) ||
        line.resultingStock < 0 ||
        line.previousStock === line.resultingStock
    ) ||
    new Set(input.lines.map((line) => line.productId)).size !==
      input.lines.length
  ) {
    return { ok: false, error: "Change at least one valid stock quantity." }
  }

  const lines = input.lines.map((line) => ({
    product_id: line.productId,
    previous_stock: line.previousStock,
    resulting_stock: line.resultingStock,
  })) as Json

  const supabase = createServerSupabaseClient()
  const { error } = await supabase.rpc("record_admin_inventory_override", {
    p_event_id: crypto.randomUUID(),
    p_schedule_id: input.scheduleId,
    p_reason: reason,
    p_lines: lines,
  })

  if (error) {
    return { ok: false, error: getActionErrorMessage(error.message) }
  }

  revalidateBoothRoutes(input.boothId)
  return { ok: true, message: "Current stock overridden and recorded." }
}

export async function cancelBoothSchedule(
  scheduleId: string,
  boothId: string
): Promise<AdminActionResult> {
  await requireEmployeeRole("admin")

  const supabase = createServerSupabaseClient()
  const { error } = await supabase
    .from("booth_schedules")
    .update({ status: "cancelled" })
    .eq("id", scheduleId)
    .eq("status", "scheduled")

  if (error) {
    return { ok: false, error: getActionErrorMessage(error.message) }
  }

  revalidateBoothRoutes(boothId)
  return {
    ok: true,
    message: "Shift cancelled. Its history has been retained.",
  }
}
