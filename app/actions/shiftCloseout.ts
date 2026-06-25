"use server"

import { revalidatePath } from "next/cache"

import { requireEmployeeRole } from "@/lib/auth.server"
import type { Json } from "@/lib/database.types"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export type ShiftCloseoutInput = {
  scheduleId: string
  boothId: string
  countedCashSales: number
  lines: Array<{
    productId: string
    previousStock: number
    resultingStock: number
  }>
}

export type ShiftReopenInput = {
  scheduleId: string
  boothId: string
  reason: string
}

export type ShiftCloseoutActionResult = {
  ok: boolean
  message?: string
  error?: string
}

function revalidateShiftRoutes(scheduleId: string, boothId?: string) {
  revalidatePath("/")
  revalidatePath("/shift")
  revalidatePath(`/shift/${scheduleId}`)
  revalidatePath("/schedule")
  revalidatePath("/admin/dashboard")
  revalidatePath("/admin/booths")
  if (boothId) {
    revalidatePath(`/admin/booths/${boothId}`)
  }
}

function getShiftCloseoutError(message: string) {
  if (message.includes("SHIFT_NOT_ACTIVE_FOR_CLOSEOUT")) {
    return "This shift cannot be closed yet."
  }
  if (message.includes("EMPLOYEE_NOT_OPERATOR")) {
    return "Only the current POS operator or an admin can close this shift."
  }
  if (message.includes("INVALID_CASH_COUNT")) {
    return "Enter a valid counted cash total."
  }
  if (message.includes("CLOSEOUT_LINES_MISMATCH")) {
    return "Review the latest stock first. The closeout list is out of date."
  }
  if (message.includes("INVENTORY_STALE")) {
    return "Stock changed while this form was open. Refresh and recount before closing."
  }
  if (message.includes("PENDING_CASH_DEDUCTIONS")) {
    return "Resolve pending cash deductions before closing this shift."
  }
  if (message.includes("INVENTORY_NOT_INITIALIZED")) {
    return "Opening inventory must be recorded before closeout."
  }
  if (message.includes("REOPEN_REASON_REQUIRED")) {
    return "Add a reason before reopening this shift."
  }
  if (message.includes("SHIFT_NOT_CLOSED")) {
    return "Only closed shifts can be reopened."
  }
  if (message.includes("REOPEN_WINDOW_CLOSED")) {
    return "Only today's closed shifts can be reopened."
  }
  if (message.includes("CLOSEOUT_NOT_FOUND")) {
    return "No closeout record was found for this shift."
  }
  if (message.includes("ADMIN_NOT_AUTHORIZED")) {
    return "Your admin profile could not be verified. Sign out and sign in again."
  }
  if (message.includes("SCHEDULE_NOT_FOUND")) {
    return "This shift no longer exists. Refresh and try again."
  }
  return "Unable to save the shift closeout."
}

export async function closeShift(
  input: ShiftCloseoutInput
): Promise<ShiftCloseoutActionResult> {
  await requireEmployeeRole(["employee", "admin"])

  if (!input.scheduleId || !input.boothId) {
    return { ok: false, error: "Shift record is missing." }
  }

  if (!Number.isFinite(input.countedCashSales) || input.countedCashSales < 0) {
    return { ok: false, error: "Enter a valid counted cash total." }
  }

  if (
    input.lines.length === 0 ||
    input.lines.some(
      (line) =>
        !line.productId ||
        !Number.isInteger(line.previousStock) ||
        line.previousStock < 0 ||
        !Number.isInteger(line.resultingStock) ||
        line.resultingStock < 0
    ) ||
    new Set(input.lines.map((line) => line.productId)).size !==
      input.lines.length
  ) {
    return { ok: false, error: "Review the shift stock before closing." }
  }

  const lines = input.lines.map((line) => ({
    product_id: line.productId,
    previous_stock: line.previousStock,
    resulting_stock: line.resultingStock,
  })) as Json

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.rpc("close_shift", {
    p_schedule_id: input.scheduleId,
    p_counted_cash_sales: input.countedCashSales,
    p_lines: lines,
  })

  if (error) {
    return { ok: false, error: getShiftCloseoutError(error.message) }
  }

  revalidateShiftRoutes(input.scheduleId, input.boothId)
  return { ok: true, message: "Shift closed and reconciled." }
}

export async function reopenShift(
  input: ShiftReopenInput
): Promise<ShiftCloseoutActionResult> {
  await requireEmployeeRole("admin")

  if (!input.scheduleId || !input.boothId) {
    return { ok: false, error: "Shift record is missing." }
  }

  if (!input.reason.trim()) {
    return { ok: false, error: "Add a reason before reopening this shift." }
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.rpc("reopen_shift", {
    p_schedule_id: input.scheduleId,
    p_reason: input.reason.trim(),
  })

  if (error) {
    return { ok: false, error: getShiftCloseoutError(error.message) }
  }

  revalidateShiftRoutes(input.scheduleId, input.boothId)
  return { ok: true, message: "Shift reopened." }
}
