"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import {
  Copy,
  Ellipsis,
  Loader2,
  Store,
  Trash2,
  UserRound,
  Wallet,
} from "lucide-react"
import { toast } from "sonner"

import {
  deleteSalePermanently,
  loadAdminSalesPage,
} from "@/app/actions/adminSales"
import { submitSaleChange } from "@/app/actions/shifts"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { DataTable } from "@/components/shared/DataTable"
import { DataTableColumnHeader } from "@/components/shared/DataTableColumnHeader"
import { ReceiptPhotoPreview } from "@/components/shared/ReceiptPhotoPreview"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DateRangePicker,
  type DateRangePickerValue,
} from "@/components/ui/date-range-picker"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  AdminSalesLedgerData,
  AdminSalesLedgerRow,
  AdminSalesLedgerView,
} from "@/lib/adminSales"
import type { PaymentMethod } from "@/lib/database.types"
import { cn, formatCurrency, getBusinessDate } from "@/lib/utils"

type AdminSalesClientProps = {
  data: AdminSalesLedgerData
}

const paymentLabels: Record<PaymentMethod, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  maribank: "Maribank",
  unionbank: "UnionBank",
  other: "Other",
}

const SALES_FILTER_ALL = "__all__"

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value))
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(value))
}

function formatStatusLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function buildSalesRoute(
  startDate: string,
  endDate: string,
  view: AdminSalesLedgerView
) {
  const businessDate = getBusinessDate()
  const params = new URLSearchParams()

  if (startDate !== businessDate || endDate !== businessDate) {
    params.set("from", startDate)
    params.set("to", endDate)
  }

  if (view === "trash") {
    params.set("view", "trash")
  }

  const query = params.toString()
  return query.length > 0 ? `/admin/sales?${query}` : "/admin/sales"
}

export function AdminSalesClient({ data }: AdminSalesClientProps) {
  const router = useRouter()
  const [rows, setRows] = useState(data.rows)
  const [nextCursor, setNextCursor] = useState(data.nextCursor)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [selectedRange, setSelectedRange] = useState<DateRangePickerValue>({
    startDate: data.startDate,
    endDate: data.endDate,
  })
  const [boothFilter, setBoothFilter] = useState("all")
  const [employeeFilter, setEmployeeFilter] = useState("all")
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | "all">(
    "all"
  )
  const [softDeletingSale, setSoftDeletingSale] =
    useState<AdminSalesLedgerRow | null>(null)
  const [permanentlyDeletingSale, setPermanentlyDeletingSale] =
    useState<AdminSalesLedgerRow | null>(null)
  const [isPending, startTransition] = useTransition()
  const isTrashView = data.view === "trash"

  useEffect(() => {
    setRows(data.rows)
    setNextCursor(data.nextCursor)
    setSelectedRange({
      startDate: data.startDate,
      endDate: data.endDate,
    })
  }, [data.endDate, data.nextCursor, data.rows, data.startDate])

  useEffect(() => {
    setBoothFilter("all")
    setEmployeeFilter("all")
    setPaymentFilter("all")
  }, [data.view])

  const boothOptions = useMemo(
    () => [
      { value: "all", label: "All booths" },
      ...Array.from(
        new Map(rows.map((row) => [row.boothId, row.boothName])).entries()
      )
        .sort((left, right) => left[1].localeCompare(right[1]))
        .map(([value, label]) => ({ value, label })),
    ],
    [rows]
  )
  const employeeOptions = useMemo(
    () => [
      { value: "all", label: "All employees" },
      ...Array.from(
        new Map(rows.map((row) => [row.employeeId, row.employeeName])).entries()
      )
        .sort((left, right) => left[1].localeCompare(right[1]))
        .map(([value, label]) => ({ value, label })),
    ],
    [rows]
  )
  const paymentOptions = useMemo(
    () => [
      { value: "all", label: "All payments" },
      ...Object.entries(paymentLabels).map(([value, label]) => ({
        value,
        label,
      })),
    ],
    []
  )

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (boothFilter !== "all" && row.boothId !== boothFilter) {
          return false
        }

        if (employeeFilter !== "all" && row.employeeId !== employeeFilter) {
          return false
        }

        if (paymentFilter !== "all" && row.paymentMethod !== paymentFilter) {
          return false
        }

        return true
      }),
    [boothFilter, employeeFilter, paymentFilter, rows]
  )

  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) {
      return
    }

    setIsLoadingMore(true)
    try {
      const page = await loadAdminSalesPage(
        data.startDate,
        data.endDate,
        nextCursor,
        data.view
      )
      setRows((current) => {
        const byId = new Map(current.map((row) => [row.id, row]))
        for (const row of page.rows) {
          byId.set(row.id, row)
        }
        return Array.from(byId.values())
      })
      setNextCursor(page.nextCursor)
    } catch (error) {
      console.error("Unable to load more sales:", error)
      toast.error("Unable to load more sales.")
    } finally {
      setIsLoadingMore(false)
    }
  }

  const summary = useMemo(() => {
    const cashRevenue = filteredRows.reduce((total, row) => {
      return row.paymentMethod === "cash" ? total + row.totalAmount : total
    }, 0)

    return {
      revenue: filteredRows.reduce((total, row) => total + row.totalAmount, 0),
      saleCount: filteredRows.length,
      cashRevenue,
      nonCashRevenue: filteredRows.reduce((total, row) => {
        return row.paymentMethod !== "cash" ? total + row.totalAmount : total
      }, 0),
    }
  }, [filteredRows])

  const handleDateRangeChange = (nextValue: DateRangePickerValue) => {
    setSelectedRange(nextValue)

    startTransition(() => {
      router.push(
        buildSalesRoute(nextValue.startDate, nextValue.endDate, data.view)
      )
    })
  }

  const handleViewChange = (view: AdminSalesLedgerView) => {
    if (view === data.view) {
      return
    }

    startTransition(() => {
      router.push(
        buildSalesRoute(selectedRange.startDate, selectedRange.endDate, view)
      )
    })
  }

  const handleCopySaleId = useCallback(async (saleId: string) => {
    try {
      await navigator.clipboard.writeText(saleId)
      toast.success("Sale ID copied.")
    } catch {
      toast.error("Unable to copy the sale ID.")
    }
  }, [])

  const handleSoftDeleteSale = async () => {
    if (!softDeletingSale) {
      return
    }

    const result = await submitSaleChange({
      saleId: softDeletingSale.id,
      actionType: "delete_sale",
      saleUpdatedAt: softDeletingSale.updatedAt,
    })

    if (!result.ok) {
      toast.error(result.error ?? "Unable to delete this sale.")
      throw new Error(result.error ?? "Unable to delete this sale.")
    }

    setRows((current) =>
      current.filter((row) => row.id !== softDeletingSale.id)
    )
    toast.success(result.message ?? "Sale moved to trash.")
    router.refresh()
  }

  const handlePermanentDeleteSale = async () => {
    if (!permanentlyDeletingSale) {
      return
    }

    const result = await deleteSalePermanently(permanentlyDeletingSale.id)
    if (!result.ok) {
      toast.error(result.error ?? "Unable to delete this sale permanently.")
      throw new Error(result.error ?? "Unable to delete this sale permanently.")
    }

    setRows((current) =>
      current.filter((row) => row.id !== permanentlyDeletingSale.id)
    )
    toast.success(result.message ?? "Sale deleted permanently.")
    router.refresh()
  }

  const getSalesSearchText = useCallback((row: AdminSalesLedgerRow) => {
    return [
      row.id,
      row.boothName,
      row.employeeName,
      row.shiftLabel,
      paymentLabels[row.paymentMethod],
      row.status,
      row.totalAmount,
    ].join(" ")
  }, [])

  const columns = useMemo<ColumnDef<AdminSalesLedgerRow>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Recorded" />
        ),
        cell: ({ row }) => (
          <div className="flex min-w-[10rem] flex-col gap-0.5">
            <span className="text-foreground font-medium">
              {data.startDate === data.endDate
                ? formatTime(row.original.createdAt)
                : formatDateTime(row.original.createdAt)}
            </span>
            <span className="text-muted-foreground text-xs">
              {row.original.shiftLabel}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "id",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Receipt ID" />
        ),
        cell: ({ row }) => (
          <div className="text-muted-foreground font-mono text-xs">
            {row.original.id.slice(0, 8)}
          </div>
        ),
      },
      {
        accessorKey: "boothName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Booth" />
        ),
        cell: ({ row }) => (
          <div className="flex min-w-[10rem] items-center gap-2">
            <Store className="text-primary" />
            <span className="text-foreground font-medium">
              {row.original.boothName}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "employeeName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Employee" />
        ),
        cell: ({ row }) => (
          <div className="flex min-w-[10rem] items-center gap-2">
            <UserRound className="text-primary" />
            <span>{row.original.employeeName}</span>
          </div>
        ),
      },
      {
        accessorKey: "paymentMethod",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Payment" />
        ),
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.paymentMethod === "cash" ? "outline" : "secondary"
            }
            className={cn(
              "rounded-full px-2 py-0.5 text-[0.65rem] font-semibold tracking-[0.18em] uppercase",
              row.original.paymentMethod === "cash" &&
                "border-success/20 bg-success/10 text-success"
            )}
          >
            {paymentLabels[row.original.paymentMethod]}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.status === "completed" ? "outline" : "secondary"
            }
            className={cn(
              "rounded-full px-2 py-0.5 text-[0.65rem] font-semibold tracking-[0.18em] uppercase",
              row.original.status === "completed" &&
                "border-primary/20 bg-primary/5 text-primary"
            )}
          >
            {formatStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        accessorKey: "totalAmount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Amount" align="right" />
        ),
        cell: ({ row }) => (
          <div className="text-foreground text-right font-semibold">
            {formatCurrency(row.original.totalAmount)}
          </div>
        ),
      },
      {
        id: "receipt",
        accessorFn: (row) => (row.hasReceipt ? "available" : "missing"),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Receipt" />
        ),
        cell: ({ row }) => (
          <ReceiptPhotoPreview
            saleId={row.original.id}
            paymentMethod={row.original.paymentMethod}
            receiptPhotoPath={row.original.receiptPhotoPath}
            canEditReceipt={row.original.canEditReceipt}
            boothName={row.original.boothName}
            employeeName={row.original.employeeName}
            shiftLabel={row.original.shiftLabel}
            createdAt={row.original.createdAt}
            amount={row.original.totalAmount}
            fallback={
              <Badge
                variant={row.original.hasReceipt ? "secondary" : "outline"}
              >
                {row.original.hasReceipt ? "Available" : "Not required"}
              </Badge>
            }
          />
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon-sm" />}
              >
                <Ellipsis />
                <span className="sr-only">Open sale actions</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handleCopySaleId(row.original.id)}
                >
                  <Copy data-icon="inline-start" />
                  Copy Sale ID
                </DropdownMenuItem>
                {isTrashView ? (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setPermanentlyDeletingSale(row.original)}
                  >
                    <Trash2 data-icon="inline-start" />
                    Delete Permanently
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setSoftDeletingSale(row.original)}
                  >
                    <Trash2 data-icon="inline-start" />
                    Move to Trash
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [data.endDate, data.startDate, handleCopySaleId, isTrashView]
  )

  return (
    <div className="app-page flex flex-col gap-6">
      <header className="app-screen-header">
        <div className="app-screen-copy">
          <h1 className="app-screen-title">
            {isTrashView ? "Sales Trash" : "Sales"}
          </h1>
          <p className="app-screen-description">
            {isTrashView
              ? "Restore context, then permanently delete sales when you are sure."
              : "Filter sales by date, booth, employee, or payment."}
          </p>
        </div>
        <div className="app-screen-actions">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={isTrashView ? "outline" : "secondary"}
              onClick={() => handleViewChange("active")}
            >
              Sales
            </Button>
            <Button
              type="button"
              variant={isTrashView ? "secondary" : "outline"}
              onClick={() => handleViewChange("trash")}
            >
              <Trash2 data-icon="inline-start" />
              Trash
            </Button>
          </div>
          <DateRangePicker
            value={selectedRange}
            onChange={handleDateRangeChange}
          />
          <Badge variant="outline">
            <Wallet data-icon="inline-start" />
            {data.startDate === data.endDate
              ? data.startDate
              : `${data.startDate} to ${data.endDate}`}
          </Badge>
        </div>
      </header>

      {isPending ? (
        <div className="app-banner">
          <Loader2 className="text-primary animate-spin" />
          Loading sales data...
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>
              {isTrashView ? "Deleted Value" : "Total Revenue"}
            </CardTitle>
            <CardDescription>
              {isTrashView ? "Visible deleted sales" : "Visible filtered sales"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-primary text-3xl font-semibold">
              {formatCurrency(summary.revenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              {isTrashView ? "Deleted Rows" : "Transactions"}
            </CardTitle>
            <CardDescription>Rows matching current filters</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-foreground text-3xl font-semibold">
              {summary.saleCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              {isTrashView ? "Deleted Cash" : "Cash Revenue"}
            </CardTitle>
            <CardDescription>
              {isTrashView ? "Cash sales in trash" : "Cash-only totals"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-foreground text-3xl font-semibold">
              {formatCurrency(summary.cashRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              {isTrashView ? "Deleted Non-Cash" : "Non-Cash Revenue"}
            </CardTitle>
            <CardDescription>
              {isTrashView
                ? "Non-cash sales in trash"
                : "Receipt-backed totals"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-foreground text-3xl font-semibold">
              {formatCurrency(summary.nonCashRevenue)}
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{isTrashView ? "Trash" : "Sales Ledger"}</CardTitle>
          <CardDescription>
            {isTrashView
              ? "Deleted sales stay here until you remove them permanently."
              : "Sort and filter transaction records without leaving the page."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filteredRows}
            searchPlaceholder="Search receipt ID, booth, employee, or shift"
            getSearchText={getSalesSearchText}
            emptyMessage={
              isTrashView
                ? "Trash is empty for the current filters."
                : "No sales match the current filters."
            }
            initialSorting={[{ id: "createdAt", desc: true }]}
            toolbarContent={
              <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Select
                  value={boothFilter === "all" ? SALES_FILTER_ALL : boothFilter}
                  onValueChange={(value) =>
                    setBoothFilter(
                      value === SALES_FILTER_ALL ? "all" : (value ?? "all")
                    )
                  }
                >
                  <SelectTrigger className="h-10 sm:w-[190px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {boothOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={
                          option.value === "all"
                            ? SALES_FILTER_ALL
                            : option.value
                        }
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={
                    employeeFilter === "all" ? SALES_FILTER_ALL : employeeFilter
                  }
                  onValueChange={(value) =>
                    setEmployeeFilter(
                      value === SALES_FILTER_ALL ? "all" : (value ?? "all")
                    )
                  }
                >
                  <SelectTrigger className="h-10 sm:w-[190px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {employeeOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={
                          option.value === "all"
                            ? SALES_FILTER_ALL
                            : option.value
                        }
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={
                    paymentFilter === "all" ? SALES_FILTER_ALL : paymentFilter
                  }
                  onValueChange={(value) =>
                    setPaymentFilter(
                      value === SALES_FILTER_ALL
                        ? "all"
                        : ((value ?? "all") as PaymentMethod | "all")
                    )
                  }
                >
                  <SelectTrigger className="h-10 sm:w-[190px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={
                          option.value === "all"
                            ? SALES_FILTER_ALL
                            : option.value
                        }
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            }
          />
          {nextCursor ? (
            <div className="mt-4 flex justify-center">
              <Button
                type="button"
                variant="outline"
                disabled={isLoadingMore}
                onClick={() => void handleLoadMore()}
              >
                {isLoadingMore ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : null}
                Load 100 More
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={Boolean(softDeletingSale)}
        onOpenChange={(open) => {
          if (!open) {
            setSoftDeletingSale(null)
          }
        }}
        title="Move this sale to trash?"
        description="This soft-deletes the sale and removes it from live sales totals while keeping it available in trash."
        confirmLabel="Move to Trash"
        pendingLabel="Moving..."
        cancelLabel="Keep Sale"
        variant="destructive"
        onConfirm={handleSoftDeleteSale}
      />
      <ConfirmDialog
        open={Boolean(permanentlyDeletingSale)}
        onOpenChange={(open) => {
          if (!open) {
            setPermanentlyDeletingSale(null)
          }
        }}
        title="Delete this sale permanently?"
        description="This removes the trashed sale and its receipt file permanently."
        confirmLabel="Delete Permanently"
        pendingLabel="Deleting..."
        cancelLabel="Keep Sale"
        variant="destructive"
        onConfirm={handlePermanentDeleteSale}
      />
    </div>
  )
}
