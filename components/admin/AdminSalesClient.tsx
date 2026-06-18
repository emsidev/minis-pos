"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import {
  Copy,
  Ellipsis,
  Loader2,
  Receipt,
  Store,
  UserRound,
  Wallet,
} from "lucide-react"
import { toast } from "sonner"

import { getReceiptSignedUrl } from "@/app/actions/receipts"
import { loadAdminSalesPage } from "@/app/actions/adminSales"
import { DataTable } from "@/components/shared/DataTable"
import { DataTableColumnHeader } from "@/components/shared/DataTableColumnHeader"
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
import { SingleSelect } from "@/components/ui/single-select"
import type {
  AdminSalesLedgerData,
  AdminSalesLedgerRow,
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
  const [pendingReceiptId, setPendingReceiptId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setRows(data.rows)
    setNextCursor(data.nextCursor)
    setSelectedRange({
      startDate: data.startDate,
      endDate: data.endDate,
    })
  }, [data.endDate, data.nextCursor, data.rows, data.startDate])

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
        nextCursor
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
      const businessDate = getBusinessDate()
      if (
        nextValue.startDate === businessDate &&
        nextValue.endDate === businessDate
      ) {
        router.push("/admin/sales")
        return
      }

      const params = new URLSearchParams({
        from: nextValue.startDate,
        to: nextValue.endDate,
      })
      router.push(`/admin/sales?${params.toString()}`)
    })
  }

  const handleReceiptView = useCallback(async (row: AdminSalesLedgerRow) => {
    if (!row.receiptPhotoPath) {
      toast.error("Receipt photo is not available.")
      return
    }

    setPendingReceiptId(row.id)
    const result = await getReceiptSignedUrl(row.receiptPhotoPath)
    setPendingReceiptId(null)

    if (!result.ok || !result.signedUrl) {
      toast.error(result.error ?? "Unable to load this receipt photo.")
      return
    }

    window.open(result.signedUrl, "_blank", "noopener,noreferrer")
  }, [])

  const handleCopySaleId = useCallback(async (saleId: string) => {
    try {
      await navigator.clipboard.writeText(saleId)
      toast.success("Sale ID copied.")
    } catch {
      toast.error("Unable to copy the sale ID.")
    }
  }, [])

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
            <span className="font-medium text-foreground">
              {data.startDate === data.endDate
                ? formatTime(row.original.createdAt)
                : formatDateTime(row.original.createdAt)}
            </span>
            <span className="text-xs text-muted-foreground">
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
          <div className="font-mono text-xs text-muted-foreground">
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
            <span className="font-medium text-foreground">
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
              "rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em]",
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
              "rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em]",
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
          <div className="text-right font-semibold text-foreground">
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
          <Badge variant={row.original.hasReceipt ? "secondary" : "outline"}>
            {row.original.hasReceipt ? "Available" : "Not required"}
          </Badge>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const pending = pendingReceiptId === row.original.id

          return (
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
                  <DropdownMenuItem
                    disabled={!row.original.hasReceipt || pending}
                    onClick={() => handleReceiptView(row.original)}
                  >
                    {pending ? (
                      <Loader2
                        data-icon="inline-start"
                        className="animate-spin"
                      />
                    ) : (
                      <Receipt data-icon="inline-start" />
                    )}
                    View Receipt
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [
      data.endDate,
      data.startDate,
      handleCopySaleId,
      handleReceiptView,
      pendingReceiptId,
    ]
  )

  return (
    <div className="app-page flex flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <p className="app-kicker">Admin Workspace</p>
          <h1 className="text-3xl font-semibold">Sales</h1>
          <p className="app-caption">
            Review transaction history by date, booth, employee, and payment
            method.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="animate-spin text-primary" />
          Loading sales data...
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Revenue</CardTitle>
            <CardDescription>Visible filtered sales</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-primary">
              {formatCurrency(summary.revenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>Rows matching current filters</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground">
              {summary.saleCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cash Revenue</CardTitle>
            <CardDescription>Cash-only totals</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground">
              {formatCurrency(summary.cashRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Non-Cash Revenue</CardTitle>
            <CardDescription>Receipt-backed totals</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground">
              {formatCurrency(summary.nonCashRevenue)}
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Sales Ledger</CardTitle>
          <CardDescription>
            Sort and filter transaction records without leaving the page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filteredRows}
            searchPlaceholder="Search receipt ID, booth, employee, or shift"
            getSearchText={getSalesSearchText}
            emptyMessage="No sales match the current filters."
            initialSorting={[{ id: "createdAt", desc: true }]}
            toolbarContent={
              <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap">
                <SingleSelect
                  value={boothFilter}
                  onChange={setBoothFilter}
                  options={boothOptions}
                  placeholder="All booths"
                  className="sm:w-[190px]"
                />

                <SingleSelect
                  value={employeeFilter}
                  onChange={setEmployeeFilter}
                  options={employeeOptions}
                  placeholder="All employees"
                  className="sm:w-[190px]"
                />

                <SingleSelect
                  value={paymentFilter}
                  onChange={(value) =>
                    setPaymentFilter(value as PaymentMethod | "all")
                  }
                  options={paymentOptions}
                  placeholder="All payments"
                  className="sm:w-[190px]"
                />
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
    </div>
  )
}
