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
} from "lucide-react"

import type {
  AdminInventoryEvent,
  AdminOperatorPeriod,
  AdminShiftCloseout,
} from "@/lib/adminBooths"
import { buildBoothMapLink } from "@/lib/boothMaps"
import { cn, formatCurrency, hasBusinessShiftPassed } from "@/lib/utils"
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
import type { Product, SaleWithJoins, SharedBoothSchedule } from "@/lib/shifts"
import { SalesTable } from "./SalesTable"
import { ShiftInventoryEditor } from "./ShiftInventoryEditor"

type ShiftDetailViewProps = {
  schedule: SharedBoothSchedule
  products: Product[]
  sales: SaleWithJoins[]
  isFuture?: boolean
  className?: string
  assignedEmployeeNames?: string[]
  operatorName?: string | null
  availableProducts?: Product[]
  inventoryEmployeeId?: string
  canManageInventory?: boolean
  readOnly?: boolean
  canJoin?: boolean
  joinPending?: boolean
  onJoin?: () => void
  canTakeOver?: boolean
  takeoverPending?: boolean
  onTakeOver?: () => void
  canCloseShift?: boolean
  onCloseShift?: () => void
  showAdminAudit?: boolean
  inventoryEvents?: AdminInventoryEvent[]
  operatorPeriods?: AdminOperatorPeriod[]
  closeouts?: AdminShiftCloseout[]
  onEdit?: () => void
  onCancel?: () => void
  onOverride?: () => void
  onReopen?: () => void
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
  isFuture = false,
  className,
  assignedEmployeeNames = [],
  operatorName = null,
  availableProducts = [],
  inventoryEmployeeId,
  canManageInventory = false,
  readOnly = false,
  canJoin = false,
  joinPending = false,
  onJoin,
  canTakeOver = false,
  takeoverPending = false,
  onTakeOver,
  canCloseShift = false,
  onCloseShift,
  showAdminAudit = false,
  inventoryEvents = [],
  operatorPeriods = [],
  closeouts = [],
  onEdit,
  onCancel,
  onOverride,
  onReopen,
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
  const hasLowStock = products.some((product) => (product.stock ?? 0) <= 5)
  const isCancelled = schedule.status === "cancelled"
  const isClosed = schedule.status === "closed"
  const hasPassed = hasBusinessShiftPassed(schedule.date, schedule.end_time)
  const mapLink = buildBoothMapLink(schedule.booths)
  const inventorySetupCount = products.length
  const openingStock = products.reduce(
    (acc, product) => acc + (product.quantity ?? 0),
    0
  )
  const latestCloseout =
    closeouts.length > 0
      ? closeouts
          .slice()
          .sort((left, right) =>
            right.closed_at.localeCompare(left.closed_at)
          )[0]
      : (schedule.shift_closeouts
          ?.slice()
          .sort((left, right) =>
            right.closed_at.localeCompare(left.closed_at)
          )[0] ?? null)
  const showCloseShiftAction =
    !isCancelled && !isClosed && Boolean(canCloseShift && onCloseShift)
  const showEditAction =
    !isCancelled && !isClosed && !hasPassed && Boolean(onEdit)
  const showCancelAction =
    !isCancelled && !isClosed && !hasPassed && Boolean(onCancel)
  const hasPrimaryActions =
    Boolean(mapLink) ||
    Boolean(canJoin && onJoin) ||
    Boolean(canTakeOver && onTakeOver) ||
    showCloseShiftAction ||
    showEditAction ||
    showCancelAction ||
    Boolean(onOverride) ||
    Boolean(onReopen)

  return (
    <div className={cn("app-page flex min-h-full flex-col", className)}>
      <div className="flex-1 space-y-4 px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
        <section className="border-border/60 bg-card overflow-hidden rounded-[calc(var(--radius)+0.2rem)] border">
          <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-foreground truncate text-xl font-semibold tracking-tight">
                    {schedule.booths.name}
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

              <div className="grid grid-cols-2 gap-2">
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
                  You can view this shared shift. Take over POS to enter sales.
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
            <SalesTable
              sales={sales}
              allowOfflineCache={allowOfflineSaleCache ?? !readOnly}
            />
          )}
        </section>

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
                          system /{" "}
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
                Take Over POS
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
          </div>
        </footer>
      ) : null}
    </div>
  )
}
