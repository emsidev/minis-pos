import type { Database } from "@/lib/database.types"
import { requireEmployeeRole } from "@/lib/auth"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export type ShiftApprovalEmployee = Pick<
  Database["public"]["Tables"]["employees"]["Row"],
  "id" | "name" | "email"
>

export type ShiftApprovalRecord =
  Database["public"]["Tables"]["shift_action_approvals"]["Row"] & {
    requested_by: ShiftApprovalEmployee | null
    resolved_by: ShiftApprovalEmployee | null
  }

export type ApprovalProduct = Pick<
  Database["public"]["Tables"]["products"]["Row"],
  "id" | "name" | "category" | "price"
>

export type PendingShiftApproval = ShiftApprovalRecord & {
  booth_schedules:
    | (Pick<
        Database["public"]["Tables"]["booth_schedules"]["Row"],
        "id" | "booth_id" | "date" | "start_time" | "end_time" | "status"
      > & {
        booths: Pick<
          Database["public"]["Tables"]["booths"]["Row"],
          "id" | "name" | "location_text"
        > | null
      })
    | null
}

export type PendingShiftApprovalData = {
  approvals: PendingShiftApproval[]
  products: ApprovalProduct[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getRevenueDelta(approval: Pick<ShiftApprovalRecord, "payload">) {
  const payload = isRecord(approval.payload) ? approval.payload : null
  const fallbackPromoDelta = (() => {
    const rawPromoDiscount = payload?.promo_discount_total
    const promoDiscount =
      typeof rawPromoDiscount === "number"
        ? rawPromoDiscount
        : Number.parseFloat(String(rawPromoDiscount ?? 0))

    return Number.isFinite(promoDiscount) ? -promoDiscount : 0
  })()
  const rawValue = payload?.revenue_delta ?? fallbackPromoDelta
  const delta =
    typeof rawValue === "number"
      ? rawValue
      : Number.parseFloat(String(rawValue ?? 0))

  return Number.isFinite(delta) ? delta : 0
}

export function getCashDeductionAmount(
  approval: Pick<ShiftApprovalRecord, "action_type" | "payload">
) {
  if (approval.action_type !== "cash_deduction") {
    return 0
  }

  const payload = isRecord(approval.payload) ? approval.payload : null
  const rawValue = payload?.amount ?? 0
  const amount =
    typeof rawValue === "number"
      ? rawValue
      : Number.parseFloat(String(rawValue ?? 0))

  return Number.isFinite(amount) ? amount : 0
}

function collectProductIds(approvals: Pick<ShiftApprovalRecord, "payload">[]) {
  const ids = new Set<string>()

  for (const approval of approvals) {
    const payload = isRecord(approval.payload) ? approval.payload : null
    const items = [
      ...(Array.isArray(payload?.items) ? payload.items : []),
      ...(Array.isArray(payload?.cart_items) ? payload.cart_items : []),
    ]

    for (const item of items) {
      if (!isRecord(item) || typeof item.product_id !== "string") {
        continue
      }

      ids.add(item.product_id)
    }
  }

  return Array.from(ids)
}

export function getPendingApprovalRevenue(approvals: ShiftApprovalRecord[]) {
  return approvals.reduce(
    (totals, approval) => {
      if (
        approval.status !== "pending" ||
        (approval.action_type !== "edit_sale" &&
          approval.action_type !== "delete_sale" &&
          approval.action_type !== "apply_promo")
      ) {
        return totals
      }

      const delta = getRevenueDelta(approval)

      if (delta > 0) {
        totals.increase += delta
      } else if (delta < 0) {
        totals.decrease += delta
      }

      return totals
    },
    { increase: 0, decrease: 0 }
  )
}

export function getPendingCashDeductionCount(approvals: ShiftApprovalRecord[]) {
  return approvals.filter(
    (approval) =>
      approval.action_type === "cash_deduction" && approval.status === "pending"
  ).length
}

export function getPendingCashDeductionTotal(approvals: ShiftApprovalRecord[]) {
  return approvals.reduce((total, approval) => {
    if (
      approval.action_type !== "cash_deduction" ||
      approval.status !== "pending"
    ) {
      return total
    }

    return total + getCashDeductionAmount(approval)
  }, 0)
}

export function getApprovedCashDeductionTotal(
  approvals: ShiftApprovalRecord[]
) {
  return approvals.reduce((total, approval) => {
    if (
      approval.action_type !== "cash_deduction" ||
      approval.status !== "approved"
    ) {
      return total
    }

    return total + getCashDeductionAmount(approval)
  }, 0)
}

export async function getShiftApprovalHistory(scheduleId: string) {
  if (!scheduleId.trim()) {
    return []
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("shift_action_approvals")
    .select(
      "*, requested_by:employees!shift_action_approvals_requested_by_employee_id_fkey(id, name, email), resolved_by:employees!shift_action_approvals_resolved_by_employee_id_fkey(id, name, email)"
    )
    .eq("schedule_id", scheduleId)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as ShiftApprovalRecord[]
}

export async function getAdminPendingShiftApprovals(): Promise<PendingShiftApprovalData> {
  await requireEmployeeRole("admin")

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("shift_action_approvals")
    .select(
      "*, requested_by:employees!shift_action_approvals_requested_by_employee_id_fkey(id, name, email), resolved_by:employees!shift_action_approvals_resolved_by_employee_id_fkey(id, name, email), booth_schedules(id, booth_id, date, start_time, end_time, status, booths(id, name, location_text))"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const approvals = (data ?? []) as PendingShiftApproval[]
  const productIds = collectProductIds(approvals)

  if (productIds.length === 0) {
    return { approvals, products: [] }
  }

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, category, price")
    .in("id", productIds)

  if (productsError) {
    throw new Error(productsError.message)
  }

  return {
    approvals,
    products: (products ?? []) as ApprovalProduct[],
  }
}
