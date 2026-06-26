"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import {
  Boxes,
  ClipboardList,
  CreditCard,
  Loader2,
  Receipt,
  ShieldCheck,
  Store,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react"
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

import { DataTable } from "@/components/shared/DataTable"
import { DataTableColumnHeader } from "@/components/shared/DataTableColumnHeader"
import { ReceiptPhotoPreview } from "@/components/shared/ReceiptPhotoPreview"
import { Badge } from "@/components/ui/badge"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

type BoothDaySalesGroupBy = "date-booth" | "date" | "booth"

type DashboardBoothSalesTableRow = {
  id: string
  date: string
  dateLabel: string
  boothId: string
  boothLabel: string
  boothName: string
  saleCount: number
  totalRevenue: number
  averageTicket: number
  unitsSold: number
  cashRevenue: number
  nonCashRevenue: number
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

function formatSignedCurrency(value: number) {
  if (value > 0) {
    return `+${formatCurrency(value)}`
  }

  if (value < 0) {
    return `-${formatCurrency(Math.abs(value))}`
  }

  return formatCurrency(0)
}

function formatSignedNumber(value: number) {
  if (value > 0) {
    return `+${value}`
  }

  return value.toString()
}

function formatDayCount(dayCount: number) {
  return `${dayCount} day${dayCount === 1 ? "" : "s"}`
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
  icon: LucideIcon
}) {
  const accentClassName =
    accent === "primary"
      ? "bg-primary/12 text-primary"
      : accent === "secondary"
        ? "bg-secondary/12 text-secondary"
        : "bg-tertiary/12 text-tertiary"

  return (
    <Card className="border-border/70 bg-card/95 shadow-candy">
      <CardHeader className="flex flex-row items-start justify-between gap-2 px-3 pt-3 sm:gap-3 sm:px-6 sm:pt-6">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-full sm:size-11 ${accentClassName}`}
        >
          <Icon className="size-5" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-3 pb-3 sm:gap-3 sm:px-6 sm:pb-6">
        <p className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
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
    <div className="border-border/50 bg-background grid min-w-36 gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
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
    <div className="flex flex-wrap items-center justify-center gap-4 pb-3">
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
              className="text-muted-foreground flex items-center gap-1.5 text-sm"
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

function DenseListEmpty({ message }: { message: string }) {
  return (
    <div className="border-border bg-muted/20 text-muted-foreground rounded-2xl border border-dashed px-4 py-6 text-sm">
      {message}
    </div>
  )
}

export function AdminDashboardClient({ data }: AdminDashboardClientProps) {
  const router = useRouter()
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selectedRange, setSelectedRange] = useState<DateRangePickerValue>({
    startDate: data.dateRange.startDate,
    endDate: data.dateRange.endDate,
  })
  const [boothDaySalesGroupBy, setBoothDaySalesGroupBy] =
    useState<BoothDaySalesGroupBy>("date-booth")
  const [boothDaySalesDateFilter, setBoothDaySalesDateFilter] =
    useState<string>("all")
  const [boothDaySalesBoothFilter, setBoothDaySalesBoothFilter] =
    useState<string>("all")
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setSelectedRange({
      startDate: data.dateRange.startDate,
      endDate: data.dateRange.endDate,
    })
  }, [data.dateRange.endDate, data.dateRange.startDate])

  const boothDaySaleDateOptions = useMemo(
    () =>
      Array.from(new Set(data.boothDaySales.map((row) => row.date))).sort(
        (left, right) => right.localeCompare(left)
      ),
    [data.boothDaySales]
  )

  const boothDaySaleBoothOptions = useMemo(
    () =>
      Array.from(
        new Map(data.boothDaySales.map((row) => [row.boothId, row.boothName]))
      )
        .map(([boothId, boothName]) => ({ boothId, boothName }))
        .sort((left, right) => left.boothName.localeCompare(right.boothName)),
    [data.boothDaySales]
  )

  useEffect(() => {
    if (
      boothDaySalesDateFilter !== "all" &&
      !boothDaySaleDateOptions.includes(boothDaySalesDateFilter)
    ) {
      setBoothDaySalesDateFilter("all")
    }
  }, [boothDaySaleDateOptions, boothDaySalesDateFilter])

  useEffect(() => {
    if (
      boothDaySalesBoothFilter !== "all" &&
      !boothDaySaleBoothOptions.some(
        (option) => option.boothId === boothDaySalesBoothFilter
      )
    ) {
      setBoothDaySalesBoothFilter("all")
    }
  }, [boothDaySaleBoothOptions, boothDaySalesBoothFilter])

  useEffect(() => {
    if (!data.isLiveRange) {
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
      .channel("admin-dashboard-live-range")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales" },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sale_items" },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sale_payments" },
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shift_action_approvals" },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booth_schedule_products" },
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
  }, [data.isLiveRange, router])

  const handleDateRangeChange = (nextRange: DateRangePickerValue) => {
    setSelectedRange(nextRange)

    startTransition(() => {
      const today = getBusinessDate()

      if (nextRange.startDate === today && nextRange.endDate === today) {
        router.push("/admin/dashboard")
        return
      }

      router.push(
        `/admin/dashboard?startDate=${nextRange.startDate}&endDate=${nextRange.endDate}`
      )
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
          <div className="flex min-w-[12rem] flex-col gap-1">
            <span className="text-foreground font-medium">
              {row.original.boothName}
            </span>
            <span className="text-muted-foreground text-xs">
              {row.original.isActive ? "Active booth" : "Inactive booth"}
            </span>
          </div>
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
          <div className="app-tabular-amount text-right font-semibold">
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
          <div className="app-tabular-amount text-right">
            {row.original.saleCount}
          </div>
        ),
      },
      {
        accessorKey: "averageTicket",
        header: ({ column }) => (
          <DataTableColumnHeader
            align="right"
            column={column}
            title="Avg Ticket"
          />
        ),
        cell: ({ row }) => (
          <div className="app-tabular-amount text-right">
            {formatCurrency(row.original.averageTicket)}
          </div>
        ),
      },
      {
        accessorKey: "unitsSold",
        header: ({ column }) => (
          <DataTableColumnHeader align="right" column={column} title="Units" />
        ),
        cell: ({ row }) => (
          <div className="app-tabular-amount text-right">
            {row.original.unitsSold}
          </div>
        ),
      },
      {
        accessorKey: "cashRevenue",
        header: ({ column }) => (
          <DataTableColumnHeader align="right" column={column} title="Cash" />
        ),
        cell: ({ row }) => (
          <div className="app-tabular-amount text-right">
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
          <div className="app-tabular-amount text-right">
            {formatCurrency(row.original.nonCashRevenue)}
          </div>
        ),
      },
      {
        accessorKey: "receiptMissingCount",
        header: ({ column }) => (
          <DataTableColumnHeader
            align="right"
            column={column}
            title="Receipt Missing"
          />
        ),
        cell: ({ row }) => (
          <div className="app-tabular-amount text-right">
            {row.original.receiptMissingCount}
          </div>
        ),
      },
      {
        accessorKey: "cashVariance",
        header: ({ column }) => (
          <DataTableColumnHeader
            align="right"
            column={column}
            title="Cash Var"
          />
        ),
        cell: ({ row }) => (
          <div className="app-tabular-amount text-right">
            {formatSignedCurrency(row.original.cashVariance)}
          </div>
        ),
      },
      {
        accessorKey: "stockVariance",
        header: ({ column }) => (
          <DataTableColumnHeader
            align="right"
            column={column}
            title="Stock Var"
          />
        ),
        cell: ({ row }) => (
          <div className="app-tabular-amount text-right">
            {formatSignedNumber(row.original.stockVariance)}
          </div>
        ),
      },
      {
        accessorKey: "openShiftCount",
        header: ({ column }) => (
          <DataTableColumnHeader align="right" column={column} title="Open" />
        ),
        cell: ({ row }) => (
          <div className="app-tabular-amount text-right">
            {row.original.openShiftCount}
          </div>
        ),
      },
      {
        accessorKey: "closedShiftCount",
        header: ({ column }) => (
          <DataTableColumnHeader align="right" column={column} title="Closed" />
        ),
        cell: ({ row }) => (
          <div className="app-tabular-amount text-right">
            {row.original.closedShiftCount}
          </div>
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
          <div className="app-tabular-amount text-right">
            {row.original.cancelledShiftCount}
          </div>
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
        id: "boothEmployee",
        accessorFn: (row) => `${row.boothName} ${row.employeeName}`,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Booth / Employee" />
        ),
        cell: ({ row }) => (
          <div className="flex min-w-[10rem] flex-col gap-1">
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
        accessorFn: (row) =>
          row.paymentMethod === "cash"
            ? "cash"
            : row.hasReceipt
              ? "attached"
              : "missing",
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
                {row.original.paymentMethod === "cash"
                  ? "Cash sale"
                  : row.original.hasReceipt
                    ? "Attached"
                    : "Missing receipt"}
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
          <div className="app-tabular-amount text-right font-semibold">
            {formatCurrency(row.original.totalAmount)}
          </div>
        ),
      },
    ],
    []
  )

  const boothDaySaleColumns = useMemo<ColumnDef<DashboardBoothSalesTableRow>[]>(
    () => [
      {
        accessorKey: "date",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={boothDaySalesGroupBy === "booth" ? "Range" : "Date"}
          />
        ),
        cell: ({ row }) => (
          <div className="min-w-[8rem] font-medium">
            {row.original.dateLabel}
          </div>
        ),
      },
      {
        accessorKey: "boothLabel",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={boothDaySalesGroupBy === "date" ? "Booths" : "Booth"}
          />
        ),
        cell: ({ row }) => (
          <div className="min-w-[12rem] font-medium">
            {row.original.boothLabel}
          </div>
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
          <div className="app-tabular-amount text-right font-semibold">
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
          <div className="app-tabular-amount text-right">
            {row.original.saleCount}
          </div>
        ),
      },
      {
        accessorKey: "averageTicket",
        header: ({ column }) => (
          <DataTableColumnHeader
            align="right"
            column={column}
            title="Avg Ticket"
          />
        ),
        cell: ({ row }) => (
          <div className="app-tabular-amount text-right">
            {formatCurrency(row.original.averageTicket)}
          </div>
        ),
      },
      {
        accessorKey: "unitsSold",
        header: ({ column }) => (
          <DataTableColumnHeader align="right" column={column} title="Units" />
        ),
        cell: ({ row }) => (
          <div className="app-tabular-amount text-right">
            {row.original.unitsSold}
          </div>
        ),
      },
      {
        accessorKey: "cashRevenue",
        header: ({ column }) => (
          <DataTableColumnHeader align="right" column={column} title="Cash" />
        ),
        cell: ({ row }) => (
          <div className="app-tabular-amount text-right">
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
          <div className="app-tabular-amount text-right">
            {formatCurrency(row.original.nonCashRevenue)}
          </div>
        ),
      },
    ],
    [boothDaySalesGroupBy]
  )

  const getBoothSearchText = useMemo(
    () => (row: DashboardBoothCard) =>
      [
        row.boothName,
        row.isActive ? "active" : "inactive",
        row.totalRevenue,
        row.saleCount,
        row.averageTicket,
        row.unitsSold,
        row.cashRevenue,
        row.nonCashRevenue,
        row.receiptMissingCount,
      ].join(" "),
    []
  )

  const getTransactionSearchText = useMemo(
    () => (row: DashboardRecentTransaction) =>
      [
        row.boothName,
        row.employeeName,
        paymentLabels[row.paymentMethod],
        row.status,
        row.totalAmount,
      ].join(" "),
    []
  )

  const getBoothDaySaleSearchText = useMemo(
    () => (row: DashboardBoothSalesTableRow) =>
      [
        row.date,
        row.dateLabel,
        row.boothLabel,
        row.totalRevenue,
        row.saleCount,
        row.averageTicket,
        row.unitsSold,
        row.cashRevenue,
        row.nonCashRevenue,
      ].join(" "),
    []
  )

  const activePaymentBreakdown = data.paymentBreakdown.filter(
    (entry) => entry.count > 0 || entry.total > 0
  )
  const nonCashShare =
    data.summary.totalRevenue > 0
      ? (data.summary.nonCashRevenue / data.summary.totalRevenue) * 100
      : 0
  const topBooths = data.boothCards.slice(0, 5)
  const topEmployees = data.employeeCards.slice(0, 5)
  const topInventoryRows = data.inventoryInsights.slice(0, 5)
  const filteredBoothDaySales = useMemo(
    () =>
      data.boothDaySales.filter((row) => {
        const matchesDate =
          boothDaySalesDateFilter === "all" ||
          row.date === boothDaySalesDateFilter
        const matchesBooth =
          boothDaySalesBoothFilter === "all" ||
          row.boothId === boothDaySalesBoothFilter

        return matchesDate && matchesBooth
      }),
    [data.boothDaySales, boothDaySalesBoothFilter, boothDaySalesDateFilter]
  )

  const groupedBoothDaySales = useMemo(() => {
    if (boothDaySalesGroupBy === "date-booth") {
      return filteredBoothDaySales.map((row) => ({
        id: `${row.date}:${row.boothId}`,
        date: row.date,
        dateLabel: formatTrendDateLabel(row.date),
        boothId: row.boothId,
        boothLabel: row.boothName,
        boothName: row.boothName,
        saleCount: row.saleCount,
        totalRevenue: row.totalRevenue,
        averageTicket: row.averageTicket,
        unitsSold: row.unitsSold,
        cashRevenue: row.cashRevenue,
        nonCashRevenue: row.nonCashRevenue,
      }))
    }

    const groupedMap = new Map<
      string,
      DashboardBoothSalesTableRow & { boothIds: Set<string> }
    >()

    for (const row of filteredBoothDaySales) {
      const key = boothDaySalesGroupBy === "date" ? row.date : row.boothId
      const current = groupedMap.get(key) ?? {
        id: key,
        date:
          boothDaySalesGroupBy === "date" ? row.date : data.dateRange.startDate,
        dateLabel:
          boothDaySalesGroupBy === "date"
            ? formatTrendDateLabel(row.date)
            : data.dateRange.label,
        boothId: boothDaySalesGroupBy === "date" ? "all" : row.boothId,
        boothLabel:
          boothDaySalesGroupBy === "date" ? "0 booths" : row.boothName,
        boothName: row.boothName,
        saleCount: 0,
        totalRevenue: 0,
        averageTicket: 0,
        unitsSold: 0,
        cashRevenue: 0,
        nonCashRevenue: 0,
        boothIds: new Set<string>(),
      }

      current.saleCount += row.saleCount
      current.totalRevenue += row.totalRevenue
      current.unitsSold += row.unitsSold
      current.cashRevenue += row.cashRevenue
      current.nonCashRevenue += row.nonCashRevenue
      current.boothIds.add(row.boothId)

      groupedMap.set(key, current)
    }

    return Array.from(groupedMap.values()).map((row) => ({
      id: row.id,
      date: row.date,
      dateLabel: row.dateLabel,
      boothId: row.boothId,
      boothLabel:
        boothDaySalesGroupBy === "date"
          ? `${row.boothIds.size} booth${row.boothIds.size === 1 ? "" : "s"}`
          : row.boothName,
      boothName: row.boothName,
      saleCount: row.saleCount,
      totalRevenue: row.totalRevenue,
      averageTicket: row.saleCount > 0 ? row.totalRevenue / row.saleCount : 0,
      unitsSold: row.unitsSold,
      cashRevenue: row.cashRevenue,
      nonCashRevenue: row.nonCashRevenue,
    }))
  }, [
    boothDaySalesGroupBy,
    data.dateRange.label,
    data.dateRange.startDate,
    filteredBoothDaySales,
  ])
  const boothDaySalesToolbar = (
    <>
      <div className="grid w-full gap-3 sm:grid-cols-3">
        <Select
          value={boothDaySalesGroupBy}
          onValueChange={(value) =>
            setBoothDaySalesGroupBy(value as BoothDaySalesGroupBy)
          }
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date-booth">Group: Day + booth</SelectItem>
            <SelectItem value="date">Group: Day totals</SelectItem>
            <SelectItem value="booth">Group: Booth totals</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={boothDaySalesDateFilter}
          onValueChange={(value) => setBoothDaySalesDateFilter(value ?? "all")}
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All dates</SelectItem>
            {boothDaySaleDateOptions.map((date) => (
              <SelectItem key={date} value={date}>
                {formatTrendDateLabel(date)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={boothDaySalesBoothFilter}
          onValueChange={(value) => setBoothDaySalesBoothFilter(value ?? "all")}
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All booths</SelectItem>
            {boothDaySaleBoothOptions.map((option) => (
              <SelectItem key={option.boothId} value={option.boothId}>
                {option.boothName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  )

  return (
    <div className="app-page flex flex-col gap-4 sm:gap-6">
      <header className="app-screen-header">
        <div className="app-screen-copy">
          <h1 className="app-screen-title">Performance dashboard</h1>
          <p className="app-screen-description">
            Single pane of glass for sales, shifts, payments, inventory,
            closeouts, and approvals.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="secondary">
              {data.dateRange.label} · {formatDayCount(data.dateRange.dayCount)}
            </Badge>
            {data.isLiveRange ? (
              <Badge variant="outline">Live range</Badge>
            ) : null}
          </div>
        </div>

        <div className="app-screen-actions">
          <div className="w-full sm:w-auto">
            <DateRangePicker
              value={{
                startDate: selectedRange.startDate,
                endDate: selectedRange.endDate,
              }}
              onChange={handleDateRangeChange}
            />
          </div>
        </div>
      </header>

      {isPending ? (
        <div className="app-banner">
          <Loader2 className="text-primary size-4 animate-spin" />
          Loading dashboard data...
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Revenue"
          description="Completed sales in the selected range"
          value={formatCurrency(data.summary.totalRevenue)}
          accent="primary"
          footer={`Average ticket ${formatCurrency(data.summary.averageTicket)}`}
          icon={CreditCard}
        />
        <KpiCard
          title="Transactions"
          description="Recorded sale count in this date range"
          value={data.summary.saleCount.toString()}
          accent="secondary"
          footer={`${data.summary.unitsSold} units sold`}
          icon={Receipt}
        />
        <KpiCard
          title="Net payment split"
          description="Cash and non-cash mix for the selected range"
          value={
            data.summary.saleCount > 0
              ? `${formatPercentage(nonCashShare)} non-cash`
              : "No sales"
          }
          accent="tertiary"
          footer={`Cash ${formatCurrency(data.summary.cashRevenue)} • Non-cash ${formatCurrency(data.summary.nonCashRevenue)}`}
          icon={Wallet}
        />
        <KpiCard
          title="Shift coverage"
          description="Open, closed, and cancelled schedules"
          value={`${data.summary.openShiftCount}/${data.summary.closedShiftCount}/${data.summary.cancelledShiftCount}`}
          accent="primary"
          footer={`${data.summary.sellingBoothCount} selling booth${data.summary.sellingBoothCount === 1 ? "" : "s"} in range`}
          icon={Store}
        />
        <KpiCard
          title="Receipt compliance"
          description="Non-cash receipt coverage across the range"
          value={formatPercentage(data.summary.receiptComplianceRate)}
          accent="secondary"
          footer={`${data.summary.receiptAttachedCount} attached • ${data.summary.receiptMissingCount} missing`}
          icon={ShieldCheck}
        />
        <KpiCard
          title="Pending approvals"
          description="Workflow changes awaiting review"
          value={data.summary.pendingApprovalCount.toString()}
          accent="tertiary"
          footer={`Pending +${formatCurrency(data.summary.pendingRevenueIncrease)} • Pending -${formatCurrency(data.summary.pendingRevenueDecrease)}`}
          icon={ClipboardList}
        />
        <KpiCard
          title="Closeout variance"
          description="Cash variance across recorded closeouts"
          value={data.closeoutInsight.cashVarianceLabel}
          accent="primary"
          footer={`${data.closeoutInsight.closeoutCount} closeout${data.closeoutInsight.closeoutCount === 1 ? "" : "s"} • Stock ${data.closeoutInsight.stockVarianceLabel}`}
          icon={TriangleAlert}
        />
        <KpiCard
          title="Inventory alerts"
          description="Low-stock lines across scheduled inventory"
          value={data.summary.lowStockLineCount.toString()}
          accent="secondary"
          footer={`${data.inventoryInsights.length} products tracked in this range`}
          icon={Boxes}
        />
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="border-border/70 bg-card/95 shadow-candy">
          <CardHeader className="gap-1">
            <CardTitle>Payment mix</CardTitle>
            <CardDescription>
              Method totals for the selected range
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-3 pb-3 sm:px-6 sm:pb-6">
            {activePaymentBreakdown.length > 0 ? (
              activePaymentBreakdown.map((entry) => (
                <div
                  key={entry.method}
                  className="border-border/70 bg-muted/30 flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 sm:px-4"
                >
                  <div className="min-w-0">
                    <p className="text-foreground truncate font-medium">
                      {paymentLabels[entry.method]}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {entry.count} transaction{entry.count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="app-tabular-amount font-semibold">
                      {formatCurrency(entry.total)}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {formatPercentage(entry.share)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <DenseListEmpty message="No payment activity recorded in this range." />
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95 shadow-candy">
          <CardHeader className="gap-1">
            <CardTitle>Top-selling products</CardTitle>
            <CardDescription>
              Revenue leaders across the selected range
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-3 pb-3 sm:px-6 sm:pb-6">
            {data.topProducts.length > 0 ? (
              data.topProducts.map((product, index) => (
                <div
                  key={product.productId}
                  className="border-border/70 bg-muted/30 flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 sm:px-4"
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
                        {product.quantitySold} sold •{" "}
                        {formatPercentage(product.shareOfRevenue * 100)}
                      </p>
                    </div>
                  </div>
                  <div className="app-tabular-amount text-right font-semibold">
                    {formatCurrency(product.revenue)}
                  </div>
                </div>
              ))
            ) : (
              <DenseListEmpty message="No sale items were recorded in this date range." />
            )}
          </CardContent>
        </Card>
      </section>
      <section>
        <Card className="border-border/70 bg-card/95 shadow-candy">
          <CardHeader className="gap-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle>Revenue trend</CardTitle>
                <CardDescription>
                  Revenue and transaction count for the selected range
                </CardDescription>
              </div>
              <Badge variant="outline">
                {formatDayCount(data.trendSeries.length)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
            <div className="[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted h-[18rem] min-h-[18rem] w-full [&_.recharts-surface]:outline-hidden">
              <ResponsiveContainer
                width="100%"
                height="100%"
                initialDimension={{ width: 320, height: 288 }}
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
                    width={80}
                  />
                  <YAxis
                    hide
                    orientation="right"
                    width={0}
                    yAxisId="transactions"
                  />
                  <Tooltip content={<TrendChartTooltip />} />
                  <Legend content={<TrendChartLegend />} verticalAlign="top" />
                  <Bar
                    dataKey="transactions"
                    fill={chartConfig.transactions.color}
                    radius={[12, 12, 0, 0]}
                    yAxisId="transactions"
                  />
                  <Line
                    dataKey="revenue"
                    dot={false}
                    stroke={chartConfig.revenue.color}
                    strokeWidth={3}
                    type="monotone"
                    yAxisId="revenue"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="border-border/70 bg-card/95 shadow-candy">
          <CardHeader className="gap-1">
            <CardTitle>Booth leaderboard</CardTitle>
            <CardDescription>
              Highest-performing booths in the selected range
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-3 pb-3 sm:px-6 sm:pb-6">
            {topBooths.length > 0 ? (
              topBooths.map((booth) => (
                <div
                  key={booth.boothId}
                  className="border-border/70 bg-muted/30 flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 sm:px-4"
                >
                  <div className="min-w-0">
                    <p className="text-foreground truncate font-medium">
                      {booth.boothName}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted-foreground">
                        {booth.saleCount} sale{booth.saleCount === 1 ? "" : "s"}
                      </span>
                      {booth.receiptMissingCount > 0 ? (
                        <Badge variant="outline">
                          {booth.receiptMissingCount} missing receipt
                          {booth.receiptMissingCount === 1 ? "" : "s"}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="app-tabular-amount text-right font-semibold">
                    {formatCurrency(booth.totalRevenue)}
                  </div>
                </div>
              ))
            ) : (
              <DenseListEmpty message="No booth activity was recorded in this date range." />
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95 shadow-candy">
          <CardHeader className="gap-1">
            <CardTitle>Employee leaderboard</CardTitle>
            <CardDescription>
              Revenue and unit leaders for the selected range
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-3 pb-3 sm:px-6 sm:pb-6">
            {topEmployees.length > 0 ? (
              topEmployees.map((employee) => (
                <div
                  key={employee.employeeId}
                  className="border-border/70 bg-muted/30 flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 sm:px-4"
                >
                  <div className="min-w-0">
                    <p className="text-foreground truncate font-medium">
                      {employee.employeeName}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {employee.saleCount} sale
                      {employee.saleCount === 1 ? "" : "s"} •{" "}
                      {employee.unitsSold} units
                    </p>
                  </div>
                  <div className="app-tabular-amount text-right font-semibold">
                    {formatCurrency(employee.totalRevenue)}
                  </div>
                </div>
              ))
            ) : (
              <DenseListEmpty message="No employee sales were recorded in this date range." />
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95 shadow-candy">
          <CardHeader className="gap-1">
            <CardTitle>Inventory watch</CardTitle>
            <CardDescription>
              Opening, remaining, and low-stock pressure in this range
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-3 pb-3 sm:px-6 sm:pb-6">
            {topInventoryRows.length > 0 ? (
              topInventoryRows.map((product) => (
                <div
                  key={product.productId}
                  className="border-border/70 bg-muted/30 flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 sm:px-4"
                >
                  <div className="min-w-0">
                    <p className="text-foreground truncate font-medium">
                      {product.productName}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {product.remainingStock}/{product.openingStock} remaining
                      • {product.unitsSold} sold
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="app-tabular-amount font-semibold">
                      {product.lowStockLineCount}
                    </p>
                    <p className="text-muted-foreground text-sm">low lines</p>
                  </div>
                </div>
              ))
            ) : (
              <DenseListEmpty message="No inventory rows were recorded in this date range." />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card className="border-border/70 bg-card/95 shadow-candy">
          <CardHeader className="gap-1">
            <CardTitle>Recent transactions</CardTitle>
            <CardDescription>
              Latest recorded sales in this date range
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
            <DataTable
              columns={recentTransactionColumns}
              data={data.recentTransactions}
              emptyMessage="No sales were recorded in this date range."
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
              Revenue, receipts, closeouts, and shift coverage by booth
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
            <DataTable
              columns={boothColumns}
              data={data.boothCards}
              emptyMessage="No booth data is available in this date range."
              getSearchText={getBoothSearchText}
              initialSorting={[{ id: "totalRevenue", desc: true }]}
              pageSize={6}
              searchPlaceholder="Search booths"
            />
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="border-border/70 bg-card/95 shadow-candy">
          <CardHeader className="gap-1">
            <CardTitle>Daily booth sales</CardTitle>
            <CardDescription>
              Sales of each booth for each day in the selected date range
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
            <DataTable
              key={`booth-day-sales-${boothDaySalesGroupBy}-${boothDaySalesDateFilter}-${boothDaySalesBoothFilter}`}
              columns={boothDaySaleColumns}
              data={groupedBoothDaySales}
              emptyMessage="No booth sales were recorded in this date range."
              getSearchText={getBoothDaySaleSearchText}
              initialSorting={
                boothDaySalesGroupBy === "booth"
                  ? [{ id: "totalRevenue", desc: true }]
                  : [
                      { id: "date", desc: true },
                      { id: "totalRevenue", desc: true },
                    ]
              }
              pageSize={10}
              searchPlaceholder="Search by date or booth"
              showColumnVisibility={false}
              toolbarContent={boothDaySalesToolbar}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
