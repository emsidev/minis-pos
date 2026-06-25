import Image from "next/image"
import type { ReactNode } from "react"
import {
  Clock,
  ExternalLink,
  Lock,
  MapPin,
  Package,
  Receipt,
  UserRound,
  Users,
  Wallet,
} from "lucide-react"

import type {
  AdminInventoryEvent,
  AdminOperatorPeriod,
  AdminShiftCloseout,
} from "@/lib/adminBooths"
import { buildBoothMapLink } from "@/lib/boothMaps"
import type { ApprovalProduct, ShiftApprovalRecord } from "@/lib/shiftApprovals"
import {
  getApprovedCashDeductionTotal,
  getPendingCashDeductionCount,
  getPendingCashDeductionTotal,
} from "@/lib/shiftApprovals"
import {
  cn,
  formatCurrency,
  getBoothDisplayName,
  hasBusinessShiftPassed,
} from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  Product,
  SaleItemWithProduct,
  SaleWithJoins,
  SharedBoothSchedule,
} from "@/lib/shifts"
import { ShiftApprovalCard } from "./ShiftApprovalCard"
import { SalesTable } from "./SalesTable"
import { ShiftInventoryEditor } from "./ShiftInventoryEditor"

const paymentMethodLabels = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  maribank: "Maribank",
  unionbank: "UnionBank",
  other: "Other",
} as const

type ShiftDetailViewProps = {
  schedule: SharedBoothSchedule
  products: Product[]
  sales: SaleWithJoins[]
  saleItems: SaleItemWithProduct[]
  isFuture?: boolean
  className?: string
  assignedEmployeeNames?: string[]
  operatorName?: string | null
  availableProducts?: Product[]
  inventoryEmployeeId?: string
  canManageInventory?: boolean
  preferCachedInventoryData?: boolean
  onInventorySavePhaseChange?: (
    phase: "started" | "queued" | "reconciled"
  ) => Promise<void> | void
  canEditReceipts?: boolean
  readOnly?: boolean
  canJoin?: boolean
  joinPending?: boolean
  onJoin?: () => void
  canTakeOver?: boolean
  takeoverPending?: boolean
  onTakeOver?: () => void
  operatorActionLabel?: "Start Shift" | "Take Over POS"
  canCloseShift?: boolean
  onCloseShift?: () => void
  showAdminAudit?: boolean
  inventoryEvents?: AdminInventoryEvent[]
  operatorPeriods?: AdminOperatorPeriod[]
  closeouts?: AdminShiftCloseout[]
  approvalHistory?: ShiftApprovalRecord[]
  approvalProducts?: ApprovalProduct[]
  pendingRevenueIncrease?: number
  pendingRevenueDecrease?: number
  saleActionMode?: "none" | "direct" | "request"
  onSalesChanged?: () => void
  onEdit?: () => void
  onCancel?: () => void
  onDelete?: () => void
  onOverride?: () => void
  onReopen?: () => void
  onAddCashDeduction?: () => void
  cashDeductionPending?: boolean
  onRequestReopenApproval?: () => void
  requestReopenApprovalPending?: boolean
  pendingReopenApprovalCount?: number
  onApproveReopenApproval?: () => void
  onRejectReopenApproval?: () => void
  resolveReopenApprovalPending?: boolean
  onApproveSaleApproval?: (approvalId: string) => void
  onRejectSaleApproval?: (approvalId: string) => void
  resolvingSaleApprovalId?: string | null
  allowOfflineSaleCache?: boolean
}

function formatSignedCurrency(value: number) {
  const absoluteLabel = formatCurrency(Math.abs(value))
  if (value === 0) {
    return absoluteLabel
  }

  return `${value > 0 ? "+" : "-"}${absoluteLabel}`
}

function formatShiftTimestamp(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
  })
}

function getApprovalPayloadValue(
  approval: ShiftApprovalRecord,
  key: string
): unknown {
  if (
    typeof approval.payload !== "object" ||
    approval.payload === null ||
    Array.isArray(approval.payload)
  ) {
    return undefined
  }

  return (approval.payload as Record<string, unknown>)[key]
}

function getApprovalSaleId(approval: ShiftApprovalRecord) {
  const saleId = getApprovalPayloadValue(approval, "sale_id")
  return typeof saleId === "string" ? saleId : null
}

function getStatusBadge(
  isFuture: boolean,
  isCancelled: boolean,
  isClosed: boolean
) {
  if (isCancelled) {
    return (
      <Badge
        variant="destructive"
        className="rounded-full py-0.5 text-[0.6rem] tracking-[0.18em] uppercase"
      >
        Cancelled
      </Badge>
    )
  }

  if (isClosed) {
    return (
      <Badge
        variant="outline"
        className="rounded-full border-emerald-500/20 bg-emerald-500/10 py-0.5 text-[0.6rem] tracking-[0.18em] text-emerald-700 uppercase"
      >
        Closed
      </Badge>
    )
  }

  if (isFuture) {
    return (
      <Badge
        variant="secondary"
        className="border-primary/10 bg-primary/5 text-primary rounded-full py-0.5 text-[0.6rem] tracking-[0.18em] uppercase"
      >
        Upcoming
      </Badge>
    )
  }

  return null
}

type AuditDisclosureProps = {
  title: string
  summary: string
  children: ReactNode
}

function AuditDisclosure({ title, summary, children }: AuditDisclosureProps) {
  return (
    <details className="border-border/60 group bg-card rounded-[calc(var(--radius)+0.05rem)] border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden">
        <div>
          <p className="text-foreground text-sm font-semibold">{title}</p>
          <p className="text-muted-foreground text-xs">{summary}</p>
        </div>
        <span className="text-primary text-xs font-medium transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="border-border/60 border-t px-4 py-4">{children}</div>
    </details>
  )
}

export function ShiftDetailView({
  schedule,
  products,
  sales,
  saleItems,
  isFuture = false,
  className,
  assignedEmployeeNames = [],
  operatorName = null,
  availableProducts = [],
  inventoryEmployeeId,
  canManageInventory = false,
  preferCachedInventoryData = false,
  onInventorySavePhaseChange,
  canEditReceipts = false,
  readOnly = false,
  canJoin = false,
  joinPending = false,
  onJoin,
  canTakeOver = false,
  takeoverPending = false,
  onTakeOver,
  operatorActionLabel = "Take Over POS",
  canCloseShift = false,
  onCloseShift,
  showAdminAudit = false,
  inventoryEvents = [],
  operatorPeriods = [],
  closeouts = [],
  approvalHistory = [],
  approvalProducts = [],
  pendingRevenueIncrease = 0,
  pendingRevenueDecrease = 0,
  saleActionMode = "none",
  onSalesChanged,
  onEdit,
  onCancel,
  onDelete,
  onOverride,
  onReopen,
  onAddCashDeduction,
  cashDeductionPending = false,
  onRequestReopenApproval,
  requestReopenApprovalPending = false,
  pendingReopenApprovalCount = 0,
  onApproveReopenApproval,
  onRejectReopenApproval,
  resolveReopenApprovalPending = false,
  onApproveSaleApproval,
  onRejectSaleApproval,
  resolvingSaleApprovalId = null,
  allowOfflineSaleCache,
}: ShiftDetailViewProps) {
  const totalRevenue = sales.reduce(
    (acc, sale) => acc + Number(sale.total_amount),
    0
  )
  const totalStock = products.reduce(
    (acc, product) => acc + (product.stock ?? 0),
    0
  )
  const paymentBreakdown = Object.entries(paymentMethodLabels).map(
    ([method, label]) => {
      const methodSales = sales.filter((sale) => sale.payment_method === method)

      return {
        method,
        label,
        count: methodSales.length,
        revenue: methodSales.reduce(
          (acc, sale) => acc + Number(sale.total_amount),
          0
        ),
      }
    }
  )
  const productRevenueBreakdown = Array.from(
    saleItems
      .reduce(
        (acc, item) => {
          if (!item.product_id) {
            return acc
          }

          const current = acc.get(item.product_id) ?? {
            productId: item.product_id,
            productName:
              item.products?.name ??
              products.find((product) => product.id === item.product_id)
                ?.name ??
              "Unknown Product",
            quantitySold: 0,
            revenue: 0,
          }

          current.quantitySold += item.quantity
          current.revenue += Number(item.subtotal)
          acc.set(item.product_id, current)
          return acc
        },
        new Map<
          string,
          {
            productId: string
            productName: string
            quantitySold: number
            revenue: number
          }
        >()
      )
      .values()
  ).sort((left, right) => {
    if (right.revenue !== left.revenue) {
      return right.revenue - left.revenue
    }

    if (right.quantitySold !== left.quantitySold) {
      return right.quantitySold - left.quantitySold
    }

    return left.productName.localeCompare(right.productName)
  })
  const hasLowStock = products.some((product) => (product.stock ?? 0) <= 5)
  const isCancelled = schedule.status === "cancelled"
  const isClosed = schedule.status === "closed"
  const hasPassed = hasBusinessShiftPassed(schedule.date, schedule.end_time)
  const saleApprovalHistory = approvalHistory.filter(
    (approval) =>
      approval.action_type === "edit_sale" ||
      approval.action_type === "delete_sale" ||
      approval.action_type === "apply_promo"
  )
  const pendingSaleApprovalHistory = saleApprovalHistory.filter(
    (approval) => approval.status === "pending"
  )
  const resolvedSaleApprovalHistory = saleApprovalHistory.filter(
    (approval) => approval.status !== "pending"
  )
  const pendingReopenApproval =
    approvalHistory.find(
      (approval) =>
        approval.action_type === "reopen_shift" && approval.status === "pending"
    ) ?? null
  const pendingSaleChangeSaleIds = saleApprovalHistory
    .filter((approval) => approval.status === "pending")
    .map((approval) => getApprovalSaleId(approval))
    .filter((saleId): saleId is string => Boolean(saleId))
  const mapLink = buildBoothMapLink(schedule.booths)
  const approvedCashDeductionTotal =
    getApprovedCashDeductionTotal(approvalHistory)
  const pendingCashDeductionTotal =
    getPendingCashDeductionTotal(approvalHistory)
  const pendingCashDeductionCount =
    getPendingCashDeductionCount(approvalHistory)
  const cashDeductionHistory = approvalHistory.filter(
    (approval) => approval.action_type === "cash_deduction"
  )
  const pendingCashDeductionHistory = cashDeductionHistory.filter(
    (approval) => approval.status === "pending"
  )
  const resolvedCashDeductionHistory = cashDeductionHistory.filter(
    (approval) => approval.status !== "pending"
  )
  const inventorySetupCount = products.length
  const openingStock = products.reduce(
    (acc, product) => acc + (product.quantity ?? 0),
    0
  )
  const scheduleCloseouts = schedule.shift_closeouts ?? []
  const latestCloseout =
    (closeouts.length > 0 ? closeouts : scheduleCloseouts)
      .slice()
      .sort((left, right) =>
        right.closed_at.localeCompare(left.closed_at)
      )[0] ?? null
  const showCloseShiftAction =
    !isCancelled && !isClosed && Boolean(canCloseShift && onCloseShift)
  const showEditAction = !isCancelled && !isClosed && Boolean(onEdit)
  const showCancelAction =
    !isCancelled && !isClosed && !hasPassed && Boolean(onCancel)
  const showDeleteAction = Boolean(onDelete)
  const showCashDeductionAction =
    !isCancelled && !isClosed && Boolean(onAddCashDeduction)
  const hasPrimaryActions =
    Boolean(mapLink) ||
    Boolean(canJoin && onJoin) ||
    Boolean(canTakeOver && onTakeOver) ||
    showCashDeductionAction ||
    showCloseShiftAction ||
    showEditAction ||
    showCancelAction ||
    showDeleteAction ||
    Boolean(onOverride) ||
    Boolean(onReopen) ||
    Boolean(onRequestReopenApproval) ||
    Boolean(onApproveReopenApproval) ||
    Boolean(onRejectReopenApproval)
  const showApprovalSummary =
    pendingCashDeductionCount > 0 ||
    pendingSaleApprovalHistory.length > 0 ||
    Boolean(pendingReopenApproval) ||
    pendingRevenueIncrease !== 0 ||
    pendingRevenueDecrease !== 0
  const showPendingRevenueCards =
    showAdminAudit ||
    pendingSaleApprovalHistory.length > 0 ||
    Boolean(pendingReopenApproval) ||
    pendingRevenueIncrease !== 0 ||
    pendingRevenueDecrease !== 0

  return (
    <div className={cn("app-page flex min-h-full flex-col", className)}>
      <div className="flex-1 space-y-4 px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
        <section className="border-border/60 bg-card overflow-hidden rounded-[calc(var(--radius)+0.2rem)] border">
          <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-foreground truncate text-xl font-semibold tracking-tight">
                    {getBoothDisplayName(schedule.booths)}
                  </h1>
                  {getStatusBadge(isFuture, isCancelled, isClosed)}
                </div>

                <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Clock className="text-primary h-3.5 w-3.5" />
                    {schedule.date} / {schedule.start_time.slice(0, 5)} -{" "}
                    {schedule.end_time.slice(0, 5)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="text-primary h-3.5 w-3.5" />
                    {schedule.booths.location_text || "No location saved"}
                  </span>
                </div>
              </div>

              {mapLink ? (
                <a
                  href={mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-border/70 text-primary hover:bg-muted inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                >
                  Map
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </div>

            {isCancelled ? (
              <div className="border-destructive/20 bg-destructive/5 text-destructive rounded-[var(--radius)] border px-3 py-2.5 text-sm">
                This assignment was cancelled and cannot be used for Counter
                sales.
              </div>
            ) : null}

            {isClosed ? (
              <div className="rounded-[var(--radius)] border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-800">
                <p className="font-medium text-emerald-900">
                  This shift has been closed and locked from Counter access.
                </p>
                {onReopen ? (
                  <p className="mt-1 text-xs sm:text-sm">
                    Reopen this shift first if you need to add a missed sale or
                    correct stock.
                  </p>
                ) : null}
                {latestCloseout ? (
                  <p className="mt-1 text-xs sm:text-sm">
                    Closed {formatShiftTimestamp(latestCloseout.closed_at)} /
                    Cash variance{" "}
                    {formatSignedCurrency(Number(latestCloseout.cash_variance))}{" "}
                    / Stock variance{" "}
                    {Number(latestCloseout.stock_variance) > 0 ? "+" : ""}
                    {latestCloseout.stock_variance}
                  </p>
                ) : null}
                {pendingReopenApprovalCount > 0 ? (
                  <p className="mt-1 text-xs sm:text-sm">
                    {pendingReopenApprovalCount} reopen request
                    {pendingReopenApprovalCount === 1 ? "" : "s"} waiting for
                    admin approval.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
              <div className="border-border/60 bg-surface-container-low/35 rounded-[var(--radius)] border px-4 py-4">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-muted-foreground flex items-center gap-2 text-[0.68rem] font-semibold tracking-[0.2em] uppercase">
                      <Users className="text-primary h-3.5 w-3.5" />
                      Assigned Employees
                    </dt>
                    <dd className="text-foreground mt-1 text-sm">
                      {assignedEmployeeNames.length > 0
                        ? assignedEmployeeNames.join(", ")
                        : "No employees assigned yet"}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-muted-foreground flex items-center gap-2 text-[0.68rem] font-semibold tracking-[0.2em] uppercase">
                      <UserRound className="text-primary h-3.5 w-3.5" />
                      POS Operator
                    </dt>
                    <dd className="text-foreground mt-1 text-sm">
                      {operatorName ?? "Not selected yet"}
                    </dd>
                  </div>
                </dl>

                <div className="bg-background/80 mt-4 rounded-[var(--radius)] px-3 py-3">
                  <p className="text-muted-foreground text-[0.68rem] font-semibold tracking-[0.2em] uppercase">
                    Shift Setup
                  </p>
                  <p className="text-foreground mt-1 text-sm font-medium">
                    {inventorySetupCount > 0
                      ? `${inventorySetupCount} products assigned with ${openingStock} opening stock`
                      : "Inventory will be assigned when the shift starts"}
                  </p>
                  {inventorySetupCount > 0 ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Current stock across the shift: {totalStock}
                    </p>
                  ) : null}
                </div>
              </div>

              <div
                className={cn(
                  "grid gap-2",
                  showAdminAudit ? "grid-cols-2 xl:grid-cols-3" : "grid-cols-2"
                )}
              >
                <div className="border-border/60 bg-card rounded-[var(--radius)] border px-3 py-3">
                  <p className="text-muted-foreground text-[0.68rem] font-semibold tracking-[0.18em] uppercase">
                    Revenue
                  </p>
                  <p className="text-foreground mt-2 text-lg font-semibold">
                    {isFuture ? "Pending" : formatCurrency(totalRevenue)}
                  </p>
                </div>
                <div className="border-border/60 bg-card rounded-[var(--radius)] border px-3 py-3">
                  <p className="text-muted-foreground text-[0.68rem] font-semibold tracking-[0.18em] uppercase">
                    Sales
                  </p>
                  <p className="text-foreground mt-2 text-lg font-semibold">
                    {isFuture ? "Pending" : sales.length}
                  </p>
                </div>
                <div className="border-border/60 bg-card rounded-[var(--radius)] border px-3 py-3">
                  <p className="text-muted-foreground text-[0.68rem] font-semibold tracking-[0.18em] uppercase">
                    Products
                  </p>
                  <p className="text-foreground mt-2 text-lg font-semibold">
                    {products.length}
                  </p>
                </div>
                <div className="border-border/60 bg-card rounded-[var(--radius)] border px-3 py-3">
                  <p className="text-muted-foreground text-[0.68rem] font-semibold tracking-[0.18em] uppercase">
                    Stock
                  </p>
                  <p
                    className={cn(
                      "mt-2 text-lg font-semibold",
                      isFuture
                        ? "text-muted-foreground"
                        : hasLowStock
                          ? "text-destructive"
                          : "text-emerald-600"
                    )}
                  >
                    {isFuture ? "Pending" : hasLowStock ? "Low" : "Healthy"}
                  </p>
                </div>
                {approvedCashDeductionTotal > 0 ||
                pendingCashDeductionTotal > 0 ? (
                  <div className="border-border/60 bg-card rounded-[var(--radius)] border px-3 py-3">
                    <p className="text-muted-foreground text-[0.68rem] font-semibold tracking-[0.18em] uppercase">
                      Cash Out
                    </p>
                    <p className="text-foreground mt-2 text-lg font-semibold">
                      {formatCurrency(approvedCashDeductionTotal)}
                    </p>
                    {pendingCashDeductionTotal > 0 ? (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {pendingCashDeductionCount} pending /{" "}
                        {formatCurrency(pendingCashDeductionTotal)}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {showPendingRevenueCards ? (
                  <div className="border-border/60 bg-card rounded-[var(--radius)] border px-3 py-3">
                    <p className="text-muted-foreground text-[0.68rem] font-semibold tracking-[0.18em] uppercase">
                      Pending +
                    </p>
                    <p className="mt-2 text-lg font-semibold text-emerald-600">
                      {formatSignedCurrency(pendingRevenueIncrease)}
                    </p>
                  </div>
                ) : null}
                {showPendingRevenueCards ? (
                  <div className="border-border/60 bg-card rounded-[var(--radius)] border px-3 py-3">
                    <p className="text-muted-foreground text-[0.68rem] font-semibold tracking-[0.18em] uppercase">
                      Pending -
                    </p>
                    <p className="text-destructive mt-2 text-lg font-semibold">
                      {formatSignedCurrency(pendingRevenueDecrease)}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            {showCloseShiftAction ? (
              <div className="border-primary/15 bg-primary/5 text-muted-foreground flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border px-3 py-3 text-sm">
                <div className="flex items-start gap-2">
                  <Lock className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    Count final cash and remaining stock to lock this shift for
                    the day.
                  </p>
                </div>
              </div>
            ) : null}

            {readOnly ? (
              <div className="border-primary/10 bg-primary/5 text-muted-foreground rounded-[var(--radius)] border px-3 py-3 text-sm">
                <p>
                  {canJoin
                    ? "You are previewing this shift. Join it to manage POS, inventory, and closeout."
                    : "You can review this shift here, but only joined employees can manage POS, inventory, or closeout."}
                </p>
              </div>
            ) : null}

            {canTakeOver && onTakeOver ? (
              <div className="border-primary/10 bg-primary/5 text-muted-foreground rounded-[var(--radius)] border px-3 py-3 text-sm">
                <p>
                  {operatorActionLabel === "Start Shift"
                    ? "Start this shift to enter opening inventory and use Counter."
                    : "You can view this shared shift. Take over POS to enter sales."}
                </p>
              </div>
            ) : null}
          </div>
        </section>

        {canManageInventory && inventoryEmployeeId ? (
          <section className="border-border/60 bg-card rounded-[calc(var(--radius)+0.1rem)] border px-4 py-4 sm:px-5">
            <div className="mb-4">
              <p className="text-muted-foreground text-[0.68rem] font-semibold tracking-[0.2em] uppercase">
                Shift Inventory
              </p>
              <h2 className="text-foreground mt-1 text-base font-semibold">
                Manage Assigned Products
              </h2>
            </div>
            <ShiftInventoryEditor
              schedule={schedule}
              inventoryProducts={products}
              availableProducts={availableProducts}
              employeeId={inventoryEmployeeId}
              compact
              preferCachedData={preferCachedInventoryData}
              onSavePhaseChange={onInventorySavePhaseChange}
            />
          </section>
        ) : null}

        <section className="border-border/60 bg-card rounded-[calc(var(--radius)+0.1rem)] border px-4 py-4 sm:px-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-muted-foreground text-[0.68rem] font-semibold tracking-[0.2em] uppercase">
                Inventory
              </p>
              <h2 className="text-foreground mt-1 text-base font-semibold">
                Products In Shift
              </h2>
            </div>
            {!isFuture ? (
              <div className="border-border/70 bg-surface-container-low/50 text-foreground rounded-full border px-3 py-1 text-xs font-semibold">
                Total Stock: {totalStock}
              </div>
            ) : null}
          </div>

          {isFuture ? (
            <div className="border-border/70 flex items-center justify-center gap-2 rounded-[var(--radius)] border border-dashed py-6 text-center">
              <Package className="text-primary/30 h-5 w-5" />
              <p className="text-muted-foreground text-sm">
                Inventory assigned when shift starts
              </p>
            </div>
          ) : products.length === 0 ? (
            <div className="border-border/70 flex items-center justify-center gap-2 rounded-[var(--radius)] border border-dashed py-6">
              <Package className="text-primary/30 h-5 w-5" />
              <p className="text-muted-foreground text-sm">
                No products assigned
              </p>
            </div>
          ) : (
            <div className="border-border/60 overflow-hidden rounded-[var(--radius)] border">
              <Table>
                <TableHeader className="bg-surface-container-low">
                  <TableRow>
                    <TableHead className="w-8 p-0" />
                    <TableHead className="text-[0.68rem] tracking-[0.2em] uppercase">
                      Product
                    </TableHead>
                    <TableHead className="text-right text-[0.68rem] tracking-[0.2em] uppercase">
                      Price
                    </TableHead>
                    <TableHead className="text-right text-[0.68rem] tracking-[0.2em] uppercase">
                      Stock
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const stock = product.stock ?? 0

                    return (
                      <TableRow
                        key={product.id}
                        className="hover:bg-surface-container-low/45"
                      >
                        <TableCell className="p-1.5 pl-3">
                          <div className="bg-surface-container relative h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                            {product.image_url ? (
                              <Image
                                src={product.image_url}
                                alt={product.name}
                                fill
                                sizes="36px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="text-primary/40 flex h-full w-full items-center justify-center">
                                <Package className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-foreground text-sm leading-tight font-semibold">
                            {product.name}
                          </p>
                          <p className="text-muted-foreground text-[0.7rem]">
                            {product.category || "Artisanal"}
                          </p>
                        </TableCell>
                        <TableCell className="text-primary text-right text-sm font-medium">
                          {formatCurrency(Number(product.price))}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={stock <= 5 ? "destructive" : "secondary"}
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[0.62rem] font-semibold tracking-[0.18em] uppercase",
                              stock > 5 && "bg-primary/10 text-primary"
                            )}
                          >
                            {stock}/{product.quantity ?? 0}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <section className="border-border/60 bg-card rounded-[calc(var(--radius)+0.1rem)] border px-4 py-4 sm:px-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-muted-foreground text-[0.68rem] font-semibold tracking-[0.2em] uppercase">
                Sales
              </p>
              <h2 className="text-foreground mt-1 text-base font-semibold">
                Shift Transactions
              </h2>
            </div>
            {!isFuture ? (
              <div className="border-primary/15 bg-primary/5 text-primary rounded-full border px-3 py-1 text-xs font-semibold">
                Total Revenue: {formatCurrency(totalRevenue)}
              </div>
            ) : null}
          </div>

          {isFuture ? (
            <div className="border-border/70 flex items-center justify-center gap-2 rounded-[var(--radius)] border border-dashed py-6 text-center">
              <Receipt className="text-primary/30 h-5 w-5" />
              <p className="text-muted-foreground text-sm">
                Sales will appear after transactions
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="border-border/60 rounded-[var(--radius)] border">
                  <div className="border-border/60 bg-surface-container-low/45 border-b px-3 py-2">
                    <h3 className="text-foreground text-sm font-semibold">
                      Revenue By Payment
                    </h3>
                  </div>
                  <div className="divide-border/60 divide-y">
                    {paymentBreakdown.map((entry) => (
                      <div
                        key={entry.method}
                        className="flex items-center justify-between gap-3 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-foreground text-sm font-medium">
                            {entry.label}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {entry.count} sale
                            {entry.count === 1 ? "" : "s"}
                          </p>
                        </div>
                        <p className="text-foreground text-sm font-semibold">
                          {formatCurrency(entry.revenue)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-border/60 rounded-[var(--radius)] border">
                  <div className="border-border/60 bg-surface-container-low/45 border-b px-3 py-2">
                    <h3 className="text-foreground text-sm font-semibold">
                      Revenue By Product
                    </h3>
                  </div>
                  {productRevenueBreakdown.length === 0 ? (
                    <div className="px-3 py-6 text-center">
                      <p className="text-muted-foreground text-sm">
                        No product sales recorded yet.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-border/60 divide-y">
                      {productRevenueBreakdown.map((entry) => (
                        <div
                          key={entry.productId}
                          className="flex items-center justify-between gap-3 px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-foreground truncate text-sm font-medium">
                              {entry.productName}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {entry.quantitySold} sold
                            </p>
                          </div>
                          <p className="text-foreground text-sm font-semibold">
                            {formatCurrency(entry.revenue)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <SalesTable
                sales={sales}
                products={products}
                allowOfflineCache={allowOfflineSaleCache ?? !readOnly}
                canEditReceipts={canEditReceipts}
                saleActionMode={saleActionMode}
                pendingSaleChangeSaleIds={pendingSaleChangeSaleIds}
                onSalesChanged={onSalesChanged}
              />
            </div>
          )}
        </section>

        {showApprovalSummary ? (
          <section className="border-border/60 bg-card space-y-3 rounded-[calc(var(--radius)+0.1rem)] border px-4 py-4 sm:px-5">
            <div>
              <p className="text-muted-foreground text-[0.68rem] font-semibold tracking-[0.2em] uppercase">
                Approval Requests
              </p>
              <h2 className="text-foreground mt-1 text-base font-semibold">
                Pending Changes
              </h2>
            </div>

            {pendingReopenApproval ? (
              <ShiftApprovalCard
                approval={pendingReopenApproval}
                resolving={resolveReopenApprovalPending}
                onApprove={
                  onApproveReopenApproval
                    ? () => {
                        onApproveReopenApproval()
                      }
                    : undefined
                }
                onReject={
                  onRejectReopenApproval
                    ? () => {
                        onRejectReopenApproval()
                      }
                    : undefined
                }
              />
            ) : null}

            {pendingCashDeductionHistory.map((approval) => (
              <ShiftApprovalCard
                key={approval.id}
                approval={approval}
                resolving={resolvingSaleApprovalId === approval.id}
                onApprove={onApproveSaleApproval}
                onReject={onRejectSaleApproval}
              />
            ))}

            {pendingSaleApprovalHistory.map((approval) => (
              <ShiftApprovalCard
                key={approval.id}
                approval={approval}
                products={approvalProducts}
                resolving={resolvingSaleApprovalId === approval.id}
                onApprove={onApproveSaleApproval}
                onReject={onRejectSaleApproval}
              />
            ))}
          </section>
        ) : null}

        {showAdminAudit ? (
          <section className="border-border/60 bg-card space-y-3 rounded-[calc(var(--radius)+0.1rem)] border px-4 py-4 sm:px-5">
            <div>
              <p className="text-muted-foreground text-[0.68rem] font-semibold tracking-[0.2em] uppercase">
                Admin Audit
              </p>
              <h2 className="text-foreground mt-1 text-base font-semibold">
                History And Controls
              </h2>
            </div>

            <AuditDisclosure
              title="Inventory History"
              summary={
                inventoryEvents.length > 0
                  ? `${inventoryEvents.length} recorded inventory event${inventoryEvents.length === 1 ? "" : "s"}`
                  : "No inventory history recorded yet"
              }
            >
              {inventoryEvents.length > 0 ? (
                <div className="space-y-3">
                  {inventoryEvents
                    .slice()
                    .sort((left, right) =>
                      right.occurred_at.localeCompare(left.occurred_at)
                    )
                    .map((inventoryEvent) => (
                      <div
                        key={inventoryEvent.id}
                        className="border-border/60 text-muted-foreground rounded-[var(--radius)] border px-3 py-3 text-sm"
                      >
                        <p className="text-foreground font-medium">
                          {inventoryEvent.event_type === "opening"
                            ? "Opening inventory"
                            : inventoryEvent.event_type === "adjustment"
                              ? "Employee adjustment"
                              : inventoryEvent.event_type === "closeout"
                                ? "Shift closeout"
                                : "Admin override"}{" "}
                          by {inventoryEvent.actors?.name ?? "Employee"}
                        </p>
                        <p className="mt-1 text-xs">
                          {formatShiftTimestamp(inventoryEvent.occurred_at)}
                        </p>
                        {inventoryEvent.reason ? (
                          <p className="mt-1">
                            Reason: {inventoryEvent.reason}
                          </p>
                        ) : null}
                        <p className="mt-2 text-xs leading-5">
                          {inventoryEvent.inventory_event_lines
                            .map(
                              (line) =>
                                `${line.products?.name ?? "Product"} ${line.previous_stock} to ${line.resulting_stock}`
                            )
                            .join(", ")}
                        </p>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Activity will appear here once opening inventory or overrides
                  are recorded.
                </p>
              )}
            </AuditDisclosure>

            <AuditDisclosure
              title="Sales Activity"
              summary={
                resolvedSaleApprovalHistory.length > 0
                  ? `${resolvedSaleApprovalHistory.length} resolved request${resolvedSaleApprovalHistory.length === 1 ? "" : "s"}`
                  : "No sale or promo requests recorded yet"
              }
            >
              {resolvedSaleApprovalHistory.length > 0 ? (
                <div className="space-y-3">
                  {resolvedSaleApprovalHistory.map((approval) => (
                    <ShiftApprovalCard
                      key={approval.id}
                      approval={approval}
                      products={approvalProducts}
                      resolving={resolvingSaleApprovalId === approval.id}
                      onApprove={onApproveSaleApproval}
                      onReject={onRejectSaleApproval}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Sale edits, promo requests, approvals, and rejections will
                  appear here after the first request is submitted.
                </p>
              )}
            </AuditDisclosure>

            <AuditDisclosure
              title="Cash Deductions"
              summary={
                resolvedCashDeductionHistory.length > 0
                  ? `${resolvedCashDeductionHistory.length} resolved cash deduction${resolvedCashDeductionHistory.length === 1 ? "" : "s"}`
                  : "No cash deductions recorded yet"
              }
            >
              {resolvedCashDeductionHistory.length > 0 ? (
                <div className="space-y-3">
                  {resolvedCashDeductionHistory.map((approval) => (
                    <ShiftApprovalCard
                      key={approval.id}
                      approval={approval}
                      resolving={resolvingSaleApprovalId === approval.id}
                      onApprove={onApproveSaleApproval}
                      onReject={onRejectSaleApproval}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Approved and rejected shift expense deductions will appear
                  here after the first request is submitted.
                </p>
              )}
            </AuditDisclosure>

            <AuditDisclosure
              title="POS Handoffs"
              summary={
                operatorPeriods.length > 1
                  ? `${operatorPeriods.length} operator periods recorded`
                  : operatorPeriods.length === 1
                    ? "No POS handoff recorded yet"
                    : "No operator history recorded yet"
              }
            >
              {operatorPeriods.length > 0 ? (
                <div className="space-y-3">
                  {operatorPeriods
                    .slice()
                    .sort((left, right) =>
                      right.starts_at.localeCompare(left.starts_at)
                    )
                    .map((period) => (
                      <div
                        key={period.id}
                        className="border-border/60 text-muted-foreground rounded-[var(--radius)] border px-3 py-3 text-sm"
                      >
                        <p className="text-foreground font-medium">
                          {period.operator?.name ?? "Employee"}
                        </p>
                        <p className="mt-1 text-xs">
                          Started {formatShiftTimestamp(period.starts_at)}
                        </p>
                        {period.ends_at ? (
                          <p className="mt-1 text-xs">
                            Ended {formatShiftTimestamp(period.ends_at)}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs">
                            Current operator period
                          </p>
                        )}
                        {period.initiated_by?.name ? (
                          <p className="mt-2">
                            Initiated by {period.initiated_by.name}
                          </p>
                        ) : null}
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Operator changes will appear here once POS handoffs happen.
                </p>
              )}
            </AuditDisclosure>

            <AuditDisclosure
              title="Closeout And Reopen History"
              summary={
                closeouts.length > 0
                  ? `${closeouts.length} closeout record${closeouts.length === 1 ? "" : "s"}`
                  : "No closeout history recorded yet"
              }
            >
              {closeouts.length > 0 ? (
                <div className="space-y-3">
                  {closeouts
                    .slice()
                    .sort((left, right) =>
                      right.closed_at.localeCompare(left.closed_at)
                    )
                    .map((closeout) => (
                      <div
                        key={closeout.id}
                        className="border-border/60 text-muted-foreground rounded-[var(--radius)] border px-3 py-3 text-sm"
                      >
                        <p className="text-foreground font-medium">
                          Closed by {closeout.closed_by?.name ?? "Employee"}
                        </p>
                        <p className="mt-1 text-xs">
                          {formatShiftTimestamp(closeout.closed_at)}
                        </p>
                        <p className="mt-2">
                          Cash:{" "}
                          {formatCurrency(Number(closeout.system_cash_sales))}{" "}
                          gross /{" "}
                          {formatCurrency(
                            Number(closeout.cash_deductions_total)
                          )}{" "}
                          deductions /{" "}
                          {formatCurrency(
                            Number(closeout.system_cash_sales) -
                              Number(closeout.cash_deductions_total)
                          )}{" "}
                          expected /{" "}
                          {formatCurrency(Number(closeout.counted_cash_sales))}{" "}
                          counted /{" "}
                          {formatSignedCurrency(Number(closeout.cash_variance))}{" "}
                          variance
                        </p>
                        <p className="mt-1">
                          Stock: {closeout.system_stock_total} system /{" "}
                          {closeout.counted_stock_total} counted /{" "}
                          {Number(closeout.stock_variance) > 0 ? "+" : ""}
                          {closeout.stock_variance} variance
                        </p>
                        {closeout.reopened_at ? (
                          <p className="mt-2">
                            Reopened by {closeout.reopened_by?.name ?? "Admin"}{" "}
                            on {formatShiftTimestamp(closeout.reopened_at)}.
                            Reason: {closeout.reopen_reason}
                          </p>
                        ) : null}
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Closeout activity will appear here after the shift is closed.
                </p>
              )}
            </AuditDisclosure>
          </section>
        ) : null}
      </div>

      {hasPrimaryActions ? (
        <footer className="border-border/70 bg-background/95 supports-[backdrop-filter]:bg-background/85 sticky bottom-0 z-20 border-t px-4 py-3 backdrop-blur sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            {mapLink ? (
              <Button
                variant="outline"
                size="sm"
                render={
                  <a href={mapLink} target="_blank" rel="noopener noreferrer" />
                }
                nativeButton={false}
              >
                <MapPin data-icon="inline-start" />
                Map
              </Button>
            ) : null}

            {canJoin && onJoin ? (
              <Button
                type="button"
                size="sm"
                disabled={joinPending}
                onClick={onJoin}
              >
                Join Shift
              </Button>
            ) : null}

            {canTakeOver && onTakeOver ? (
              <Button
                type="button"
                size="sm"
                disabled={takeoverPending}
                onClick={onTakeOver}
              >
                {operatorActionLabel}
              </Button>
            ) : null}

            {showCashDeductionAction ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={cashDeductionPending}
                onClick={onAddCashDeduction}
              >
                <Wallet data-icon="inline-start" />
                Cash Deduction
              </Button>
            ) : null}

            {showCloseShiftAction ? (
              <Button type="button" size="sm" onClick={onCloseShift}>
                Close Shift
              </Button>
            ) : null}

            {showEditAction ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onEdit}
              >
                Edit Shift
              </Button>
            ) : null}

            {onOverride ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOverride}
              >
                Inventory Override
              </Button>
            ) : null}

            {onReopen ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onReopen}
              >
                Reopen Shift
              </Button>
            ) : null}

            {onRequestReopenApproval ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  requestReopenApprovalPending || pendingReopenApprovalCount > 0
                }
                onClick={onRequestReopenApproval}
              >
                Request Reopen
              </Button>
            ) : null}

            {showCancelAction ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onCancel}
              >
                Cancel Shift
              </Button>
            ) : null}

            {showDeleteAction ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onDelete}
              >
                Delete Shift
              </Button>
            ) : null}
          </div>
        </footer>
      ) : null}
    </div>
  )
}
