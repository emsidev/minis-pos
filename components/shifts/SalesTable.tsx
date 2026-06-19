"use client"

import { useState, useTransition } from "react"
import { ChevronDown, ChevronRight, Receipt } from "lucide-react"
import { toast } from "sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { cn, formatCurrency } from "@/lib/utils"
import type { SaleItemWithProduct, SaleWithJoins } from "@/lib/shifts"
import { getSaleItems } from "@/app/actions/shifts"
import { cacheServerSaleItems, getCachedSaleItems } from "@/lib/offlineData"

type SaleRowProps = {
  sale: SaleWithJoins
  allowOfflineCache: boolean
}

function SaleRow({ sale, allowOfflineCache }: SaleRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [items, setItems] = useState<SaleItemWithProduct[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const toggleExpand = async () => {
    if (!isExpanded && items.length === 0) {
      setLoadError(null)
      startTransition(async () => {
        if (allowOfflineCache) {
          const cachedItems = await getCachedSaleItems(sale.id)

          if (cachedItems.length > 0 || !window.navigator.onLine) {
            setItems(cachedItems)
            setIsExpanded(true)
            if (cachedItems.length === 0 && !window.navigator.onLine) {
              setLoadError("Sale items are not available offline yet.")
            }
            return
          }
        } else if (!window.navigator.onLine) {
          setIsExpanded(true)
          setLoadError("Reconnect to load sale items for this shift preview.")
          return
        }

        try {
          const data = await getSaleItems(sale.id)
          if (allowOfflineCache) {
            await cacheServerSaleItems(data)
          }
          setItems(data)
          setIsExpanded(true)
        } catch {
          setLoadError("Unable to load sale items.")
          setIsExpanded(true)
          toast.error("Unable to load sale items.")
        }
      })
      return
    }
    setIsExpanded(!isExpanded)
  }

  return (
    <>
      <TableRow
        className="hover:bg-surface-container-low/50 cursor-pointer transition-colors"
        onClick={toggleExpand}
      >
        <TableCell className="w-10 p-0 pl-4">
          {isExpanded ? (
            <ChevronDown className="text-muted-foreground h-4 w-4" />
          ) : (
            <ChevronRight className="text-muted-foreground h-4 w-4" />
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-full">
              <Receipt className="h-4 w-4" />
            </div>
            <div>
              <p className="text-foreground text-sm font-semibold">
                {sale.created_at
                  ? new Date(sale.created_at).toLocaleTimeString("en-PH", {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "Time unavailable"}
              </p>
              <p className="text-muted-foreground text-[0.65rem] tracking-wider uppercase">
                ID: {sale.id.slice(0, 8)}
              </p>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <Badge
            variant="outline"
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[0.62rem] font-semibold tracking-wider uppercase",
              sale.payment_method === "cash"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-secondary/20 bg-secondary/10 text-secondary"
            )}
          >
            {sale.payment_method}
          </Badge>
        </TableCell>
        <TableCell className="text-foreground text-right font-bold">
          {formatCurrency(Number(sale.total_amount))}
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow className="bg-surface-container-low/30 hover:bg-surface-container-low/30">
          <TableCell colSpan={4} className="p-0">
            <div className="space-y-3 px-14 py-4">
              <h4 className="text-muted-foreground text-[0.62rem] font-bold tracking-[0.2em] uppercase">
                Sale Items
              </h4>
              {isPending ? (
                <div className="text-muted-foreground flex animate-pulse items-center gap-2 py-2 text-xs">
                  <div className="bg-primary/40 h-2 w-2 rounded-full" />
                  Loading items...
                </div>
              ) : loadError ? (
                <p className="text-muted-foreground py-2 text-xs">
                  {loadError}
                </p>
              ) : items.length === 0 ? (
                <p className="text-muted-foreground py-2 text-xs">
                  No items found for this sale.
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-foreground font-medium">
                          {item.quantity}x
                        </span>
                        <span className="text-muted-foreground">
                          {item.products?.name || "Unknown Product"}
                        </span>
                      </div>
                      <span className="text-muted-foreground">
                        {formatCurrency(Number(item.subtotal))}
                      </span>
                    </div>
                  ))}
                  <div className="bg-border/50 my-2 h-px" />
                  <div className="flex items-center justify-between text-xs font-bold tracking-wider uppercase">
                    <span>Total</span>
                    <span className="text-primary">
                      {formatCurrency(Number(sale.total_amount))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

type SalesTableProps = {
  sales: SaleWithJoins[]
  allowOfflineCache?: boolean
}

export function SalesTable({
  sales,
  allowOfflineCache = true,
}: SalesTableProps) {
  if (sales.length === 0) {
    return (
      <div className="app-panel-muted flex min-h-[14rem] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <Receipt className="text-primary/35 h-10 w-10" />
        <h3 className="text-foreground text-lg font-semibold">
          No sales recorded
        </h3>
        <p className="text-muted-foreground max-w-[200px] text-sm">
          Transactions will appear here once they are completed.
        </p>
      </div>
    )
  }

  return (
    <div className="border-border/50 overflow-hidden rounded-[var(--radius)] border">
      <Table>
        <TableHeader className="bg-surface-container-low">
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead className="text-[0.62rem] tracking-[0.2em] uppercase">
              Transaction
            </TableHead>
            <TableHead className="text-[0.62rem] tracking-[0.2em] uppercase">
              Payment
            </TableHead>
            <TableHead className="text-right text-[0.62rem] tracking-[0.2em] uppercase">
              Amount
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.map((sale) => (
            <SaleRow
              key={sale.id}
              sale={sale}
              allowOfflineCache={allowOfflineCache}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
