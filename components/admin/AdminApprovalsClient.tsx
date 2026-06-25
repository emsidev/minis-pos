"use client"

import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { Check, CheckCircle2, RefreshCcw, X } from "lucide-react"
import { toast } from "sonner"

import { rejectShiftApproval, resolveShiftApproval } from "@/app/actions/shifts"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  PendingShiftApproval,
  PendingShiftApprovalData,
} from "@/lib/shiftApprovals"
import { getCashDeductionAmount } from "@/lib/shiftApprovals"
import { cn, formatCurrency } from "@/lib/utils"

type AdminApprovalsClientProps = {
  data: PendingShiftApprovalData
}

type ApprovalRow = {
  id: string
  approval: PendingShiftApproval
  boothId: string | null
  boothName: string
  shiftLabel: string
  shiftSort: string
  requestType: string
  requestedBy: string
  requestedAt: string
  requestedAtLabel: string
  details: string
  reason: string | null
  amountLabel: string
  revenueDelta: number
  status: string
}

const APPROVAL_FILTER_ALL = "__all__"

function formatShiftLabel(approval: PendingShiftApproval) {
  const schedule = approval.booth_schedules

  if (!schedule) {
    return "Shift unavailable"
  }

  return `${schedule.date} / ${schedule.start_time.slice(
    0,
    5
  )} - ${schedule.end_time.slice(0, 5)}`
}

function getShiftSortValue(approval: PendingShiftApproval) {
  const schedule = approval.booth_schedules

  if (!schedule) {
    return ""
  }

  return `${schedule.date} ${schedule.start_time}`
}

function getBoothLabel(approval: PendingShiftApproval) {
  return approval.booth_schedules?.booths?.name ?? "Unknown booth"
}

function isPayloadRecord(
  payload: PendingShiftApproval["payload"]
): payload is Record<string, unknown> {
  return (
    typeof payload === "object" && payload !== null && !Array.isArray(payload)
  )
}

function getPayloadValue(approval: PendingShiftApproval, key: string): unknown {
  return isPayloadRecord(approval.payload) ? approval.payload[key] : undefined
}

function getPayloadNumber(approval: PendingShiftApproval, key: string) {
  const value = getPayloadValue(approval, key)
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? 0))

  return Number.isFinite(parsed) ? parsed : 0
}

function getPayloadString(approval: PendingShiftApproval, key: string) {
  const value = getPayloadValue(approval, key)
  return typeof value === "string" && value.trim() ? value : null
}

function formatSignedCurrency(value: number) {
  if (value === 0) {
    return formatCurrency(0)
  }

  return `${value > 0 ? "+" : "-"}${formatCurrency(Math.abs(value))}`
}

function formatShiftTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value))
}

function formatStatusLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function getRequestTypeLabel(approval: PendingShiftApproval) {
  switch (approval.action_type) {
    case "edit_sale":
      return "Edit sale"
    case "delete_sale":
      return "Delete sale"
    case "apply_promo":
      return "Promo"
    case "reopen_shift":
      return "Reopen shift"
    case "cash_deduction":
      return "Cash deduction"
    default:
      return "Request"
  }
}

function getRevenueDelta(approval: PendingShiftApproval) {
  if (approval.action_type === "apply_promo") {
    const explicitDelta = getPayloadNumber(approval, "revenue_delta")

    if (explicitDelta !== 0) {
      return explicitDelta
    }

    return -getPayloadNumber(approval, "promo_discount_total")
  }

  return getPayloadNumber(approval, "revenue_delta")
}

function getApprovalDetails(approval: PendingShiftApproval) {
  const saleId = getPayloadString(approval, "sale_id")
  const previousTotal =
    approval.action_type === "apply_promo"
      ? getPayloadNumber(approval, "subtotal")
      : getPayloadNumber(approval, "previous_total_amount")
  const newTotal =
    approval.action_type === "apply_promo"
      ? getPayloadNumber(approval, "total_amount")
      : getPayloadNumber(approval, "new_total_amount")
  const promoName = getPayloadString(approval, "promo_name")
  const cashDeductionAmount = getCashDeductionAmount(approval)

  switch (approval.action_type) {
    case "edit_sale":
      return `Change sale from ${formatCurrency(previousTotal)} to ${formatCurrency(
        newTotal
      )}.`
    case "delete_sale":
      return saleId ? `Delete sale #${saleId.slice(0, 8)}.` : "Delete sale."
    case "apply_promo":
      return `Apply ${promoName ?? "promo"}. New total: ${formatCurrency(
        newTotal
      )}.`
    case "reopen_shift":
      return "Reopen this closed shift."
    case "cash_deduction":
      return `Deduct ${formatCurrency(cashDeductionAmount)} from expected cash.`
    default:
      return "Review this request."
  }
}

function getAmountLabel(approval: PendingShiftApproval) {
  if (approval.action_type === "reopen_shift") {
    return "—"
  }

  if (approval.action_type === "cash_deduction") {
    return `-${formatCurrency(getCashDeductionAmount(approval))}`
  }

  return formatSignedCurrency(getRevenueDelta(approval))
}

function getAmountValue(approval: PendingShiftApproval) {
  if (approval.action_type === "cash_deduction") {
    return -getCashDeductionAmount(approval)
  }

  if (approval.action_type === "reopen_shift") {
    return 0
  }

  return getRevenueDelta(approval)
}

function toApprovalRow(approval: PendingShiftApproval): ApprovalRow {
  return {
    id: approval.id,
    approval,
    boothId: approval.booth_schedules?.booth_id ?? null,
    boothName: getBoothLabel(approval),
    shiftLabel: formatShiftLabel(approval),
    shiftSort: getShiftSortValue(approval),
    requestType: getRequestTypeLabel(approval),
    requestedBy: approval.requested_by?.name ?? "Employee",
    requestedAt: approval.created_at,
    requestedAtLabel: formatShiftTimestamp(approval.created_at),
    details: getApprovalDetails(approval),
    reason: getPayloadString(approval, "reason"),
    amountLabel: getAmountLabel(approval),
    revenueDelta: getAmountValue(approval),
    status: approval.status,
  }
}

export function AdminApprovalsClient({ data }: AdminApprovalsClientProps) {
  const router = useRouter()
  const [approvals, setApprovals] = useState(data.approvals)
  const [pendingApprovalId, setPendingApprovalId] = useState<string | null>(
    null
  )
  const [boothFilter, setBoothFilter] = useState("all")
  const [shiftFilter, setShiftFilter] = useState("all")

  const rows = useMemo(() => approvals.map(toApprovalRow), [approvals])

  const boothOptions = useMemo(
    () => [
      { value: "all", label: "All booths" },
      ...Array.from(
        new Map(
          rows.map((row) => [row.boothId ?? row.boothName, row.boothName])
        )
      )
        .sort((left, right) => left[1].localeCompare(right[1]))
        .map(([value, label]) => ({ value, label })),
    ],
    [rows]
  )

  const shiftOptions = useMemo(() => {
    const visibleRows =
      boothFilter === "all"
        ? rows
        : rows.filter((row) => (row.boothId ?? row.boothName) === boothFilter)

    return [
      { value: "all", label: "All shifts" },
      ...Array.from(
        new Map(visibleRows.map((row) => [row.shiftSort, row.shiftLabel]))
      )
        .sort((left, right) => left[0].localeCompare(right[0]))
        .map(([value, label]) => ({ value, label })),
    ]
  }, [boothFilter, rows])

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (
          boothFilter !== "all" &&
          (row.boothId ?? row.boothName) !== boothFilter
        ) {
          return false
        }

        if (shiftFilter !== "all" && row.shiftSort !== shiftFilter) {
          return false
        }

        return true
      }),
    [boothFilter, rows, shiftFilter]
  )

  const revenueApprovals = approvals.filter(
    (approval) =>
      approval.action_type === "edit_sale" ||
      approval.action_type === "delete_sale" ||
      approval.action_type === "apply_promo"
  )

  const positiveRevenue = revenueApprovals.reduce((total, approval) => {
    const delta = getRevenueDelta(approval)
    return delta > 0 ? total + delta : total
  }, 0)

  const negativeRevenue = revenueApprovals.reduce((total, approval) => {
    const delta = getRevenueDelta(approval)
    return delta < 0 ? total + delta : total
  }, 0)

  const handleResolve = useCallback(
    async (approval: PendingShiftApproval, decision: "approve" | "reject") => {
      setPendingApprovalId(approval.id)

      const result =
        decision === "approve"
          ? await resolveShiftApproval(
              approval.id,
              approval.schedule_id,
              approval.booth_schedules?.booth_id
            )
          : await rejectShiftApproval(
              approval.id,
              approval.schedule_id,
              approval.booth_schedules?.booth_id
            )

      setPendingApprovalId(null)

      if (!result.ok) {
        toast.error(
          result.error ??
            (decision === "approve"
              ? "Unable to approve this request."
              : "Unable to reject this request.")
        )
        return
      }

      setApprovals((current) =>
        current.filter((currentApproval) => currentApproval.id !== approval.id)
      )

      toast.success(result.message)
      router.refresh()
    },
    [router]
  )

  const getApprovalSearchText = useCallback((row: ApprovalRow) => {
    return [
      row.boothName,
      row.shiftLabel,
      row.requestType,
      row.requestedBy,
      row.requestedAtLabel,
      row.details,
      row.reason,
      row.amountLabel,
      row.status,
    ].join(" ")
  }, [])

  const columns = useMemo<ColumnDef<ApprovalRow>[]>(
    () => [
      {
        accessorKey: "boothName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Booth / Shift" />
        ),
        cell: ({ row }) => (
          <div className="flex min-w-[13rem] flex-col gap-0.5">
            <span className="text-foreground font-semibold">
              {row.original.boothName}
            </span>
            <span className="text-muted-foreground text-xs">
              {row.original.shiftLabel}
            </span>
            {row.original.boothId ? (
              <Link
                href={`/admin/booths/${row.original.boothId}`}
                className="text-primary mt-1 text-xs font-medium hover:underline"
              >
                View booth
              </Link>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "shiftSort",
        header: "Shift Sort",
        cell: ({ row }) => row.original.shiftSort,
      },
      {
        accessorKey: "requestType",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Request" />
        ),
        cell: ({ row }) => (
          <div className="flex min-w-[8rem] flex-col gap-1">
            <span className="text-foreground font-medium">
              {row.original.requestType}
            </span>
            <Badge
              variant={
                row.original.status === "pending" ? "secondary" : "outline"
              }
              className="w-fit rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase"
            >
              {row.original.status === "pending"
                ? "Pending"
                : formatStatusLabel(row.original.status)}
            </Badge>
          </div>
        ),
      },
      {
        accessorKey: "details",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Details" />
        ),
        cell: ({ row }) => (
          <div className="flex max-w-[28rem] min-w-[16rem] flex-col gap-1">
            <p className="text-foreground text-sm">{row.original.details}</p>
            {row.original.reason ? (
              <p className="text-muted-foreground text-xs">
                Reason: {row.original.reason}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "requestedAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Requested" />
        ),
        cell: ({ row }) => (
          <div className="flex min-w-[11rem] flex-col gap-0.5">
            <span className="text-foreground font-medium">
              {row.original.requestedBy}
            </span>
            <span className="text-muted-foreground text-xs">
              {row.original.requestedAtLabel}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "revenueDelta",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Change" align="right" />
        ),
        cell: ({ row }) => (
          <div
            className={cn(
              "text-right font-semibold",
              row.original.revenueDelta < 0
                ? "text-destructive"
                : row.original.revenueDelta > 0
                  ? "text-emerald-600"
                  : "text-muted-foreground"
            )}
          >
            {row.original.amountLabel}
          </div>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const approval = row.original.approval
          const isResolving = pendingApprovalId === approval.id
          const canResolve = approval.status === "pending"

          if (!canResolve) {
            return null
          }

          return (
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                disabled={isResolving}
                onClick={() => void handleResolve(approval, "approve")}
              >
                <Check data-icon="inline-start" />
                Approve
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isResolving}
                onClick={() => void handleResolve(approval, "reject")}
              >
                <X data-icon="inline-start" />
                Reject
              </Button>
            </div>
          )
        },
      },
    ],
    [handleResolve, pendingApprovalId]
  )

  return (
    <div className="app-page flex flex-col gap-6">
      <header className="app-screen-header">
        <div className="app-screen-copy">
          <h1 className="app-screen-title">Approvals</h1>
          <p className="app-screen-description">
            Review pending shift, sale, cash, and promo requests in one table.
          </p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Pending</CardTitle>
            <CardDescription>All unresolved requests</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-primary text-3xl font-semibold">
              {approvals.length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending +</CardTitle>
            <CardDescription>Requested revenue increases</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-emerald-600">
              {formatCurrency(positiveRevenue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending -</CardTitle>
            <CardDescription>Requested revenue decreases</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-destructive text-3xl font-semibold">
              {formatCurrency(Math.abs(negativeRevenue))}
            </p>
          </CardContent>
        </Card>
      </section>

      {approvals.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
            <CheckCircle2 className="text-primary/35 h-10 w-10" />
            <div className="space-y-1">
              <p className="text-foreground text-lg font-semibold">
                No pending approvals
              </p>
              <p className="text-muted-foreground text-sm">
                New shift, sale, cash, and promo requests will appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Pending Approvals</CardTitle>
            <CardDescription>
              Sort by booth and shift, or use the filters to narrow the queue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={filteredRows}
              searchPlaceholder="Search booth, shift, request, employee, or reason"
              getSearchText={getApprovalSearchText}
              emptyMessage="No approvals match the current filters."
              initialSorting={[
                { id: "boothName", desc: false },
                { id: "shiftSort", desc: false },
                { id: "requestedAt", desc: true },
              ]}
              initialVisibility={{ shiftSort: false }}
              pageSize={10}
              toolbarContent={
                <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Select
                    value={
                      boothFilter === "all" ? APPROVAL_FILTER_ALL : boothFilter
                    }
                    onValueChange={(value) => {
                      setBoothFilter(
                        value === APPROVAL_FILTER_ALL ? "all" : (value ?? "all")
                      )
                      setShiftFilter("all")
                    }}
                  >
                    <SelectTrigger className="h-10 sm:w-[210px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {boothOptions.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={
                            option.value === "all"
                              ? APPROVAL_FILTER_ALL
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
                      shiftFilter === "all" ? APPROVAL_FILTER_ALL : shiftFilter
                    }
                    onValueChange={(value) =>
                      setShiftFilter(
                        value === APPROVAL_FILTER_ALL ? "all" : (value ?? "all")
                      )
                    }
                  >
                    <SelectTrigger className="h-10 sm:w-[230px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {shiftOptions.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={
                            option.value === "all"
                              ? APPROVAL_FILTER_ALL
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
          </CardContent>
        </Card>
      )}

      {approvals.length > 0 ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <RefreshCcw className="h-4 w-4" />
          Approved or rejected requests disappear from this queue immediately.
        </div>
      ) : null}
    </div>
  )
}
