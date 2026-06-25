"use server"

import { revalidatePath } from "next/cache"

import { requireEmployeeRole } from "@/lib/auth.server"
import type { Json } from "@/lib/database.types"
import type { PaymentMethod } from "@/lib/domain-types"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import {
  getPendingApprovalRevenue,
  getShiftApprovalHistory,
} from "@/lib/shiftApprovals"
import {
  getEmployeeBrowsableSaleItems,
  getEmployeeBrowsableShiftDetails,
  getEmployeeScheduleBrowser,
  getSaleItems as getSaleItemsLib,
  getSaleItemsForSales,
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

export type ShiftApprovalResult = ShiftActionResult & {
  approvalId?: string
}

export type CashDeductionRequestInput = {
  scheduleId: string
  amount: number
  reason: string
}

export type SaleChangeAction = "edit_sale" | "delete_sale"

export type SubmitSaleChangeInput = {
  saleId: string
  actionType: SaleChangeAction
  saleUpdatedAt?: string
  reason?: string
  paymentMethod?: PaymentMethod
  receiptPhotoPath?: string | null
  items?: {
    productId: string
    quantity: number
    unitPrice: number
  }[]
}

export type SaleChangeResult = ShiftActionResult & {
  approvalId?: string
  scheduleId?: string
  status?: "pending" | "applied"
}

function getShiftApprovalMessage(
  actionType: string | null | undefined,
  decision: "approved" | "rejected"
) {
  const approved = decision === "approved"

  if (actionType === "cash_deduction") {
    return approved ? "Cash deduction approved." : "Cash deduction rejected."
  }

  if (actionType === "edit_sale" || actionType === "delete_sale") {
    return approved ? "Sale change approved." : "Sale change rejected."
  }

  if (actionType === "apply_promo") {
    return approved ? "Promo request approved." : "Promo request rejected."
  }

  return approved
    ? "Shift reopened from the approval queue."
    : "Reopen request rejected."
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
      const [products, sales, approvalHistory] = await Promise.all([
        getBoothScheduleProducts(scheduleId),
        getBoothScheduleSales(scheduleId),
        getShiftApprovalHistory(scheduleId),
      ])
      const saleItems = await getSaleItemsForSales(sales)
      const pendingRevenue = getPendingApprovalRevenue(approvalHistory)

      return {
        schedule,
        products,
        sales,
        saleItems,
        approvalHistory,
        pendingRevenueIncrease: pendingRevenue.increase,
        pendingRevenueDecrease: pendingRevenue.decrease,
      }
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

  const supabase = await createServerSupabaseClient()
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

  const supabase = await createServerSupabaseClient()
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

export async function requestShiftReopenApproval(
  scheduleId: string
): Promise<ShiftApprovalResult> {
  await requireEmployeeRole(["employee", "admin"])

  if (!scheduleId.trim()) {
    return { ok: false, error: "Shift record is missing." }
  }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc("request_shift_action_approval", {
    p_schedule_id: scheduleId,
    p_action_type: "reopen_shift",
    p_payload: {},
  })

  if (error) {
    if (error.message.includes("SHIFT_NOT_CLOSED")) {
      return {
        ok: false,
        error: "Only closed shifts can be sent for reopen approval.",
      }
    }
    if (error.message.includes("EMPLOYEE_NOT_ASSIGNED")) {
      return {
        ok: false,
        error: "Only assigned employees can request a shift reopen.",
      }
    }
    return { ok: false, error: "Unable to request reopen approval." }
  }

  revalidatePath("/shift")
  revalidatePath(`/shift/${scheduleId}`)
  return {
    ok: true,
    approvalId: typeof data === "string" ? data : undefined,
    message: "Reopen request sent for admin approval.",
  }
}

export async function requestShiftCashDeduction(
  input: CashDeductionRequestInput
): Promise<ShiftApprovalResult> {
  await requireEmployeeRole(["employee", "admin"])

  if (!input.scheduleId.trim()) {
    return { ok: false, error: "Shift record is missing." }
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: "Enter a valid expense amount." }
  }

  if (!input.reason.trim()) {
    return { ok: false, error: "Add a reason for the cash deduction." }
  }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc("request_shift_cash_deduction", {
    p_schedule_id: input.scheduleId,
    p_amount: input.amount,
    p_reason: input.reason.trim(),
  })

  if (error) {
    if (error.message.includes("INVALID_CASH_DEDUCTION_AMOUNT")) {
      return { ok: false, error: "Enter a valid expense amount." }
    }
    if (error.message.includes("CASH_DEDUCTION_REASON_REQUIRED")) {
      return { ok: false, error: "Add a reason for the cash deduction." }
    }
    if (error.message.includes("SHIFT_NOT_OPEN")) {
      return {
        ok: false,
        error: "Cash deductions are only available on unclosed shifts.",
      }
    }
    if (error.message.includes("CASH_DEDUCTION_NOT_ALLOWED")) {
      return {
        ok: false,
        error:
          "Only the current POS operator or an admin can request a cash deduction.",
      }
    }
    return { ok: false, error: "Unable to request this cash deduction." }
  }

  revalidatePath("/")
  revalidatePath("/shift")
  revalidatePath(`/shift/${input.scheduleId}`)
  revalidatePath("/schedule")
  revalidatePath("/admin/booths")
  revalidatePath("/admin/dashboard")
  revalidatePath("/admin/sales")

  return {
    ok: true,
    approvalId: typeof data === "string" ? data : undefined,
    message: "Cash deduction sent for admin approval.",
  }
}

export async function submitSaleChange(
  input: SubmitSaleChangeInput
): Promise<SaleChangeResult> {
  await requireEmployeeRole(["employee", "admin"])

  if (!input.saleId.trim()) {
    return { ok: false, error: "Sale record is missing." }
  }

  if (input.actionType === "edit_sale") {
    if (!input.items || input.items.length === 0) {
      return { ok: false, error: "Add at least one sale item." }
    }

    if (!input.paymentMethod) {
      return { ok: false, error: "Choose a payment method." }
    }
  }

  const payload: Record<string, Json | undefined> = {
    sale_updated_at: input.saleUpdatedAt?.trim() || undefined,
    reason: input.reason?.trim() || undefined,
  }

  if (input.actionType === "edit_sale") {
    payload.payment_method = input.paymentMethod
    payload.receipt_photo_path = input.receiptPhotoPath ?? null
    payload.items = input.items?.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
    }))
  }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc("submit_sale_change", {
    p_sale_id: input.saleId,
    p_action_type: input.actionType,
    p_payload: payload satisfies Json,
  })

  if (error) {
    if (error.message.includes("SALE_NOT_EDITABLE")) {
      return {
        ok: false,
        error: "This sale is no longer available for changes.",
      }
    }
    if (error.message.includes("SALE_SNAPSHOT_REQUIRED")) {
      return {
        ok: false,
        error:
          "This sale is missing its latest version. Refresh and try again.",
      }
    }
    if (error.message.includes("SALE_CHANGE_NOT_ALLOWED")) {
      return {
        ok: false,
        error:
          "Only the current POS operator can request sale changes for this shift.",
      }
    }
    if (error.message.includes("RECEIPT_PHOTO_REQUIRED")) {
      return {
        ok: false,
        error: "Non-cash sales need a receipt photo before saving changes.",
      }
    }
    if (error.message.includes("RECEIPT_PHOTO_NOT_FOUND")) {
      return {
        ok: false,
        error: "The saved receipt photo could not be found.",
      }
    }
    if (
      error.message.includes("INVALID_SALE_ITEMS") ||
      error.message.includes("DUPLICATE_SALE_ITEMS")
    ) {
      return {
        ok: false,
        error: "Review the sale items and try again.",
      }
    }
    if (error.message.includes("INVENTORY_STALE")) {
      return {
        ok: false,
        error:
          "Shift inventory changed before this sale update could be applied. Refresh and try again.",
      }
    }
    if (error.message.includes("SALE_CHANGE_STALE")) {
      return {
        ok: false,
        error: "This sale changed since you opened it. Refresh and try again.",
      }
    }
    return { ok: false, error: "Unable to save this sale change." }
  }

  const result =
    typeof data === "object" && data !== null
      ? (data as {
          approval_id?: string
          schedule_id?: string
          status?: "pending" | "applied"
        })
      : null

  const status = result?.status
  const scheduleId = result?.schedule_id

  if (scheduleId) {
    revalidatePath("/shift")
    revalidatePath(`/shift/${scheduleId}`)
  }
  revalidatePath("/schedule")
  revalidatePath("/admin/booths")
  revalidatePath("/admin/dashboard")
  revalidatePath("/admin/sales")

  return {
    ok: true,
    approvalId: result?.approval_id,
    scheduleId,
    status,
    message:
      status === "pending"
        ? "Sale change sent for admin approval."
        : input.actionType === "delete_sale"
          ? "Sale deleted."
          : "Sale updated.",
  }
}

export async function resolveShiftApproval(
  approvalId: string,
  scheduleId: string,
  boothId?: string
): Promise<ShiftActionResult> {
  await requireEmployeeRole("admin")

  if (!approvalId.trim() || !scheduleId.trim()) {
    return { ok: false, error: "Approval record is missing." }
  }

  const supabase = await createServerSupabaseClient()
  const { data: approval } = await supabase
    .from("shift_action_approvals")
    .select("action_type")
    .eq("id", approvalId)
    .maybeSingle()
  const { error } = await supabase.rpc("resolve_shift_action_approval", {
    p_approval_id: approvalId,
    p_decision: "approved",
  })

  if (error) {
    if (error.message.includes("REOPEN_WINDOW_CLOSED")) {
      return {
        ok: false,
        error: "Only today's closed shifts can be reopened.",
      }
    }
    if (error.message.includes("SHIFT_NOT_OPEN")) {
      return {
        ok: false,
        error:
          "Cash deductions can only be approved while the shift is still open.",
      }
    }
    return { ok: false, error: "Unable to approve this request." }
  }

  revalidatePath("/")
  revalidatePath("/shift")
  revalidatePath(`/shift/${scheduleId}`)
  revalidatePath("/schedule")
  revalidatePath("/admin/booths")
  if (boothId) {
    revalidatePath(`/admin/booths/${boothId}`)
  }
  revalidatePath("/admin/dashboard")
  revalidatePath("/admin/sales")
  return {
    ok: true,
    message: getShiftApprovalMessage(approval?.action_type, "approved"),
  }
}

export async function rejectShiftApproval(
  approvalId: string,
  scheduleId: string,
  boothId?: string
): Promise<ShiftActionResult> {
  await requireEmployeeRole("admin")

  if (!approvalId.trim() || !scheduleId.trim()) {
    return { ok: false, error: "Approval record is missing." }
  }

  const supabase = await createServerSupabaseClient()
  const { data: approval } = await supabase
    .from("shift_action_approvals")
    .select("action_type")
    .eq("id", approvalId)
    .maybeSingle()
  const { error } = await supabase.rpc("resolve_shift_action_approval", {
    p_approval_id: approvalId,
    p_decision: "rejected",
  })

  if (error) {
    return { ok: false, error: "Unable to reject this request." }
  }

  revalidatePath("/shift")
  revalidatePath(`/shift/${scheduleId}`)
  revalidatePath("/schedule")
  revalidatePath("/admin/booths")
  if (boothId) {
    revalidatePath(`/admin/booths/${boothId}`)
  }
  revalidatePath("/admin/dashboard")
  revalidatePath("/admin/sales")
  return {
    ok: true,
    message: getShiftApprovalMessage(approval?.action_type, "rejected"),
  }
}
