"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  CalendarDays,
  CreditCard,
  Loader2,
  Radio,
  Receipt,
  Store,
} from "lucide-react"

import { DataTable } from "@/components/shared/DataTable"
import { DataTableColumnHeader } from "@/components/shared/DataTableColumnHeader"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ReceiptPhotoPreview } from "@/components/shared/ReceiptPhotoPreview"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import type {
  AdminDashboardData,
  DashboardBoothCard,
  DashboardRecentTransaction,
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

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--primary)",
  },
  transactions: {
    label: "Transactions",
    color: "color-mix(in oklab, var(--secondary) 72%, white 12%)",
  },
} as const

const trendDateFormatter = new Intl.DateTimeFormat("en-PH", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Manila",
})

const transactionTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Manila",
})

const transactionDateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "short",
  timeZone: "Asia/Manila",
})

function formatTrendDateLabel(value: string) {
  return trendDateFormatter.format(new Date(`${value}T12:00:00+08:00`))
}

function formatTransactionDateTime(value: string) {
  return transactionDateTimeFormatter.format(new Date(value))
}

function formatTransactionTime(value: string) {
  return transactionTimeFormatter.format(new Date(value))
}

function formatPercentage(value: number) {
  return `${Math.round(value)}%`
}

function titleCase(value: string) {
  return value.replace(/[_-]/g, " ").replace(/\b\w/g, (character) => {
    return character.toUpperCase()
  })
}

function KpiCard({
  title,
  description,
  value,
  accent,
  footer,
  icon: Icon,
}: {
  title: string
  description: string
  value: string
  accent: "primary" | "secondary" | "tertiary"
  footer: string
  icon: typeof Store
}) {
  const accentClassName =
    accent === "primary"
      ? "bg-primary/12 text-primary"
      : accent === "secondary"
        ? "bg-secondary/12 text-secondary"
        : "bg-tertiary/12 text-tertiary"

  return (
    <Card className="border-border/70 bg-card/95 shadow-candy">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardDescription>{description}</CardDescription>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <div
          className={`flex size-11 items-center justify-center rounded-full ${accentClassName}`}
        >
          <Icon />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-foreground text-3xl font-semibold tracking-tight">
          {value}
        </p>
        <p className="text-muted-foreground text-sm">{footer}</p>
      </CardContent>
    </Card>
  )
}

type TrendTooltipRow = {
  color?: string
  dataKey?: string | number
  name?: string | number
  value?: unknown
  payload?: {
    fill?: string
  }
}

function TrendChartTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean
  label?: unknown
  payload?: TrendTooltipRow[]
}) {
  if (!active || !payload?.length) {
    return null
  }

  return (
    <div className="border-border/50 bg-background grid min-w-32 gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{formatTrendDateLabel(String(label))}</div>
      <div className="grid gap-1.5">
        {payload
          .filter((item) => item.value != null && item.name)
          .map((item, index) => (
            <div
              key={index}
              className="flex w-full items-center justify-between gap-4"
            >
              <div className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-[2px]"
                  style={{ backgroundColor: item.color ?? item.payload?.fill }}
                />
                <span className="text-muted-foreground">
                  {item.name === "revenue"
                    ? chartConfig.revenue.label
                    : chartConfig.transactions.label}
                </span>
              </div>
              <span className="text-foreground font-medium">
                {item.name === "revenue"
                  ? formatCurrency(Number(item.value))
                  : Number(item.value)}
              </span>
            </div>
          ))}
      </div>
    </div>
  )
}

function TrendChartLegend({
  payload,
}: {
  payload?: Array<{
    color?: string
    dataKey?: string | number
    type?: string
  }>
}) {
  if (!payload?.length) {
    return null
  }

  return (
    <div className="flex items-center justify-center gap-4 pb-3">
      {payload
        .filter((item) => item.type !== "none")
        .map((item, index) => {
          const dataKey = String(item.dataKey ?? "value")
          const label =
            dataKey === "revenue"
              ? chartConfig.revenue.label
              : chartConfig.transactions.label

          return (
            <div
              key={index}
              className="text-muted-foreground flex items-center gap-1.5"
            >
              <div
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: item.color }}
              />
              <span>{label}</span>
            </div>
          )
        })}
    </div>
  )
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

  const boothColumns = useMemo<ColumnDef<DashboardBoothCard>[]>(
    () => [
      {
        accessorKey: "boothName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Booth" />
        ),
        cell: ({ row }) => (
          <div className="flex min-w-[11rem] flex-col gap-1">
            <span className="text-foreground font-medium">
              {row.original.boothName}
            </span>
            <span className="text-muted-foreground text-sm">
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
            align="right"
            column={column}
            title="Revenue"
          />
        ),
        cell: ({ row }) => (
          <div className="text-foreground text-right font-semibold">
            {formatCurrency(row.original.totalRevenue)}
          </div>
        ),
      },
      {
        accessorKey: "saleCount",
        header: ({ column }) => (
          <DataTableColumnHeader align="right" column={column} title="Sales" />
        ),
        cell: ({ row }) => (
          <div className="text-right">{row.original.saleCount}</div>
        ),
      },
      {
        accessorKey: "cashRevenue",
        header: ({ column }) => (
          <DataTableColumnHeader align="right" column={column} title="Cash" />
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
            align="right"
            column={column}
            title="Non-cash"
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
          <DataTableColumnHeader align="right" column={column} title="Open" />
        ),
        cell: ({ row }) => (
          <div className="text-right">{row.original.openShiftCount}</div>
        ),
      },
      {
        accessorKey: "closedShiftCount",
        header: ({ column }) => (
          <DataTableColumnHeader align="right" column={column} title="Closed" />
        ),
        cell: ({ row }) => (
          <div className="text-right">{row.original.closedShiftCount}</div>
        ),
      },
      {
        accessorKey: "cancelledShiftCount",
        header: ({ column }) => (
          <DataTableColumnHeader
            align="right"
            column={column}
            title="Cancelled"
          />
        ),
        cell: ({ row }) => (
          <div className="text-right">{row.original.cancelledShiftCount}</div>
        ),
      },
    ],
    []
  )

  const recentTransactionColumns = useMemo<
    ColumnDef<DashboardRecentTransaction>[]
  >(
    () => [
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Time" />
        ),
        cell: ({ row }) => (
          <div className="flex min-w-[8.5rem] flex-col gap-1">
            <span className="text-foreground font-medium">
              {formatTransactionTime(row.original.createdAt)}
            </span>
            <span className="text-muted-foreground text-xs">
              {formatTransactionDateTime(row.original.createdAt)}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "boothName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Booth" />
        ),
        cell: ({ row }) => (
          <div className="flex min-w-[9rem] flex-col gap-1">
            <span className="text-foreground font-medium">
              {row.original.boothName}
            </span>
            <span className="text-muted-foreground text-xs">
              {row.original.employeeName}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "paymentMethod",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Payment" />
        ),
        cell: ({ row }) => (
          <Badge variant="secondary">
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
          <Badge variant="outline">{titleCase(row.original.status)}</Badge>
        ),
      },
      {
        id: "receipt",
        accessorFn: (row) => (row.hasReceipt ? "attached" : "cash"),
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
            createdAt={row.original.createdAt}
            amount={row.original.totalAmount}
            fallback={
              <span className="text-muted-foreground text-sm">
                {row.original.hasReceipt ? "Attached" : "Cash sale"}
              </span>
            }
          />
        ),
      },
      {
        accessorKey: "totalAmount",
        header: ({ column }) => (
          <DataTableColumnHeader align="right" column={column} title="Total" />
        ),
        cell: ({ row }) => (
          <div className="text-foreground text-right font-semibold">
            {formatCurrency(row.original.totalAmount)}
          </div>
        ),
      },
    ],
    []
  )

  const getBoothSearchText = useMemo(
    () => (row: DashboardBoothCard) => {
      return [
        row.boothName,
        row.isActive ? "active" : "inactive",
        row.totalRevenue,
        row.saleCount,
        row.cashRevenue,
        row.nonCashRevenue,
      ].join(" ")
    },
    []
  )

  const getTransactionSearchText = useMemo(
    () => (row: DashboardRecentTransaction) => {
      return [
        row.boothName,
        row.employeeName,
        paymentLabels[row.paymentMethod],
        row.status,
        row.totalAmount,
      ].join(" ")
    },
    []
  )

  const activePaymentBreakdown = data.paymentBreakdown.filter(
    (entry) => entry.count > 0
  )
  const averageTicket =
    data.summary.saleCount > 0
      ? data.summary.totalRevenue / data.summary.saleCount
      : 0

  return (
    <div className="app-page flex flex-col gap-6">
      <header className="app-screen-header">
        <div className="app-screen-copy">
          <h1 className="app-screen-title">Performance dashboard</h1>
          <p className="app-screen-description">
            Daily sales for the selected date.
          </p>
        </div>

        <div className="app-screen-actions">
          <DateRangePicker
            mode="single"
            value={selectedDate}
            onChange={handleDateChange}
          />
        </div>
      </header>

      {isPending ? (
        <div className="app-banner">
          <Loader2 className="text-primary size-4 animate-spin" />
          Loading dashboard data...
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-3">
        <KpiCard
          title="Revenue"
          description="Completed sales for the selected day"
          value={formatCurrency(data.summary.totalRevenue)}
          accent="primary"
          footer={`Average ticket ${formatCurrency(averageTicket)}`}
          icon={CreditCard}
        />
        <KpiCard
          title="Transactions"
          description="Recorded sale count"
          value={data.summary.saleCount.toString()}
          accent="secondary"
          footer={`${activePaymentBreakdown.length} payment method${activePaymentBreakdown.length === 1 ? "" : "s"} used`}
          icon={Receipt}
        />
        <KpiCard
          title="Shift coverage"
          description="Open, closed, and cancelled schedules"
          value={`${data.summary.openShiftCount}/${data.summary.closedShiftCount}/${data.summary.cancelledShiftCount}`}
          accent="tertiary"
          footer="Open / Closed / Cancelled"
          icon={Store}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(22rem,1fr)]">
        <Card className="border-border/70 bg-card/95 shadow-candy">
          <CardHeader className="gap-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle>Seven-day revenue trend</CardTitle>
                <CardDescription>
                  Revenue and transaction count ending on {data.selectedDate}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {data.trendSeries.length} day window
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div
              className="[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted min-h-72 w-full [&_.recharts-surface]:outline-hidden"
              style={
                {
                  "--color-revenue": chartConfig.revenue.color,
                  "--color-transactions": chartConfig.transactions.color,
                } as React.CSSProperties
              }
            >
              <ResponsiveContainer
                initialDimension={{ width: 320, height: 200 }}
              >
                <ComposedChart data={data.trendSeries}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="date"
                    minTickGap={24}
                    tickFormatter={formatTrendDateLabel}
                    tickLine={false}
                    tickMargin={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickFormatter={(value) => formatCurrency(Number(value))}
                    tickLine={false}
                    tickMargin={12}
                    yAxisId="revenue"
                    width={96}
                  />
                  <YAxis
                    hide
                    yAxisId="transactions"
                    orientation="right"
                    width={0}
                  />
                  <Tooltip content={<TrendChartTooltip />} />
                  <Legend content={<TrendChartLegend />} verticalAlign="top" />
                  <Bar
                    dataKey="transactions"
                    fill="var(--color-transactions)"
                    radius={[12, 12, 0, 0]}
                    yAxisId="transactions"
                  />
                  <Line
                    dataKey="revenue"
                    dot={false}
                    stroke="var(--color-revenue)"
                    strokeWidth={3}
                    type="monotone"
                    yAxisId="revenue"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="border-border/70 bg-card/95 shadow-candy">
            <CardHeader className="gap-1">
              <CardTitle>Payment mix</CardTitle>
              <CardDescription>
                Method totals for {data.selectedDate}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {activePaymentBreakdown.length > 0 ? (
                activePaymentBreakdown.map((entry) => {
                  const share =
                    data.summary.saleCount > 0
                      ? (entry.count / data.summary.saleCount) * 100
                      : 0

                  return (
                    <div
                      key={entry.method}
                      className="border-border/70 bg-muted/30 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-foreground font-medium">
                          {paymentLabels[entry.method]}
                        </span>
                        <span className="text-muted-foreground text-sm">
                          {entry.count} transaction
                          {entry.count === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-foreground font-semibold">
                          {formatCurrency(entry.total)}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {formatPercentage(share)}
                        </p>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="border-border bg-muted/20 text-muted-foreground rounded-2xl border border-dashed px-4 py-6 text-sm">
                  No payment activity recorded for this day.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/95 shadow-candy">
            <CardHeader className="gap-1">
              <CardTitle>Top-selling products</CardTitle>
              <CardDescription>
                Best performers from sale-item totals
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {data.topProducts.length > 0 ? (
                data.topProducts.map((product, index) => (
                  <div
                    key={product.productId}
                    className="border-border/70 bg-muted/30 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="bg-primary/12 text-primary flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-foreground truncate font-medium">
                          {product.productName}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {product.quantitySold} sold
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-foreground font-semibold">
                        {formatCurrency(product.revenue)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="border-border bg-muted/20 text-muted-foreground rounded-2xl border border-dashed px-4 py-6 text-sm">
                  No sale items were recorded for this day.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card className="border-border/70 bg-card/95 shadow-candy">
          <CardHeader className="gap-1">
            <CardTitle>Recent transactions</CardTitle>
            <CardDescription>
              Latest recorded sales for the selected business day
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={recentTransactionColumns}
              data={data.recentTransactions}
              emptyMessage="No sales have been recorded for the selected day."
              getSearchText={getTransactionSearchText}
              initialSorting={[{ id: "createdAt", desc: true }]}
              pageSize={8}
              searchPlaceholder="Search by booth, employee, payment, or status"
              showColumnVisibility={false}
            />
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95 shadow-candy">
          <CardHeader className="gap-1">
            <CardTitle>Booth performance</CardTitle>
            <CardDescription>
              Revenue and shift coverage sorted by booth results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={boothColumns}
              data={data.boothCards}
              emptyMessage="No booth data is available for the selected day."
              getSearchText={getBoothSearchText}
              initialSorting={[{ id: "totalRevenue", desc: true }]}
              pageSize={6}
              searchPlaceholder="Search booths"
            />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
