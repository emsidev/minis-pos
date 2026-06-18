import Image from "next/image"
import { Clock, Lock, MapPin, Package, Receipt, TrendingUp } from "lucide-react"

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
import { buildBoothMapLink } from "@/lib/boothMaps"
import { cn, formatCurrency } from "@/lib/utils"
import type { Product, SaleWithJoins, SharedBoothSchedule } from "@/lib/shifts"
import { SalesTable } from "./SalesTable"
import { ShiftInventoryEditor } from "./ShiftInventoryEditor"

type ShiftDetailViewProps = {
  schedule: SharedBoothSchedule
  products: Product[]
  sales: SaleWithJoins[]
  isFuture?: boolean
  className?: string
  availableProducts?: Product[]
  inventoryEmployeeId?: string
  canManageInventory?: boolean
  canTakeOver?: boolean
  takeoverPending?: boolean
  onTakeOver?: () => void
  canCloseShift?: boolean
  onCloseShift?: () => void
}

function formatSignedCurrency(value: number) {
  const absoluteLabel = formatCurrency(Math.abs(value))
  if (value === 0) {
    return absoluteLabel
  }

  return `${value > 0 ? "+" : "-"}${absoluteLabel}`
}

export function ShiftDetailView({
  schedule,
  products,
  sales,
  isFuture = false,
  className,
  availableProducts = [],
  inventoryEmployeeId,
  canManageInventory = false,
  canTakeOver = false,
  takeoverPending = false,
  onTakeOver,
  canCloseShift = false,
  onCloseShift,
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
  const latestCloseout =
    schedule.shift_closeouts
      ?.slice()
      .sort((left, right) =>
        right.closed_at.localeCompare(left.closed_at)
      )[0] ?? null
  const mapLink = buildBoothMapLink(schedule.booths)

  return (
    <div className={cn("app-page space-y-3", className)}>
      <section className="px-4 py-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
                {schedule.booths.name}
              </h1>
              {isFuture && !isCancelled && !isClosed ? (
                <Badge
                  variant="secondary"
                  className="border-primary/10 bg-primary/5 shrink-0 rounded-full py-0.5 text-[0.6rem] uppercase tracking-widest text-primary"
                >
                  Upcoming
                </Badge>
              ) : null}
              {isCancelled ? (
                <Badge
                  variant="destructive"
                  className="shrink-0 rounded-full py-0.5 text-[0.6rem] uppercase tracking-widest"
                >
                  Cancelled
                </Badge>
              ) : null}
              {isClosed ? (
                <Badge
                  variant="outline"
                  className="shrink-0 rounded-full border-emerald-500/20 bg-emerald-500/10 py-0.5 text-[0.6rem] uppercase tracking-widest text-emerald-700"
                >
                  Closed
                </Badge>
              ) : null}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-primary" />
                {schedule.booths.location_text || "No location"}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-primary" />
                {schedule.date} - {schedule.start_time.slice(0, 5)}-
                {schedule.end_time.slice(0, 5)}
              </span>
            </div>
          </div>

          {mapLink ? (
            <a
              href={mapLink}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:bg-primary/90 inline-flex h-8 shrink-0 items-center justify-center rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors"
            >
              Map
            </a>
          ) : null}
        </div>

        {isCancelled ? (
          <div className="border-destructive/20 bg-destructive/5 mt-3 rounded-xl border px-3 py-2 text-xs text-destructive">
            This assignment was cancelled and cannot be used for Counter sales.
          </div>
        ) : null}

        {isClosed ? (
          <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-xs text-emerald-800">
            <p className="font-medium text-emerald-900">
              This shift has been closed and locked from Counter access.
            </p>
            {latestCloseout ? (
              <p className="mt-1">
                Closed{" "}
                {new Date(latestCloseout.closed_at).toLocaleString("en-PH", {
                  timeZone: "Asia/Manila",
                })}{" "}
                / Cash variance{" "}
                {formatSignedCurrency(Number(latestCloseout.cash_variance))} /
                Stock variance{" "}
                {Number(latestCloseout.stock_variance) > 0 ? "+" : ""}
                {latestCloseout.stock_variance}
              </p>
            ) : null}
          </div>
        ) : null}

        {canCloseShift && onCloseShift ? (
          <div className="border-primary/15 bg-primary/5 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-3 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <p>
                Count final cash and remaining stock to lock this shift for the
                day.
              </p>
            </div>
            <Button type="button" size="sm" onClick={onCloseShift}>
              Close Shift
            </Button>
          </div>
        ) : null}

        {canTakeOver && onTakeOver ? (
          <div className="border-primary/10 bg-primary/5 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-3 text-xs text-muted-foreground">
            <p>You can view this shared shift. Take over POS to enter sales.</p>
            <Button
              type="button"
              size="sm"
              disabled={takeoverPending}
              onClick={onTakeOver}
            >
              Take Over POS
            </Button>
          </div>
        ) : null}

        {!isFuture ? (
          <div className="divide-border/50 border-border/50 bg-surface-container-low/40 mt-3 grid grid-cols-4 divide-x rounded-xl border">
            <div className="flex flex-col items-center px-2 py-2.5 text-center">
              <TrendingUp className="text-primary/60 mb-0.5 h-3.5 w-3.5" />
              <p className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
                Revenue
              </p>
              <p className="text-sm font-bold leading-tight text-foreground">
                {formatCurrency(totalRevenue)}
              </p>
            </div>
            <div className="flex flex-col items-center px-2 py-2.5 text-center">
              <Receipt className="text-primary/60 mb-0.5 h-3.5 w-3.5" />
              <p className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
                Sales
              </p>
              <p className="text-sm font-bold leading-tight text-foreground">
                {sales.length}
              </p>
            </div>
            <div className="flex flex-col items-center px-2 py-2.5 text-center">
              <Package className="text-primary/60 mb-0.5 h-3.5 w-3.5" />
              <p className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
                Items
              </p>
              <p className="text-sm font-bold leading-tight text-foreground">
                {products.length}
              </p>
            </div>
            <div className="flex flex-col items-center px-2 py-2.5 text-center">
              <Package
                className={cn(
                  "mb-0.5 h-3.5 w-3.5",
                  hasLowStock ? "text-destructive/70" : "text-emerald-500/70"
                )}
              />
              <p className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
                Stock
              </p>
              <p
                className={cn(
                  "text-sm font-bold leading-tight",
                  hasLowStock ? "text-destructive" : "text-emerald-600"
                )}
              >
                {hasLowStock ? "Low" : "OK"}
              </p>
            </div>
          </div>
        ) : (
          <div className="border-primary/10 bg-primary/5 mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs text-muted-foreground">
            <TrendingUp className="text-primary/50 h-3.5 w-3.5 shrink-0" />
            KPIs will be available once the shift starts.
          </div>
        )}
      </section>

      {canManageInventory && inventoryEmployeeId ? (
        <section className="px-4 py-2">
          <ShiftInventoryEditor
            schedule={schedule}
            inventoryProducts={products}
            availableProducts={availableProducts}
            employeeId={inventoryEmployeeId}
            compact
          />
        </section>
      ) : null}

      <section className="px-4 py-2">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Inventory
            </h2>
            {!isFuture ? (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[0.7rem] font-bold text-primary-foreground shadow-sm">
                {products.length}
              </span>
            ) : null}
          </div>
          {!isFuture ? (
            <div className="border-border/50 bg-surface-container-low/50 flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Total Stock
              </span>
              <span className="text-foreground">{totalStock}</span>
            </div>
          ) : null}
        </div>

        {isFuture ? (
          <div className="border-border/60 flex items-center justify-center gap-2 rounded-xl border border-dashed py-6 text-center">
            <Package className="text-primary/30 h-5 w-5" />
            <p className="text-sm text-muted-foreground">
              Inventory assigned when shift starts
            </p>
          </div>
        ) : products.length === 0 ? (
          <div className="border-border/60 flex items-center justify-center gap-2 rounded-xl border border-dashed py-6">
            <Package className="text-primary/30 h-5 w-5" />
            <p className="text-sm text-muted-foreground">
              No products assigned
            </p>
          </div>
        ) : (
          <div className="border-border/50 overflow-hidden rounded-[var(--radius)] border">
            <Table>
              <TableHeader className="bg-surface-container-low">
                <TableRow>
                  <TableHead className="w-8 p-0" />
                  <TableHead className="text-[0.62rem] uppercase tracking-[0.2em]">
                    Product
                  </TableHead>
                  <TableHead className="text-right text-[0.62rem] uppercase tracking-[0.2em]">
                    Price
                  </TableHead>
                  <TableHead className="text-right text-[0.62rem] uppercase tracking-[0.2em]">
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
                      className="hover:bg-surface-container-low/50"
                    >
                      <TableCell className="p-1.5 pl-3">
                        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-surface-container">
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
                        <p className="text-sm font-semibold leading-tight text-foreground">
                          {product.name}
                        </p>
                        <p className="text-[0.65rem] text-muted-foreground">
                          {product.category || "Artisanal"}
                        </p>
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium text-primary">
                        {formatCurrency(Number(product.price))}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={stock <= 5 ? "destructive" : "secondary"}
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider",
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

      <section className="px-4 py-2">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Sales
            </h2>
            {!isFuture ? (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[0.7rem] font-bold text-primary-foreground shadow-sm">
                {sales.length}
              </span>
            ) : null}
          </div>
          {!isFuture ? (
            <div className="border-primary/20 bg-primary/5 flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold">
              <span className="text-primary/70 text-[10px] uppercase tracking-wider">
                Total Revenue
              </span>
              <span className="text-primary">
                {formatCurrency(totalRevenue)}
              </span>
            </div>
          ) : null}
        </div>

        {isFuture ? (
          <div className="border-border/60 flex items-center justify-center gap-2 rounded-xl border border-dashed py-6 text-center">
            <Receipt className="text-primary/30 h-5 w-5" />
            <p className="text-sm text-muted-foreground">
              Sales will appear after transactions
            </p>
          </div>
        ) : (
          <SalesTable sales={sales} />
        )}
      </section>
    </div>
  )
}
