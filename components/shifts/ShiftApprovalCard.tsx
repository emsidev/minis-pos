import { Check, Wallet, X } from "lucide-react"

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

type RequestedSaleItem = {
  productId: string
  quantity: number
  unitPrice: number
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

function getRequestedItems(approval: ShiftApprovalRecord): RequestedSaleItem[] {
  const items =
    getPayloadValue(approval, "items") ??
    getPayloadValue(approval, "cart_items")

  if (!Array.isArray(items)) {
    return []
  }

  return items.flatMap((item) => {
    if (!isRecord(item) || typeof item.product_id !== "string") {
      return []
    }

    const quantity =
      typeof item.quantity === "number"
        ? item.quantity
        : Number.parseInt(String(item.quantity ?? 0), 10)
    const unitPrice =
      typeof item.unit_price === "number"
        ? item.unit_price
        : typeof item.base_unit_price === "number"
          ? item.base_unit_price
          : Number.parseFloat(
              String(item.unit_price ?? item.base_unit_price ?? 0)
            )

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return []
    }

    return [
      {
        productId: item.product_id,
        quantity,
        unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      },
    ]
  })
}

function formatSignedCurrency(value: number) {
  if (value === 0) {
    return formatCurrency(0)
  }

  return `${value > 0 ? "+" : "-"}${formatCurrency(Math.abs(value))}`
}

function formatPayment(value: string | null) {
  if (!value) {
    return "Unchanged"
  }

  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatShiftTimestamp(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
  })
}

function getProductName(products: ApprovalProduct[], productId: string) {
  return products.find((product) => product.id === productId)?.name ?? "Product"
}

export function ShiftApprovalCard({
  approval,
  products = [],
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
  const previousPayment = getPayloadString(approval, "previous_payment_method")
  const nextPayment = getPayloadString(approval, "payment_method")
  const requestedItems = getRequestedItems(approval)
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
        "border-border/60 bg-card text-muted-foreground rounded-[var(--radius)] border px-3 py-3 text-sm",
        isPending && "border-amber-500/30 bg-amber-500/5",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-foreground font-medium">
            {isReopenRequest
              ? "Reopen shift request"
              : isCashDeduction
                ? "Cash deduction request"
                : isPromoRequest
                  ? "Promo request"
                  : isSaleDelete
                    ? "Delete sale request"
                    : "Edit sale request"}{" "}
            {!isReopenRequest && !isCashDeduction && !isPromoRequest && saleId
              ? `#${saleId.slice(0, 8)}`
              : ""}
          </p>
          <p className="mt-1 text-xs">
            Requested by {approval.requested_by?.name ?? "Employee"} on{" "}
            {formatShiftTimestamp(approval.created_at)}
          </p>
        </div>
        <Badge
          variant={isPending ? "secondary" : "outline"}
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[0.62rem] font-semibold tracking-wider uppercase",
            isPending && "border-amber-500/25 bg-amber-500/10 text-amber-800"
          )}
        >
          {isPending ? "For approval" : approval.status}
        </Badge>
      </div>

      {isReopenRequest ? (
        <div className="bg-background/70 mt-3 rounded-[calc(var(--radius)-0.2rem)] border border-amber-500/20 px-3 py-2">
          <p className="text-foreground text-sm font-medium">
            Reopen this closed shift so missed sales or stock corrections can be
            entered again.
          </p>
        </div>
      ) : isCashDeduction ? (
        <div className="bg-background/70 mt-3 rounded-[calc(var(--radius)-0.2rem)] border border-amber-500/20 px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-foreground text-sm font-medium">
                Requested expense deduction
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Approved deductions reduce expected drawer cash at closeout.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-amber-800">
              <Wallet className="h-4 w-4" />
              <span className="text-sm font-semibold">
                {formatCurrency(cashDeductionAmount)}
              </span>
            </div>
          </div>
        </div>
      ) : isPromoRequest ? (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="bg-background/80 rounded-[calc(var(--radius)-0.2rem)] px-3 py-2">
              <p className="text-muted-foreground text-[0.62rem] font-semibold tracking-[0.18em] uppercase">
                Promo
              </p>
              <p className="text-foreground mt-1 font-semibold">
                {promoName ?? "Promo"}
              </p>
            </div>
            <div className="bg-background/80 rounded-[calc(var(--radius)-0.2rem)] px-3 py-2">
              <p className="text-muted-foreground text-[0.62rem] font-semibold tracking-[0.18em] uppercase">
                Requested
              </p>
              <p className="text-foreground mt-1 font-semibold">
                {formatCurrency(newTotal)}
              </p>
            </div>
            <div className="bg-background/80 rounded-[calc(var(--radius)-0.2rem)] px-3 py-2">
              <p className="text-muted-foreground text-[0.62rem] font-semibold tracking-[0.18em] uppercase">
                Discount
              </p>
              <p className="text-destructive mt-1 font-semibold">
                {formatSignedCurrency(revenueDelta)}
              </p>
            </div>
          </div>

          {requestedItems.length > 0 ? (
            <div className="bg-background/70 mt-3 rounded-[calc(var(--radius)-0.2rem)] border border-amber-500/20 px-3 py-2">
              <p className="text-foreground text-xs font-semibold tracking-[0.16em] uppercase">
                Cart items
              </p>
              <div className="mt-2 space-y-1.5">
                {requestedItems.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-foreground min-w-0">
                      {item.quantity}x{" "}
                      {getProductName(products, item.productId)}
                    </span>
                    <span className="shrink-0">
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <p className="mt-3 text-xs">Payment: {formatPayment(nextPayment)}</p>
        </>
      ) : (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="bg-background/80 rounded-[calc(var(--radius)-0.2rem)] px-3 py-2">
              <p className="text-muted-foreground text-[0.62rem] font-semibold tracking-[0.18em] uppercase">
                Current
              </p>
              <p className="text-foreground mt-1 font-semibold">
                {formatCurrency(previousTotal)}
              </p>
            </div>
            <div className="bg-background/80 rounded-[calc(var(--radius)-0.2rem)] px-3 py-2">
              <p className="text-muted-foreground text-[0.62rem] font-semibold tracking-[0.18em] uppercase">
                Requested
              </p>
              <p className="text-foreground mt-1 font-semibold">
                {isSaleDelete ? "Delete sale" : formatCurrency(newTotal)}
              </p>
            </div>
            <div className="bg-background/80 rounded-[calc(var(--radius)-0.2rem)] px-3 py-2">
              <p className="text-muted-foreground text-[0.62rem] font-semibold tracking-[0.18em] uppercase">
                Revenue change
              </p>
              <p
                className={cn(
                  "mt-1 font-semibold",
                  revenueDelta < 0 ? "text-destructive" : "text-emerald-600"
                )}
              >
                {formatSignedCurrency(revenueDelta)}
              </p>
            </div>
          </div>

          {requestedItems.length > 0 ? (
            <div className="bg-background/70 mt-3 rounded-[calc(var(--radius)-0.2rem)] border border-amber-500/20 px-3 py-2">
              <p className="text-foreground text-xs font-semibold tracking-[0.16em] uppercase">
                Requested sale items
              </p>
              <div className="mt-2 space-y-1.5">
                {requestedItems.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-foreground min-w-0">
                      {item.quantity}x{" "}
                      {getProductName(products, item.productId)}
                    </span>
                    <span className="shrink-0">
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!isSaleDelete ? (
            <p className="mt-3 text-xs">
              Payment: {formatPayment(previousPayment)} to{" "}
              {formatPayment(nextPayment)}
            </p>
          ) : null}
        </>
      )}

      {reason ? <p className="mt-1 text-xs">Reason: {reason}</p> : null}
      {approval.status !== "pending" && approval.resolved_at ? (
        <p className="mt-1 text-xs">
          {approval.status === "approved" ? "Approved" : "Rejected"} by{" "}
          {approval.resolved_by?.name ?? "Admin"} on{" "}
          {formatShiftTimestamp(approval.resolved_at)}
        </p>
      ) : null}

      {canResolve ? (
        <div className="mt-3 flex flex-wrap gap-2">
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
