import type {
  AdminEmployeeOption,
  AdminSchedule,
  AdminScheduleCalendarItem,
} from "@/lib/adminBooths"
import type { AdminEmployeeRecord } from "@/lib/adminEmployees"
import type { AdminProductRecord } from "@/lib/adminProducts"
import type { EmployeeRole } from "@/lib/domain-types"
import type { EmployeeApprovalStatus } from "@/lib/employeeApproval"
import type { Booth } from "@/lib/shifts"
import { createClientId } from "./utils"

export type ProductDraftInput = {
  id?: string
  name: string
  price: string
  category: string
  imageUrl: string
  isAvailable: boolean
}

export type EmployeeDraftInput = {
  id?: string
  name: string
  email: string
  role: EmployeeRole
  isActive?: boolean
  approvalStatus?: EmployeeApprovalStatus
}

export type BoothDraftInput = {
  id?: string
  name: string
  locationText: string
  googleMapsUrl: string
  latitude: string
  longitude: string
}

export type ScheduleDraftInput =
  | {
      id: string
      boothId: string
      employeeIds: string[]
      operatorEmployeeId: string | null
      date: string
      startTime: string
      endTime: string
    }
  | {
      id?: undefined
      boothId: string
      employeeIds: string[]
      operatorEmployeeId: string | null
      startDate: string
      endDate: string
      startTime: string
      endTime: string
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

function getBoothSummary(boothId: string, booths: Booth[]) {
  const booth = booths.find((entry) => entry.id === boothId)

  return (
    booth
      ? {
          id: booth.id,
          name: booth.name,
        }
      : {
          id: boothId,
          name: "Unknown booth",
        }
  ) satisfies AdminScheduleCalendarItem["booths"]
}

function getOperatorSummary(
  operatorEmployeeId: string | null,
  employees: AdminEmployeeOption[]
) {
  if (!operatorEmployeeId) {
    return null
  }

  return (
    employees.find((employee) => employee.id === operatorEmployeeId) ?? null
  )
}

function buildAssignments(
  scheduleId: string,
  employeeIds: string[],
  employees: AdminEmployeeOption[]
) {
  return employeeIds.map((employeeId) => ({
    assigned_at: new Date().toISOString(),
    employee_id: employeeId,
    schedule_id: scheduleId,
    employees: employees.find((employee) => employee.id === employeeId) ?? null,
  }))
}

export function buildOptimisticProductRecord(
  input: ProductDraftInput,
  optimisticId: string,
  currentProduct?: AdminProductRecord | null
): AdminProductRecord {
  const parsedPrice = Number.parseFloat(input.price)

  return {
    id: currentProduct?.id ?? optimisticId,
    created_at: currentProduct?.created_at ?? new Date().toISOString(),
    name: input.name.trim() || currentProduct?.name || "",
    price: Number.isFinite(parsedPrice)
      ? Number(parsedPrice.toFixed(2))
      : (currentProduct?.price ?? 0),
    category: input.category.trim() || null,
    image_url: input.imageUrl.trim() || null,
    is_available: input.isAvailable,
  }
}

export function buildOptimisticEmployeeRecord(
  input: EmployeeDraftInput,
  optimisticId: string,
  currentEmployee?: AdminEmployeeRecord | null
): AdminEmployeeRecord {
  return {
    id: currentEmployee?.id ?? optimisticId,
    created_at: currentEmployee?.created_at ?? new Date().toISOString(),
    name: input.name.trim() || currentEmployee?.name || "",
    email: input.email.trim().toLowerCase() || currentEmployee?.email || "",
    role: input.role,
    is_active: input.isActive ?? currentEmployee?.is_active ?? true,
    user_id: currentEmployee?.user_id ?? null,
    approval_status:
      input.approvalStatus ?? currentEmployee?.approval_status ?? "approved",
  }
}

export function buildOptimisticBoothRecord(
  input: BoothDraftInput,
  optimisticId: string,
  currentBooth?: Booth | null
): Booth {
  const parsedLatitude = Number.parseFloat(input.latitude)
  const parsedLongitude = Number.parseFloat(input.longitude)

  return {
    id: currentBooth?.id ?? optimisticId,
    created_at: currentBooth?.created_at ?? new Date().toISOString(),
    is_active: currentBooth?.is_active ?? true,
    name: input.name.trim() || currentBooth?.name || "",
    location_text: input.locationText.trim() || null,
    google_maps_url: input.googleMapsUrl.trim() || null,
    location_lat: Number.isFinite(parsedLatitude) ? parsedLatitude : null,
    location_lng: Number.isFinite(parsedLongitude) ? parsedLongitude : null,
  }
}

export function buildOptimisticScheduleCalendarItems(
  input: ScheduleDraftInput,
  booths: Booth[],
  employees: AdminEmployeeOption[],
  optimisticIds?: string[]
): AdminScheduleCalendarItem[] {
  const dates =
    "date" in input
      ? [input.date]
      : enumerateDateRange(input.startDate, input.endDate)
  const booth = getBoothSummary(input.boothId, booths)
  const operator = getOperatorSummary(input.operatorEmployeeId, employees)
  const createdAt = new Date().toISOString()

  return dates.map((date, index) => {
    const scheduleId =
      "id" in input && input.id
        ? input.id
        : (optimisticIds?.[index] ?? `optimistic-schedule-${createClientId()}`)

    return {
      id: scheduleId,
      booth_id: input.boothId,
      operator_employee_id: input.operatorEmployeeId,
      date,
      start_time: input.startTime,
      end_time: input.endTime,
      status: "scheduled",
      created_at: createdAt,
      booths: booth,
      operator,
      booth_schedule_assignments: buildAssignments(
        scheduleId,
        input.employeeIds,
        employees
      ),
    }
  })
}

export function buildOptimisticAdminSchedules(
  input: ScheduleDraftInput,
  booths: Booth[],
  employees: AdminEmployeeOption[],
  optimisticIds?: string[]
): AdminSchedule[] {
  return buildOptimisticScheduleCalendarItems(
    input,
    booths,
    employees,
    optimisticIds
  ).map((schedule) => ({
    ...schedule,
    booths: booths.find((booth) => booth.id === schedule.booth_id) ?? {
      id: schedule.booths.id,
      created_at: schedule.created_at,
      google_maps_url: null,
      is_active: true,
      location_lat: null,
      location_lng: null,
      location_text: null,
      name: schedule.booths.name,
    },
    booth_schedule_operator_periods: [],
    booth_schedule_products: [],
    inventory_events: [],
    shift_closeouts: [],
  }))
}
