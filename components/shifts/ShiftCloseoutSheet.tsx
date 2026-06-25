"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import {
  AlertTriangle,
  Loader2,
  Lock,
  Receipt,
  RefreshCcw,
  WifiOff,
} from "lucide-react"
import { toast } from "sonner"

import { closeShift } from "@/app/actions/shiftCloseout"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { db } from "@/lib/db"
import type { Product, SaleWithJoins, SharedBoothSchedule } from "@/lib/shifts"
import type { ShiftApprovalRecord } from "@/lib/shiftApprovals"
import {
  getApprovedCashDeductionTotal,
  getPendingCashDeductionCount,
} from "@/lib/shiftApprovals"
import {
  getPendingOperationCountsForSchedule,
  syncPendingPosOperations,
} from "@/lib/sync"
import { cn, formatCurrency } from "@/lib/utils"

type ShiftCloseoutSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule: SharedBoothSchedule
  products: Product[]
  sales: SaleWithJoins[]
  approvalHistory?: ShiftApprovalRecord[]
  onSaved: () => void
}

type StockValues = Record<string, string>

function buildCountedStockValues(products: Product[]): StockValues {
  return Object.fromEntries(
    products.map((product) => [product.id, String(product.stock ?? 0)])
  )
}

function buildCloseoutSourceKey(
  scheduleId: string,
  systemCashSales: number,
  products: Product[]
) {
  const stockState = products
    .map((product) => `${product.id}:${product.stock ?? 0}`)
    .join("|")

  return `${scheduleId}:${systemCashSales}:${stockState}`
}

function formatVariance(value: number, money = false) {
  if (money) {
    const label = formatCurrency(Math.abs(value))
    return value === 0 ? label : `${value > 0 ? "+" : "-"}${label}`
  }

  if (value === 0) {
    return "0"
  }

  return `${value > 0 ? "+" : ""}${value}`
}

export function ShiftCloseoutSheet({
  open,
  onOpenChange,
  schedule,
  products,
  sales,
  approvalHistory = [],
  onSaved,
}: ShiftCloseoutSheetProps) {
  const pendingCounts = useLiveQuery(
    () => getPendingOperationCountsForSchedule(schedule.id),
    [schedule.id]
  )
  const [countedCashSales, setCountedCashSales] = useState("0.00")
  const [countedStocks, setCountedStocks] = useState<StockValues>({})
  const [hasDraftChanges, setHasDraftChanges] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [pending, setPending] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const systemCashSales = useMemo(
    () =>
      sales.reduce(
        (total, sale) =>
          sale.payment_method === "cash"
            ? total + Number(sale.total_amount)
            : total,
        0
      ),
    [sales]
  )
  const systemStockTotal = useMemo(
    () => products.reduce((total, product) => total + (product.stock ?? 0), 0),
    [products]
  )
  const approvedCashDeductions = useMemo(
    () => getApprovedCashDeductionTotal(approvalHistory),
    [approvalHistory]
  )
  const pendingCashDeductionCount = useMemo(
    () => getPendingCashDeductionCount(approvalHistory),
    [approvalHistory]
  )
  const expectedCashSales = systemCashSales - approvedCashDeductions
  const countedCashValue = Number(countedCashSales || "0")
  const countedStockTotal = products.reduce(
    (total, product) => total + Number(countedStocks[product.id] ?? "0"),
    0
  )
  const cashVariance = countedCashValue - expectedCashSales
  const stockVariance = countedStockTotal - systemStockTotal
  const hasPendingSync = (pendingCounts?.total ?? 0) > 0
  const hasPendingCashDeductions = pendingCashDeductionCount > 0
  const closeoutBlocked =
    isOffline ||
    hasPendingSync ||
    hasPendingCashDeductions ||
    products.length === 0
  const closeoutSourceKey = useMemo(
    () => buildCloseoutSourceKey(schedule.id, expectedCashSales, products),
    [expectedCashSales, products, schedule.id]
  )

  useEffect(() => {
    if (!open) {
      setHasDraftChanges(false)
      return
    }

    if (hasDraftChanges) {
      return
    }

    setCountedCashSales(expectedCashSales.toFixed(2))
    setCountedStocks(buildCountedStockValues(products))
  }, [closeoutSourceKey, expectedCashSales, hasDraftChanges, open, products])

  useEffect(() => {
    const syncOfflineState = () => {
      setIsOffline(!window.navigator.onLine)
    }

    syncOfflineState()
    window.addEventListener("online", syncOfflineState)
    window.addEventListener("offline", syncOfflineState)

    return () => {
      window.removeEventListener("online", syncOfflineState)
      window.removeEventListener("offline", syncOfflineState)
    }
  }, [])

  const setStockValue = (productId: string, value: string) => {
    setHasDraftChanges(true)
    setCountedStocks((current) => ({ ...current, [productId]: value }))
  }

  const handleSyncNow = async () => {
    if (!window.navigator.onLine) {
      toast.error("Reconnect before syncing pending shift activity.")
      return
    }

    setSyncing(true)
    try {
      const result = await syncPendingPosOperations({ manual: true })
      if (result.conflicts > 0) {
        toast.error(
          "Some pending items still need review before this shift can close."
        )
      } else if (result.failed > 0) {
        toast.error(
          "Some pending items still could not sync. Review the failed records and retry."
        )
      } else if (result.inventory === 0 && result.sales === 0) {
        toast.success("No pending shift activity was left to sync.")
      } else {
        toast.success("Pending shift activity synced.")
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to sync pending activity."
      )
    } finally {
      setSyncing(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (closeoutBlocked) {
      toast.error(
        isOffline
          ? "Reconnect before closing this shift."
          : hasPendingCashDeductions
            ? "Resolve pending cash deductions before closing this shift."
            : "Sync all pending local sales and stock changes first."
      )
      return
    }

    const parsedCash = Number(countedCashSales)
    if (!Number.isFinite(parsedCash) || parsedCash < 0) {
      toast.error("Enter a valid counted cash total.")
      return
    }

    const lines = products.map((product) => ({
      productId: product.id,
      previousStock: product.stock ?? 0,
      resultingStock: Number(countedStocks[product.id] ?? "0"),
    }))

    if (
      lines.some(
        (line) =>
          !Number.isInteger(line.resultingStock) || line.resultingStock < 0
      )
    ) {
      toast.error("Enter valid non-negative whole-number stock counts.")
      return
    }

    setPending(true)
    const result = await closeShift({
      scheduleId: schedule.id,
      boothId: schedule.booth_id,
      countedCashSales: parsedCash,
      lines,
    })
    setPending(false)

    if (!result.ok) {
      toast.error(result.error ?? "Unable to close this shift.")
      return
    }

    setHasDraftChanges(false)
    await db.transaction(
      "rw",
      [db.boothSchedules, db.boothScheduleProducts],
      async () => {
        await db.boothSchedules.update(schedule.id, { status: "closed" })

        for (const line of lines) {
          const existingRow = await db.boothScheduleProducts
            .where("[schedule_id+product_id]")
            .equals([schedule.id, line.productId])
            .first()

          if (existingRow) {
            await db.boothScheduleProducts.update(existingRow.id, {
              stock: line.resultingStock,
            })
          }
        }
      }
    )

    toast.success(result.message)
    onOpenChange(false)
    onSaved()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full max-w-2xl flex-col p-0"
      >
        <div className="border-border shrink-0 border-b px-6 pt-6 pb-5">
          <SheetTitle>End Of Day Closeout</SheetTitle>
          <SheetDescription>
            Count cash and final stock, review variances, then lock this shift.
          </SheetDescription>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <form
            id="shift-closeout-form"
            className="flex flex-col gap-6 p-6"
            onSubmit={handleSubmit}
          >
            {isOffline ? (
              <div className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm">
                <WifiOff className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">Closeout needs a connection.</p>
                  <p>
                    Reconnect so the final reconciliation can be saved online.
                  </p>
                </div>
              </div>
            ) : null}

            {hasPendingSync ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-medium">
                      Sync pending shift activity first.
                    </p>
                    <p>
                      {pendingCounts?.pendingSales ?? 0} sale
                      {(pendingCounts?.pendingSales ?? 0) === 1
                        ? ""
                        : "s"} and {pendingCounts?.pendingInventoryEvents ?? 0}{" "}
                      inventory update
                      {(pendingCounts?.pendingInventoryEvents ?? 0) === 1
                        ? ""
                        : "s"}{" "}
                      are still local.
                    </p>
                  </div>
                </div>
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={syncing}
                    onClick={handleSyncNow}
                  >
                    {syncing ? (
                      <Loader2
                        data-icon="inline-start"
                        className="animate-spin"
                      />
                    ) : (
                      <RefreshCcw data-icon="inline-start" />
                    )}
                    Sync Now
                  </Button>
                </div>
              </div>
            ) : null}

            {hasPendingCashDeductions ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-medium">
                      Pending cash deductions still need approval.
                    </p>
                    <p>
                      {pendingCashDeductionCount} deduction request
                      {pendingCashDeductionCount === 1 ? "" : "s"} must be
                      approved or rejected before this shift can close.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="border-border bg-card rounded-2xl border px-4 py-3">
                <p className="text-muted-foreground text-xs tracking-[0.18em] uppercase">
                  Gross Cash
                </p>
                <p className="text-foreground mt-1 text-xl font-semibold">
                  {formatCurrency(systemCashSales)}
                </p>
              </div>
              <div className="border-border bg-card rounded-2xl border px-4 py-3">
                <p className="text-muted-foreground text-xs tracking-[0.18em] uppercase">
                  Deductions
                </p>
                <p className="text-foreground mt-1 text-xl font-semibold">
                  {formatCurrency(approvedCashDeductions)}
                </p>
              </div>
              <div className="border-border bg-card rounded-2xl border px-4 py-3">
                <p className="text-muted-foreground text-xs tracking-[0.18em] uppercase">
                  Expected Cash
                </p>
                <p className="text-foreground mt-1 text-xl font-semibold">
                  {formatCurrency(expectedCashSales)}
                </p>
              </div>
              <div className="border-border bg-card rounded-2xl border px-4 py-3">
                <p className="text-muted-foreground text-xs tracking-[0.18em] uppercase">
                  Counted Cash
                </p>
                <p className="text-foreground mt-1 text-xl font-semibold">
                  {formatCurrency(
                    Number.isFinite(countedCashValue) ? countedCashValue : 0
                  )}
                </p>
              </div>
              <div className="border-border bg-card rounded-2xl border px-4 py-3">
                <p className="text-muted-foreground text-xs tracking-[0.18em] uppercase">
                  Cash Variance
                </p>
                <p
                  className={cn(
                    "mt-1 text-xl font-semibold",
                    cashVariance === 0
                      ? "text-foreground"
                      : cashVariance > 0
                        ? "text-emerald-600"
                        : "text-destructive"
                  )}
                >
                  {formatVariance(cashVariance, true)}
                </p>
              </div>
            </div>

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="counted-cash-sales">
                  Counted cash for this shift
                </FieldLabel>
                <Input
                  id="counted-cash-sales"
                  required
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={countedCashSales}
                  onChange={(event) => {
                    setHasDraftChanges(true)
                    setCountedCashSales(event.target.value)
                  }}
                />
                <FieldDescription>
                  Compare against expected cash after approved deductions.
                  Revenue totals do not change.
                </FieldDescription>
              </Field>
            </FieldGroup>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-muted-foreground text-sm font-semibold tracking-[0.18em] uppercase">
                    Closing Stock
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Count the remaining stock for each assigned product.
                  </p>
                </div>
                <div className="border-border rounded-full border px-3 py-1 text-xs font-semibold">
                  {countedStockTotal} counted / {systemStockTotal} system
                </div>
              </div>

              <div className="space-y-3">
                {products.map((product) => {
                  const systemStock = product.stock ?? 0
                  const countedStock = Number(countedStocks[product.id] ?? "0")
                  const variance = countedStock - systemStock

                  return (
                    <div
                      key={product.id}
                      className="border-border bg-card grid gap-3 rounded-2xl border px-4 py-3 lg:grid-cols-[minmax(0,1fr)_6rem_minmax(7rem,8rem)_6rem] lg:items-start"
                    >
                      <div className="min-w-0">
                        <p className="text-foreground font-medium">
                          {product.name}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          System stock: {systemStock}
                        </p>
                      </div>
                      <div className="bg-muted rounded-xl px-3 py-2 text-sm">
                        <p className="text-muted-foreground text-xs tracking-[0.14em] uppercase">
                          System
                        </p>
                        <p className="mt-1 font-semibold">{systemStock}</p>
                      </div>
                      <Field className="min-w-0 gap-1">
                        <FieldLabel htmlFor={`closeout-stock-${product.id}`}>
                          Counted
                        </FieldLabel>
                        <Input
                          id={`closeout-stock-${product.id}`}
                          type="number"
                          inputMode="numeric"
                          min="0"
                          step="1"
                          required
                          value={countedStocks[product.id] ?? "0"}
                          onChange={(event) =>
                            setStockValue(product.id, event.target.value)
                          }
                        />
                      </Field>
                      <div className="bg-muted rounded-xl px-3 py-2 text-sm">
                        <p className="text-muted-foreground text-xs tracking-[0.14em] uppercase">
                          Variance
                        </p>
                        <p
                          className={cn(
                            "mt-1 font-semibold",
                            variance === 0
                              ? "text-foreground"
                              : variance > 0
                                ? "text-emerald-600"
                                : "text-destructive"
                          )}
                        >
                          {formatVariance(variance)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="border-border bg-card rounded-2xl border px-4 py-3">
                <p className="text-muted-foreground text-xs tracking-[0.18em] uppercase">
                  System Stock
                </p>
                <p className="text-foreground mt-1 text-xl font-semibold">
                  {systemStockTotal}
                </p>
              </div>
              <div className="border-border bg-card rounded-2xl border px-4 py-3">
                <p className="text-muted-foreground text-xs tracking-[0.18em] uppercase">
                  Counted Stock
                </p>
                <p className="text-foreground mt-1 text-xl font-semibold">
                  {countedStockTotal}
                </p>
              </div>
              <div className="border-border bg-card rounded-2xl border px-4 py-3">
                <p className="text-muted-foreground text-xs tracking-[0.18em] uppercase">
                  Stock Variance
                </p>
                <p
                  className={cn(
                    "mt-1 text-xl font-semibold",
                    stockVariance === 0
                      ? "text-foreground"
                      : stockVariance > 0
                        ? "text-emerald-600"
                        : "text-destructive"
                  )}
                >
                  {formatVariance(stockVariance)}
                </p>
              </div>
            </div>

            <div className="border-primary/15 bg-primary/5 text-muted-foreground flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm">
              <Lock className="text-primary mt-0.5 size-4 shrink-0" />
              <div>
                <p className="text-foreground font-medium">
                  Final confirmation
                </p>
                <p>
                  Closing this shift locks Counter sales, stock adjustments, and
                  shared-shift POS takeover until an admin reopens it.
                </p>
              </div>
            </div>
          </form>
        </div>

        <footer className="border-border flex shrink-0 justify-end gap-2 border-t p-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setHasDraftChanges(false)
              onOpenChange(false)
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="shift-closeout-form"
            disabled={pending || syncing || closeoutBlocked}
          >
            {pending ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Receipt data-icon="inline-start" />
            )}
            Confirm Closeout
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  )
}
