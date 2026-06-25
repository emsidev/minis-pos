import { Check, X } from "lucide-react"

import type { ApprovalProduct, ShiftApprovalRecord } from "@/lib/shiftApprovals"
import { getCashDeductionAmount } from "@/lib/shiftApprovals"
import { cn, formatCurrency } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type ShiftApprovalCardProps = {
  approval: ShiftApprovalRecord
  products?: ApprovalProduct[]
  resolving?: boolean
  onApprove?: (approvalId: string) => void
  onReject?: (approvalId: string) => void
  className?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getPayloadValue(approval: ShiftApprovalRecord, key: string): unknown {
  return isRecord(approval.payload) ? approval.payload[key] : undefined
}

function getPayloadNumber(approval: ShiftApprovalRecord, key: string) {
  const value = getPayloadValue(approval, key)
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? 0))

  return Number.isFinite(parsed) ? parsed : 0
}

function getPayloadString(approval: ShiftApprovalRecord, key: string) {
  const value = getPayloadValue(approval, key)
  return typeof value === "string" && value.trim() ? value : null
}

export function getApprovalSaleId(approval: ShiftApprovalRecord) {
  return getPayloadString(approval, "sale_id")
}

function getApprovalReason(approval: ShiftApprovalRecord) {
  return getPayloadString(approval, "reason")
}

function getRequestedPromoName(approval: ShiftApprovalRecord) {
  return getPayloadString(approval, "promo_name")
}

function formatSignedCurrency(value: number) {
  if (value === 0) {
    return formatCurrency(0)
  }

  return `${value > 0 ? "+" : "-"}${formatCurrency(Math.abs(value))}`
}

function formatShiftTimestamp(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
  })
}

export function ShiftApprovalCard({
  approval,
  resolving = false,
  onApprove,
  onReject,
  className,
}: ShiftApprovalCardProps) {
  const saleId = getApprovalSaleId(approval)
  const reason = getApprovalReason(approval)
  const previousTotal =
    approval.action_type === "apply_promo"
      ? getPayloadNumber(approval, "subtotal")
      : getPayloadNumber(approval, "previous_total_amount")
  const newTotal =
    approval.action_type === "apply_promo"
      ? getPayloadNumber(approval, "total_amount")
      : getPayloadNumber(approval, "new_total_amount")
  const revenueDelta =
    approval.action_type === "apply_promo"
      ? -getPayloadNumber(approval, "promo_discount_total")
      : getPayloadNumber(approval, "revenue_delta")
  const cashDeductionAmount = getCashDeductionAmount(approval)
  const isPending = approval.status === "pending"
  const isSaleDelete = approval.action_type === "delete_sale"
  const isReopenRequest = approval.action_type === "reopen_shift"
  const isCashDeduction = approval.action_type === "cash_deduction"
  const isPromoRequest = approval.action_type === "apply_promo"
  const promoName = getRequestedPromoName(approval)
  const canResolve = isPending && onApprove && onReject

  return (
    <div
      className={cn(
        "bg-card rounded-[var(--radius)] border p-3 text-sm",
        isPending && "border-amber-500/40 bg-amber-500/5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-foreground font-medium">
            {isReopenRequest
              ? "Reopen shift"
              : isCashDeduction
                ? "Cash deduction"
                : isPromoRequest
                  ? "Promo approval"
                  : isSaleDelete
                    ? "Delete sale"
                    : "Edit sale"}
          </p>

          <p className="text-muted-foreground mt-1 text-xs">
            Requested by {approval.requested_by?.name ?? "Employee"} on{" "}
            {formatShiftTimestamp(approval.created_at)}
          </p>
        </div>

        <Badge variant={isPending ? "secondary" : "outline"}>
          {isPending ? "Pending" : approval.status}
        </Badge>
      </div>

      <div className="bg-background/70 mt-3 rounded-md px-3 py-2">
        {isReopenRequest ? (
          <p>Reopen this closed shift.</p>
        ) : isCashDeduction ? (
          <p>
            Deduct <strong>{formatCurrency(cashDeductionAmount)}</strong> from
            expected cash.
          </p>
        ) : isPromoRequest ? (
          <p>
            Apply <strong>{promoName ?? "promo"}</strong>. New total:{" "}
            <strong>{formatCurrency(newTotal)}</strong>
          </p>
        ) : isSaleDelete ? (
          <p>
            Delete sale <strong>#{saleId?.slice(0, 8)}</strong>. Revenue change:{" "}
            <strong>{formatSignedCurrency(revenueDelta)}</strong>
          </p>
        ) : (
          <p>
            Change sale from <strong>{formatCurrency(previousTotal)}</strong> to{" "}
            <strong>{formatCurrency(newTotal)}</strong>.
          </p>
        )}
      </div>

      {reason ? (
        <p className="text-muted-foreground mt-2 text-xs">Reason: {reason}</p>
      ) : null}

      {approval.status !== "pending" && approval.resolved_at ? (
        <p className="text-muted-foreground mt-2 text-xs">
          {approval.status === "approved" ? "Approved" : "Rejected"} by{" "}
          {approval.resolved_by?.name ?? "Admin"} on{" "}
          {formatShiftTimestamp(approval.resolved_at)}
        </p>
      ) : null}

      {canResolve ? (
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={resolving}
            onClick={() => onApprove(approval.id)}
          >
            <Check data-icon="inline-start" />
            Approve
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={resolving}
            onClick={() => onReject(approval.id)}
          >
            <X data-icon="inline-start" />
            Reject
          </Button>
        </div>
      ) : null}
    </div>
  )
}
