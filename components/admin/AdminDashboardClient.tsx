"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { CalendarDays, Loader2, Radio } from "lucide-react"

import { DataTable } from "@/components/shared/DataTable"
import { DataTableColumnHeader } from "@/components/shared/DataTableColumnHeader"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type {
  AdminDashboardData,
  DashboardBoothCard,
  DashboardPaymentBreakdown,
} from "@/lib/adminDashboard"
import { createClient } from "@/lib/supabase"
import { formatCurrency, getBusinessDate } from "@/lib/utils"

type AdminDashboardClientProps = {
  data: AdminDashboardData
}

const paymentLabels: Record<string, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  maribank: "Maribank",
  unionbank: "UnionBank",
  other: "Other",
}

export function AdminDashboardClient({ data }: AdminDashboardClientProps) {
  const router = useRouter()
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selectedDate, setSelectedDate] = useState(data.selectedDate)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setSelectedDate(data.selectedDate)
  }, [data.selectedDate])

  useEffect(() => {
    if (!data.isLiveDate) {
      return
    }

    const supabase = createClient()
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }

      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null
        router.refresh()
      }, 500)
    }
    const channel = supabase
      .channel("admin-dashboard-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales" },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booth_schedules" },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shift_closeouts" },
        scheduleRefresh
      )
      .subscribe()

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
      void supabase.removeChannel(channel)
    }
  }, [data.isLiveDate, router])

  const handleDateChange = (nextDate: string) => {
    setSelectedDate(nextDate)
    startTransition(() => {
      if (nextDate === getBusinessDate()) {
        router.push("/admin/dashboard")
        return
      }

      router.push(`/admin/dashboard?date=${nextDate}`)
    })
  }

  const paymentColumns = useMemo<ColumnDef<DashboardPaymentBreakdown>[]>(
    () => [
      {
        accessorKey: "method",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Method" />
        ),
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {paymentLabels[row.original.method]}
          </span>
        ),
      },
      {
        accessorKey: "count",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Transactions" />
        ),
        cell: ({ row }) => row.original.count,
      },
      {
        accessorKey: "total",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Total" align="right" />
        ),
        cell: ({ row }) => (
          <div className="text-right font-semibold text-foreground">
            {formatCurrency(row.original.total)}
          </div>
        ),
      },
    ],
    []
  )

  const boothColumns = useMemo<ColumnDef<DashboardBoothCard>[]>(
    () => [
      {
        accessorKey: "boothName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Booth" />
        ),
        cell: ({ row }) => (
          <div className="flex min-w-[12rem] flex-col gap-0.5">
            <span className="font-medium text-foreground">
              {row.original.boothName}
            </span>
            <span className="text-sm text-muted-foreground">
              {row.original.isActive ? "Active booth" : "Inactive booth"}
            </span>
          </div>
        ),
      },
      {
        id: "status",
        accessorFn: (row) => (row.isActive ? "active" : "inactive"),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "default" : "outline"}>
            {row.original.isActive ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      {
        accessorKey: "totalRevenue",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Revenue"
            align="right"
          />
        ),
        cell: ({ row }) => (
          <div className="text-right font-semibold text-foreground">
            {formatCurrency(row.original.totalRevenue)}
          </div>
        ),
      },
      {
        accessorKey: "saleCount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Sales" align="right" />
        ),
        cell: ({ row }) => (
          <div className="text-right">{row.original.saleCount}</div>
        ),
      },
      {
        accessorKey: "cashRevenue",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Cash" align="right" />
        ),
        cell: ({ row }) => (
          <div className="text-right">
            {formatCurrency(row.original.cashRevenue)}
          </div>
        ),
      },
      {
        accessorKey: "nonCashRevenue",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Non-Cash"
            align="right"
          />
        ),
        cell: ({ row }) => (
          <div className="text-right">
            {formatCurrency(row.original.nonCashRevenue)}
          </div>
        ),
      },
      {
        accessorKey: "openShiftCount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Open" align="right" />
        ),
        cell: ({ row }) => (
          <div className="text-right">{row.original.openShiftCount}</div>
        ),
      },
      {
        accessorKey: "closedShiftCount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Closed" align="right" />
        ),
        cell: ({ row }) => (
          <div className="text-right">{row.original.closedShiftCount}</div>
        ),
      },
      {
        accessorKey: "cancelledShiftCount",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Cancelled"
            align="right"
          />
        ),
        cell: ({ row }) => (
          <div className="text-right">{row.original.cancelledShiftCount}</div>
        ),
      },
    ],
    []
  )

  const getBoothSearchText = useMemo(
    () => (row: DashboardBoothCard) =>
      [
        row.boothName,
        row.isActive ? "active" : "inactive",
        row.totalRevenue,
        row.saleCount,
      ].join(" "),
    []
  )

  return (
    <div className="app-page flex flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="app-kicker">Admin Workspace</p>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="app-caption">
            Revenue, payment mix, and booth performance for the selected
            business day.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker
            mode="single"
            value={selectedDate}
            onChange={handleDateChange}
          />
          <Badge variant={data.isLiveDate ? "default" : "outline"}>
            {data.isLiveDate ? (
              <>
                <Radio data-icon="inline-start" />
                Live today
              </>
            ) : (
              <>
                <CalendarDays data-icon="inline-start" />
                Historical day
              </>
            )}
          </Badge>
        </div>
      </header>

      {isPending ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Loading dashboard data...
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Revenue</CardTitle>
            <CardDescription>All completed sales</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-primary">
              {formatCurrency(data.summary.totalRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>Completed sale count</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{data.summary.saleCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cash vs Non-Cash</CardTitle>
            <CardDescription>Payment mix for the day</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cash</span>
              <span className="font-medium">
                {formatCurrency(data.summary.cashRevenue)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Non-cash</span>
              <span className="font-medium">
                {formatCurrency(data.summary.nonCashRevenue)}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Shift Status</CardTitle>
            <CardDescription>Open, closed, and cancelled</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Open</span>
              <span className="font-medium">{data.summary.openShiftCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Closed</span>
              <span className="font-medium">
                {data.summary.closedShiftCount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cancelled</span>
              <span className="font-medium">
                {data.summary.cancelledShiftCount}
              </span>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Payment Breakdown</CardTitle>
            <CardDescription>
              Method totals for {data.selectedDate}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={paymentColumns}
              data={data.paymentBreakdown}
              showSearch={false}
              showColumnVisibility={false}
              enablePagination={false}
              emptyMessage="No payment data for the selected day."
              initialSorting={[{ id: "total", desc: true }]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Booth Revenue</CardTitle>
            <CardDescription>
              Performance totals sorted by revenue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={boothColumns}
              data={data.boothCards}
              searchPlaceholder="Search booths"
              getSearchText={getBoothSearchText}
              enablePagination={false}
              emptyMessage="No booth revenue data for the selected day."
              initialSorting={[{ id: "totalRevenue", desc: true }]}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
