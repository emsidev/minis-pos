"use client"

import {
  Clock,
  Lock,
  Pencil,
  RotateCcw,
  SlidersHorizontal,
  UserRound,
} from "lucide-react"

import type { AdminSchedule } from "@/lib/adminBooths"
import {
  formatCurrency,
  getBusinessDate,
  hasBusinessShiftStarted,
  isCurrentBusinessShift,
} from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type AdminScheduleDetailSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule: AdminSchedule | null
  onEdit?: () => void
  onCancel?: () => void
  onOverride?: () => void
  onReopen?: () => void
}

function formatSignedCurrency(value: number) {
  const absoluteLabel = formatCurrency(Math.abs(value))
  if (value === 0) {
    return absoluteLabel
  }

  return `${value > 0 ? "+" : "-"}${absoluteLabel}`
}

function getLifecycleLabel(
  schedule: AdminSchedule,
  started: boolean,
  active: boolean
) {
  if (schedule.status === "cancelled") {
    return "Cancelled"
  }

  if (schedule.status === "closed") {
    return "Closed"
  }

  if (active) {
    return "Active"
  }

  return started ? "Open" : "Upcoming"
}

function getLifecycleBadge(
  schedule: AdminSchedule,
  started: boolean,
  active: boolean
) {
  const label = getLifecycleLabel(schedule, started, active)
  const isClosed = schedule.status === "closed"

  return (
    <Badge
      variant={
        schedule.status === "cancelled"
          ? "destructive"
          : isClosed
            ? "outline"
            : active
              ? "default"
              : "secondary"
      }
      className={
        isClosed
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
          : undefined
      }
    >
      {label}
    </Badge>
  )
}

export function AdminScheduleDetailSheet({
  open,
  onOpenChange,
  schedule,
  onEdit,
  onCancel,
  onOverride,
  onReopen,
}: AdminScheduleDetailSheetProps) {
  const businessDate = getBusinessDate()

  if (!schedule) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full max-w-2xl p-0">
          <div className="flex h-full items-center justify-center px-6 text-center">
            <div className="flex flex-col gap-2">
              <SheetTitle>Shift Details</SheetTitle>
              <SheetDescription>
                Select a shift to review its history and actions.
              </SheetDescription>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  const started = hasBusinessShiftStarted(schedule.date, schedule.start_time)
  const active =
    schedule.status === "scheduled" &&
    isCurrentBusinessShift(
      schedule.date,
      schedule.start_time,
      schedule.end_time
    )
  const isClosed = schedule.status === "closed"
  const canEdit = schedule.status === "scheduled"
  const canReopen = isClosed && schedule.date === businessDate
  const initialized = schedule.booth_schedule_products.length > 0
  const totalOpeningStock = schedule.booth_schedule_products.reduce(
    (total, item) => total + item.quantity,
    0
  )
  const totalCurrentStock = schedule.booth_schedule_products.reduce(
    (total, item) => total + item.stock,
    0
  )
  const assignedEmployees = schedule.booth_schedule_assignments
    .map((assignment) => assignment.employees?.name ?? "Unknown employee")
    .join(", ")
  const latestCloseout =
    schedule.shift_closeouts
      .slice()
      .sort((left, right) =>
        right.closed_at.localeCompare(left.closed_at)
      )[0] ?? null
  const inventoryEvents = schedule.inventory_events
    .slice()
    .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at))
  const handoffs = schedule.booth_schedule_operator_periods
    .slice()
    .sort((left, right) => right.starts_at.localeCompare(left.starts_at))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-2xl p-0">
        <div className="shrink-0 border-b border-border px-6 pb-5 pt-6">
          <SheetTitle>Shift Details</SheetTitle>
          <SheetDescription>
            Review assignment history and manage this booth shift.
          </SheetDescription>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-6 p-6">
            <section className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-foreground">
                      {schedule.date} / {schedule.start_time.slice(0, 5)} -{" "}
                      {schedule.end_time.slice(0, 5)}
                    </h2>
                    {getLifecycleBadge(schedule, started, active)}
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {schedule.booths.name}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="bg-muted/30 rounded-xl border border-border px-4 py-3">
                  <p className="app-kicker">POS Operator</p>
                  <p className="mt-2 flex items-center gap-2 text-sm text-foreground">
                    <UserRound className="size-4 text-primary" />
                    {schedule.operator?.name ?? "Unknown employee"}
                  </p>
                </div>
                <div className="bg-muted/30 rounded-xl border border-border px-4 py-3">
                  <p className="app-kicker">Assigned Employees</p>
                  <p className="mt-2 text-sm text-foreground">
                    {assignedEmployees || "No employees assigned"}
                  </p>
                </div>
              </div>

              <div className="bg-muted/30 rounded-xl border border-border px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Clock className="size-4 text-primary" />
                  <span className="font-medium text-foreground">
                    {initialized
                      ? `${schedule.booth_schedule_products.length} products / ${totalOpeningStock} opening / ${totalCurrentStock} current`
                      : "Awaiting employee inventory setup"}
                  </span>
                </div>
                {initialized ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {schedule.booth_schedule_products
                      .map((item) => item.products?.name ?? "Product")
                      .join(", ")}
                  </p>
                ) : null}
              </div>

              {latestCloseout ? (
                <div className="rounded-xl border border-border px-4 py-4 text-sm text-muted-foreground">
                  <p className="font-medium uppercase tracking-wider text-foreground">
                    Latest Closeout
                  </p>
                  <p className="mt-2">
                    Closed by {latestCloseout.closed_by?.name ?? "Employee"} on{" "}
                    {new Date(latestCloseout.closed_at).toLocaleString(
                      "en-PH",
                      {
                        timeZone: "Asia/Manila",
                      }
                    )}
                  </p>
                  <p>
                    Cash:{" "}
                    {formatCurrency(Number(latestCloseout.system_cash_sales))}{" "}
                    system /{" "}
                    {formatCurrency(Number(latestCloseout.counted_cash_sales))}{" "}
                    counted /{" "}
                    {formatSignedCurrency(Number(latestCloseout.cash_variance))}{" "}
                    variance
                  </p>
                  <p>
                    Stock: {latestCloseout.system_stock_total} system /{" "}
                    {latestCloseout.counted_stock_total} counted /{" "}
                    {Number(latestCloseout.stock_variance) > 0 ? "+" : ""}
                    {latestCloseout.stock_variance} variance
                  </p>
                  {latestCloseout.reopened_at ? (
                    <p className="mt-2">
                      Reopened by {latestCloseout.reopened_by?.name ?? "Admin"}{" "}
                      on{" "}
                      {new Date(latestCloseout.reopened_at).toLocaleString(
                        "en-PH",
                        {
                          timeZone: "Asia/Manila",
                        }
                      )}
                      . Reason: {latestCloseout.reopen_reason}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>

            <Separator />

            <section className="flex flex-col gap-3">
              <div>
                <p className="app-kicker">Inventory</p>
                <h3 className="text-base font-semibold text-foreground">
                  Assigned Products
                </h3>
              </div>
              {!initialized ? (
                <p className="text-sm text-muted-foreground">
                  No inventory has been recorded for this shift yet.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Opening</TableHead>
                        <TableHead className="text-right">Current</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedule.booth_schedule_products.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium text-foreground">
                            {item.products?.name ?? "Product"}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {item.stock}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            <Separator />

            <section className="flex flex-col gap-3">
              <div>
                <p className="app-kicker">Inventory History</p>
                <h3 className="text-base font-semibold text-foreground">
                  Stock Activity
                </h3>
              </div>
              {inventoryEvents.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {inventoryEvents.map((inventoryEvent) => (
                    <div
                      key={inventoryEvent.id}
                      className="rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground"
                    >
                      <p className="font-medium text-foreground">
                        {inventoryEvent.event_type === "opening"
                          ? "Opening inventory"
                          : inventoryEvent.event_type === "adjustment"
                            ? "Employee adjustment"
                            : inventoryEvent.event_type === "closeout"
                              ? "Shift closeout"
                              : "Admin override"}{" "}
                        by {inventoryEvent.actors?.name ?? "Employee"}
                      </p>
                      <p className="mt-1">
                        {new Date(inventoryEvent.occurred_at).toLocaleString(
                          "en-PH",
                          {
                            timeZone: "Asia/Manila",
                          }
                        )}
                      </p>
                      {inventoryEvent.reason ? (
                        <p className="mt-1">Reason: {inventoryEvent.reason}</p>
                      ) : null}
                      <p className="mt-1">
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
              ) : initialized ? (
                <p className="text-sm text-muted-foreground">
                  Existing opening inventory has no recorded activity history.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Activity will appear after opening inventory is recorded.
                </p>
              )}
            </section>

            <Separator />

            <section className="flex flex-col gap-3">
              <div>
                <p className="app-kicker">Operator History</p>
                <h3 className="text-base font-semibold text-foreground">
                  POS Handoffs
                </h3>
              </div>
              {handoffs.length > 1 ? (
                <div className="flex flex-col gap-3">
                  {handoffs.map((period) => (
                    <div
                      key={period.id}
                      className="rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground"
                    >
                      <p className="font-medium text-foreground">
                        {period.operator?.name ?? "Employee"}
                      </p>
                      <p className="mt-1">
                        From{" "}
                        {new Date(period.starts_at).toLocaleString("en-PH", {
                          timeZone: "Asia/Manila",
                        })}
                      </p>
                      {period.initiated_by ? (
                        <p className="mt-1">
                          Initiated by {period.initiated_by.name}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This shift did not record any POS handoff history.
                </p>
              )}
            </section>
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t border-border px-6 py-4">
          {schedule.status === "scheduled" ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canEdit}
                  onClick={onEdit}
                >
                  <Pencil data-icon="inline-start" />
                  Edit Setup
                </Button>
                <Button type="button" variant="destructive" onClick={onCancel}>
                  Cancel Shift
                </Button>
                {active && initialized ? (
                  <Button type="button" variant="outline" onClick={onOverride}>
                    <SlidersHorizontal data-icon="inline-start" />
                    Override Stock
                  </Button>
                ) : null}
              </div>
              {active && !initialized ? (
                <p className="text-xs text-muted-foreground">
                  Opening inventory must be recorded before stock can be
                  overridden.
                </p>
              ) : null}
            </div>
          ) : isClosed ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
                <p>Closed shifts stay locked until an admin reopens them.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" disabled={!canReopen} onClick={onReopen}>
                  <RotateCcw data-icon="inline-start" />
                  Reopen Shift
                </Button>
                {!canReopen ? (
                  <p className="text-xs text-muted-foreground">
                    Same business day only.
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              This cancelled assignment is retained for history.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
