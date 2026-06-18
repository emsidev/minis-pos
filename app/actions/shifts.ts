"use server"

import { revalidatePath } from "next/cache"

import { requireEmployeeRole } from "@/lib/auth"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import {
  getEmployeeSalesHistoryForDate,
  getSaleItems as getSaleItemsLib,
  getBoothScheduleById,
  getBoothScheduleProducts,
  getBoothScheduleSales,
} from "@/lib/shifts"

export type ShiftActionResult = {
  ok: boolean
  error?: string
  message?: string
}

export async function getSaleItems(saleId: string) {
  try {
    return await getSaleItemsLib(saleId)
  } catch (error) {
    console.error("Failed to fetch sale items:", error)
    return []
  }
}

export async function getShiftDetails(scheduleId: string) {
  try {
    const [schedule, products, sales] = await Promise.all([
      getBoothScheduleById(scheduleId),
      getBoothScheduleProducts(scheduleId),
      getBoothScheduleSales(scheduleId),
    ])
    return { schedule, products, sales }
  } catch (error) {
    console.error("Failed to fetch shift details:", error)
    return { schedule: null, products: [], sales: [] }
  }
}

export async function getEmployeeSalesHistory(date: string) {
  const { employee } = await requireEmployeeRole(["employee", "admin"])

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Invalid history date.")
  }

  try {
    return await getEmployeeSalesHistoryForDate(employee.id, date)
  } catch (error) {
    console.error("Failed to fetch employee sales history:", error)
    throw new Error("Unable to load sales history right now.")
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
