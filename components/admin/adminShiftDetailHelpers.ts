import { toast } from "sonner"

import type { ShiftActionResult } from "@/app/actions/shifts"
import type {
  AdminShiftDetailData,
  ShiftApprovalRecord,
} from "@/lib/adminBooths"

type ShiftApprovalAction = (
  approvalId: string,
  scheduleId: string,
  boothId?: string
) => Promise<ShiftActionResult>

export async function fetchAdminShiftDetail(scheduleId: string) {
  const response = await fetch(
    `/api/admin/shifts/${encodeURIComponent(scheduleId)}`,
    { cache: "no-store" }
  )

  if (!response.ok) {
    throw new Error("Unable to load shift details.")
  }

  return (await response.json()) as AdminShiftDetailData
}

export function getPendingReopenApproval(
  detail: AdminShiftDetailData | null
): ShiftApprovalRecord | null {
  return (
    detail?.approvalHistory.find(
      (approval) =>
        approval.action_type === "reopen_shift" && approval.status === "pending"
    ) ?? null
  )
}

export function getPendingReopenApprovalCount(
  detail: AdminShiftDetailData | null
) {
  return (
    detail?.approvalHistory.filter(
      (approval) =>
        approval.action_type === "reopen_shift" && approval.status === "pending"
    ).length ?? 0
  )
}

export async function runBooleanPendingApproval({
  action,
  approvalId,
  boothId,
  errorMessage,
  onSuccess,
  scheduleId,
  setPending,
}: {
  action: ShiftApprovalAction
  approvalId: string
  boothId: string
  errorMessage: string
  onSuccess: () => void
  scheduleId: string
  setPending: (pending: boolean) => void
}) {
  setPending(true)
  const result = await action(approvalId, scheduleId, boothId)
  setPending(false)

  if (!result.ok) {
    toast.error(result.error ?? errorMessage)
    return
  }

  toast.success(result.message)
  onSuccess()
}

export async function runIdPendingApproval({
  action,
  approvalId,
  boothId,
  errorMessage,
  onSuccess,
  scheduleId,
  setPendingId,
}: {
  action: ShiftApprovalAction
  approvalId: string
  boothId: string
  errorMessage: string
  onSuccess: () => void
  scheduleId: string
  setPendingId: (approvalId: string | null) => void
}) {
  setPendingId(approvalId)
  const result = await action(approvalId, scheduleId, boothId)
  setPendingId(null)

  if (!result.ok) {
    toast.error(result.error ?? errorMessage)
    return
  }

  toast.success(result.message)
  onSuccess()
}
