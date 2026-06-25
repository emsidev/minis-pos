"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, RefreshCcw, Undo2 } from "lucide-react"
import { toast } from "sonner"

import { rejectShiftApproval, resolveShiftApproval } from "@/app/actions/shifts"
import { ShiftApprovalCard } from "@/components/shifts/ShiftApprovalCard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type {
  PendingShiftApproval,
  PendingShiftApprovalData,
} from "@/lib/shiftApprovals"
import { formatCurrency } from "@/lib/utils"

type AdminApprovalsClientProps = {
  data: PendingShiftApprovalData
}

function formatShiftLabel(approval: PendingShiftApproval) {
  const schedule = approval.booth_schedules
  if (!schedule) {
    return "Shift unavailable"
  }

  return `${schedule.date} / ${schedule.start_time.slice(0, 5)} - ${schedule.end_time.slice(0, 5)}`
}

function getBoothLabel(approval: PendingShiftApproval) {
  return approval.booth_schedules?.booths?.name ?? "Unknown booth"
}

function getRevenueDelta(approval: PendingShiftApproval) {
  if (
    typeof approval.payload !== "object" ||
    approval.payload === null ||
    Array.isArray(approval.payload)
  ) {
    return 0
  }

  const rawValue = approval.payload.revenue_delta ?? 0
  const delta =
    typeof rawValue === "number"
      ? rawValue
      : Number.parseFloat(String(rawValue ?? 0))

  return Number.isFinite(delta) ? delta : 0
}

export function AdminApprovalsClient({ data }: AdminApprovalsClientProps) {
  const router = useRouter()
  const [approvals, setApprovals] = useState(data.approvals)
  const [pendingApprovalId, setPendingApprovalId] = useState<string | null>(
    null
  )

  const saleApprovals = approvals.filter(
    (approval) =>
      approval.action_type === "edit_sale" ||
      approval.action_type === "delete_sale"
  )
  const promoApprovals = approvals.filter(
    (approval) => approval.action_type === "apply_promo"
  )
  const reopenApprovals = approvals.filter(
    (approval) => approval.action_type === "reopen_shift"
  )
  const revenueApprovals = [...saleApprovals, ...promoApprovals]
  const positiveRevenue = revenueApprovals.reduce((total, approval) => {
    const delta = getRevenueDelta(approval)
    return delta > 0 ? total + delta : total
  }, 0)
  const negativeRevenue = revenueApprovals.reduce((total, approval) => {
    const delta = getRevenueDelta(approval)
    return delta < 0 ? total + delta : total
  }, 0)

  const handleResolve = async (
    approval: PendingShiftApproval,
    decision: "approve" | "reject"
  ) => {
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
  }

  return (
    <div className="app-page flex flex-col gap-6">
      <header className="app-screen-header">
        <div className="app-screen-copy">
          <h1 className="app-screen-title">Approvals</h1>
          <p className="app-screen-description">
            Review pending shift reopen requests and sale changes in one place.
          </p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle>Pending Requests</CardTitle>
            <CardDescription>All unresolved approvals</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-primary text-3xl font-semibold">
              {approvals.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sale Changes</CardTitle>
            <CardDescription>Edit and delete sale requests</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-foreground text-3xl font-semibold">
              {saleApprovals.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Promo Requests</CardTitle>
            <CardDescription>Cart promos waiting for approval</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-foreground text-3xl font-semibold">
              {promoApprovals.length}
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
                New reopen, sale, and promo requests will appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {reopenApprovals.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Shift Reopen Requests</CardTitle>
            <CardDescription>
              Closed shifts waiting to be reopened for corrections.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {reopenApprovals.map((approval) => (
              <div
                key={approval.id}
                className="border-border/60 rounded-[var(--radius)] border p-4"
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-foreground font-semibold">
                      {getBoothLabel(approval)}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {formatShiftLabel(approval)}
                    </p>
                  </div>
                  {approval.booth_schedules?.booth_id ? (
                    <Button
                      render={
                        <Link
                          href={`/admin/booths/${approval.booth_schedules.booth_id}`}
                        />
                      }
                      nativeButton={false}
                      variant="outline"
                      size="sm"
                    >
                      View Booth
                    </Button>
                  ) : null}
                </div>

                <ShiftApprovalCard
                  approval={approval}
                  resolving={pendingApprovalId === approval.id}
                  onApprove={(_approvalId: string) => {
                    void _approvalId
                    void handleResolve(approval, "approve")
                  }}
                  onReject={(_approvalId: string) => {
                    void _approvalId
                    void handleResolve(approval, "reject")
                  }}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {saleApprovals.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Sale Change Requests</CardTitle>
            <CardDescription>
              Review the requested result before approving the change.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {saleApprovals.map((approval) => (
              <div
                key={approval.id}
                className="border-border/60 rounded-[var(--radius)] border p-4"
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-foreground font-semibold">
                      {getBoothLabel(approval)}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {formatShiftLabel(approval)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {approval.action_type === "delete_sale"
                        ? "Delete sale"
                        : "Edit sale"}
                    </Badge>
                    {approval.booth_schedules?.booth_id ? (
                      <Button
                        render={
                          <Link
                            href={`/admin/booths/${approval.booth_schedules.booth_id}`}
                          />
                        }
                        nativeButton={false}
                        variant="outline"
                        size="sm"
                      >
                        <Undo2 data-icon="inline-start" />
                        View Booth
                      </Button>
                    ) : null}
                  </div>
                </div>

                <ShiftApprovalCard
                  approval={approval}
                  products={data.products}
                  resolving={pendingApprovalId === approval.id}
                  onApprove={(_approvalId: string) => {
                    void _approvalId
                    void handleResolve(approval, "approve")
                  }}
                  onReject={(_approvalId: string) => {
                    void _approvalId
                    void handleResolve(approval, "reject")
                  }}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {promoApprovals.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Promo Requests</CardTitle>
            <CardDescription>
              Review cart promos before employees can charge them.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {promoApprovals.map((approval) => (
              <div
                key={approval.id}
                className="border-border/60 rounded-[var(--radius)] border p-4"
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-foreground font-semibold">
                      {getBoothLabel(approval)}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {formatShiftLabel(approval)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">Promo request</Badge>
                    {approval.booth_schedules?.booth_id ? (
                      <Button
                        render={
                          <Link
                            href={`/admin/booths/${approval.booth_schedules.booth_id}`}
                          />
                        }
                        nativeButton={false}
                        variant="outline"
                        size="sm"
                      >
                        <Undo2 data-icon="inline-start" />
                        View Booth
                      </Button>
                    ) : null}
                  </div>
                </div>

                <ShiftApprovalCard
                  approval={approval}
                  products={data.products}
                  resolving={pendingApprovalId === approval.id}
                  onApprove={(_approvalId: string) => {
                    void _approvalId
                    void handleResolve(approval, "approve")
                  }}
                  onReject={(_approvalId: string) => {
                    void _approvalId
                    void handleResolve(approval, "reject")
                  }}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {approvals.length > 0 ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <RefreshCcw className="h-4 w-4" />
          Approved or rejected requests disappear from this queue immediately.
        </div>
      ) : null}
    </div>
  )
}
