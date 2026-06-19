"use server"

import { revalidatePath } from "next/cache"

import { requireEmployeeRole } from "@/lib/auth"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import {
  getEmployeeBrowsableSaleItems,
  getEmployeeBrowsableShiftDetails,
  getEmployeeScheduleBrowser,
  getSaleItems as getSaleItemsLib,
  getBoothScheduleById,
  getBoothScheduleProducts,
  getBoothScheduleSales,
  type ShiftDetailData,
} from "@/lib/shifts"

export type ShiftActionResult = {
  ok: boolean
  error?: string
  message?: string
}

export async function getSaleItems(saleId: string) {
  try {
    const items = await getSaleItemsLib(saleId)
    if (items.length > 0) {
      return items
    }
  } catch (error) {
    console.warn(
      "Assigned sale-item fetch failed, trying browse detail:",
      error
    )
  }

  try {
    return await getEmployeeBrowsableSaleItems(saleId)
  } catch (error) {
    console.error("Failed to fetch sale items:", error)
    return []
  }
}

export async function getShiftDetails(
  scheduleId: string
): Promise<ShiftDetailData> {
  try {
    const schedule = await getBoothScheduleById(scheduleId)
    if (schedule) {
      const [products, sales] = await Promise.all([
        getBoothScheduleProducts(scheduleId),
        getBoothScheduleSales(scheduleId),
      ])
      return { schedule, products, sales }
    }
  } catch (error) {
    console.warn(
      "Assigned shift detail fetch failed, trying browse detail:",
      error
    )
  }

  try {
    return await getEmployeeBrowsableShiftDetails(scheduleId)
  } catch (error) {
    console.error("Failed to fetch shift details:", error)
    return { schedule: null, products: [], sales: [] }
  }
}

export async function loadEmployeeScheduleBrowserItems(
  startDate: string,
  endDate: string
) {
  await requireEmployeeRole(["employee", "admin"])

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endDate) ||
    startDate > endDate
  ) {
    throw new Error("Invalid schedule month range.")
  }

  return getEmployeeScheduleBrowser(startDate, endDate)
}

export async function joinSchedule(
  scheduleId: string
): Promise<ShiftActionResult> {
  await requireEmployeeRole(["employee", "admin"])

  if (!scheduleId.trim()) {
    return { ok: false, error: "Shift record is missing." }
  }

  const supabase = createServerSupabaseClient()
  const { error } = await supabase.rpc("join_booth_schedule", {
    p_schedule_id: scheduleId,
  })

  if (error) {
    if (error.message.includes("SCHEDULE_CONFLICT")) {
      return {
        ok: false,
        error:
          "This shift overlaps with another booth shift already assigned to you.",
      }
    }
    if (error.message.includes("SHIFT_NOT_JOINABLE")) {
      return {
        ok: false,
        error: "This shift is no longer available to join.",
      }
    }
    return { ok: false, error: "Unable to join this shift right now." }
  }

  revalidatePath("/")
  revalidatePath("/schedule")
  revalidatePath("/shift")
  revalidatePath(`/shift/${scheduleId}`)
  return {
    ok: true,
    message: "Shift joined. You can now view it from My Shifts.",
  }
}

export async function claimShiftOperator(
  scheduleId: string
): Promise<ShiftActionResult> {
  await requireEmployeeRole(["employee", "admin"])

  if (!scheduleId) {
    return { ok: false, error: "Shift record is missing." }
  }

  const supabase = createServerSupabaseClient()
  const { error } = await supabase.rpc("claim_shift_operator", {
    p_schedule_id: scheduleId,
  })

  if (error) {
    if (error.message.includes("SHIFT_NOT_ACTIVE")) {
      return { ok: false, error: "This shift is no longer active." }
    }
    if (error.message.includes("EMPLOYEE_NOT_ASSIGNED")) {
      return { ok: false, error: "Only assigned employees can take over POS." }
    }
    return { ok: false, error: "Unable to take over POS right now." }
  }

  revalidatePath("/")
  revalidatePath("/shift")
  revalidatePath(`/shift/${scheduleId}`)
  return { ok: true, message: "You are now the POS operator for this shift." }
}
