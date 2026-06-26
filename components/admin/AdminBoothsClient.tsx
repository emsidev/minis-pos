"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Store,
  TableProperties,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import {
  cancelBoothSchedule,
  deactivateBooth,
  deleteBoothCascade,
  deleteBoothScheduleCascade,
  reactivateBooth,
  type BoothFormInput,
  type ScheduleFormInput,
} from "@/app/actions/adminBooths"
import { rejectShiftApproval, resolveShiftApproval } from "@/app/actions/shifts"
import {
  buildOptimisticBoothRecord,
  buildOptimisticScheduleCalendarItems,
} from "@/lib/adminOptimistic"
import {
  fetchAdminShiftDetail,
  getPendingReopenApproval,
  getPendingReopenApprovalCount,
  runBooleanPendingApproval,
  runIdPendingApproval,
} from "@/components/admin/adminShiftDetailHelpers"
import { AdminScheduleCalendar } from "@/components/admin/AdminScheduleCalendar"
import { BoothFormSheet } from "@/components/admin/BoothFormSheet"
import { ScheduleFormSheet } from "@/components/admin/ScheduleFormSheet"
import { ShiftReopenSheet } from "@/components/admin/ShiftReopenSheet"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { CashDeductionSheet } from "@/components/shifts/CashDeductionSheet"
import { ShiftCloseoutSheet } from "@/components/shifts/ShiftCloseoutSheet"
import { ShiftDetailSheet } from "@/components/shifts/ShiftDetailSheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  AdminEmployeeOption,
  AdminSchedule,
  AdminScheduleCalendarItem,
  AdminShiftDetailData,
} from "@/lib/adminBooths"
import type { Booth } from "@/lib/shifts"
import {
  getEmployeeDisplayName,
  hasBusinessShiftPassed,
  isCurrentBusinessShift,
  createClientId,
} from "@/lib/utils"
import { joinSchedule } from "@/app/actions/shifts"

type AdminBoothsClientProps = {
  booths: Booth[]
  schedules: AdminScheduleCalendarItem[]
  employees: AdminEmployeeOption[]
  currentEmployeeId: string
}

function sortBooths(rows: Booth[]) {
  return rows.slice().sort((left, right) => left.name.localeCompare(right.name))
}

function sortSchedules(rows: AdminScheduleCalendarItem[]) {
  return rows
    .slice()
    .sort((left, right) =>
      `${left.date} ${left.start_time}`.localeCompare(
        `${right.date} ${right.start_time}`
      )
    )
}

function cancelScheduledBoothRows(
  rows: AdminScheduleCalendarItem[],
  boothId: string
) {
  return rows.map((schedule) =>
    schedule.booth_id === boothId && schedule.status === "scheduled"
      ? { ...schedule, status: "cancelled" as const }
      : schedule
  )
}

export function AdminBoothsClient({
  booths,
  schedules,
  employees,
  currentEmployeeId,
}: AdminBoothsClientProps) {
  const router = useRouter()
  const [displayBooths, setDisplayBooths] = useState(booths)
  const [displaySchedules, setDisplaySchedules] = useState(schedules)
  const [formOpen, setFormOpen] = useState(false)
  const [scheduleFormOpen, setScheduleFormOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<AdminSchedule | null>(
    null
  )
  const [selectedDetail, setSelectedDetail] =
    useState<AdminShiftDetailData | null>(null)
  const [scheduleDetailOpen, setScheduleDetailOpen] = useState(false)
  const [closeoutOpen, setCloseoutOpen] = useState(false)
  const [cashDeductionOpen, setCashDeductionOpen] = useState(false)
  const [scheduleDetailLoading, setScheduleDetailLoading] = useState(false)
  const [scheduleDetailError, setScheduleDetailError] = useState<string | null>(
    null
  )
  const [joiningSchedule, setJoiningSchedule] = useState(false)
  const [cancellingSchedule, setCancellingSchedule] =
    useState<AdminSchedule | null>(null)
  const [reopeningSchedule, setReopeningSchedule] =
    useState<AdminSchedule | null>(null)
  const [resolvingApproval, setResolvingApproval] = useState(false)
  const [resolvingSaleApprovalId, setResolvingSaleApprovalId] = useState<
    string | null
  >(null)
  const [editingBooth, setEditingBooth] = useState<Booth | null>(null)
  const [deactivatingBooth, setDeactivatingBooth] = useState<Booth | null>(null)
  const [deletingBooth, setDeletingBooth] = useState<Booth | null>(null)
  const [deletingSchedule, setDeletingSchedule] =
    useState<AdminSchedule | null>(null)
  const [reactivatingBoothId, setReactivatingBoothId] = useState<string | null>(
    null
  )
  const optimisticBoothIdRef = useRef<string | null>(null)
  const optimisticScheduleIdsRef = useRef<string[]>([])

  useEffect(() => {
    setDisplayBooths(booths)
  }, [booths])

  useEffect(() => {
    setDisplaySchedules(schedules)
  }, [schedules])

  const openCreate = () => {
    setEditingBooth(null)
    setFormOpen(true)
  }

  const openScheduleCreate = () => {
    setEditingSchedule(null)
    setScheduleFormOpen(true)
  }

  const openEdit = (booth: Booth) => {
    setEditingBooth(booth)
    setFormOpen(true)
  }

  const handleOptimisticBoothSave = useCallback(
    (input: BoothFormInput) => {
      const previousBooths = displayBooths
      const optimisticId = input.id ?? `optimistic-booth-${createClientId()}`

      optimisticBoothIdRef.current = input.id ? null : optimisticId

      const optimisticBooth = buildOptimisticBoothRecord(
        input,
        optimisticId,
        editingBooth
      )

      setDisplayBooths((current) =>
        sortBooths([
          optimisticBooth,
          ...current.filter(
            (entry) =>
              entry.id !== optimisticBooth.id && entry.id !== editingBooth?.id
          ),
        ])
      )

      return () => {
        optimisticBoothIdRef.current = null
        setDisplayBooths(previousBooths)
      }
    },
    [displayBooths, editingBooth]
  )

  const handleOptimisticScheduleSave = useCallback(
    (input: ScheduleFormInput) => {
      const previousSchedules = displaySchedules
      const optimisticSchedules = buildOptimisticScheduleCalendarItems(
        input,
        displayBooths,
        employees
      )

      optimisticScheduleIdsRef.current =
        "id" in input && input.id
          ? []
          : optimisticSchedules.map((schedule) => schedule.id)

      setDisplaySchedules((current) => {
        if ("id" in input && input.id) {
          return sortSchedules(
            current.map((schedule) =>
              schedule.id === input.id ? optimisticSchedules[0] : schedule
            )
          )
        }

        return sortSchedules([
          ...optimisticSchedules,
          ...current.filter(
            (schedule) =>
              !optimisticScheduleIdsRef.current.includes(schedule.id)
          ),
        ])
      })

      return () => {
        optimisticScheduleIdsRef.current = []
        setDisplaySchedules(previousSchedules)
      }
    },
    [displayBooths, displaySchedules, employees]
  )

  const loadScheduleDetails = async (scheduleId: string) => {
    try {
      const detail = await fetchAdminShiftDetail(scheduleId)
      if (!detail.schedule) {
        setSelectedDetail(null)
        setScheduleDetailError("This shift is no longer available.")
        toast.error("This shift is no longer available.")
        return
      }

      setSelectedDetail(detail)
      setScheduleDetailError(null)
    } catch (error) {
      console.error("Unable to load shift details:", error)
      setSelectedDetail(null)
      setScheduleDetailError("Unable to load shift details.")
      toast.error("Unable to load shift details.")
    } finally {
      setScheduleDetailLoading(false)
    }
  }

  const openScheduleDetails = (scheduleId: string) => {
    setScheduleDetailOpen(true)
    setScheduleDetailLoading(true)
    setScheduleDetailError(null)
    setSelectedDetail(null)
    void loadScheduleDetails(scheduleId)
  }

  const handleCancelSchedule = async () => {
    if (!cancellingSchedule) {
      return
    }

    const previousSchedules = displaySchedules
    const previousDetail = selectedDetail
    const scheduleId = cancellingSchedule.id
    setDisplaySchedules((current) =>
      current.map((schedule) =>
        schedule.id === scheduleId
          ? { ...schedule, status: "cancelled" }
          : schedule
      )
    )
    setSelectedDetail((current) =>
      current?.schedule?.id === scheduleId
        ? {
            ...current,
            schedule: { ...current.schedule, status: "cancelled" },
          }
        : current
    )

    const result = await cancelBoothSchedule(
      cancellingSchedule.id,
      cancellingSchedule.booth_id
    )
    if (!result.ok) {
      setDisplaySchedules(previousSchedules)
      setSelectedDetail(previousDetail)
      toast.error(result.error ?? "Unable to cancel shift.")
      throw new Error(result.error ?? "Unable to cancel shift.")
    }
    toast.success(result.message)
    router.refresh()
  }

  const selectedSchedule = selectedDetail?.schedule ?? null
  const selectedCanClose =
    selectedSchedule?.status === "scheduled" &&
    (selectedDetail?.products.length ?? 0) > 0 &&
    (hasBusinessShiftPassed(selectedSchedule.date, selectedSchedule.end_time) ||
      isCurrentBusinessShift(
        selectedSchedule.date,
        selectedSchedule.start_time,
        selectedSchedule.end_time
      ) ||
      (selectedDetail?.products.length ?? 0) > 0)
  const adminAssignedToSelected =
    selectedSchedule?.booth_schedule_assignments.some(
      (assignment) => assignment.employee_id === currentEmployeeId
    ) ?? false
  const canJoinSelectedSchedule =
    selectedSchedule !== null &&
    selectedSchedule.status === "scheduled" &&
    !adminAssignedToSelected

  const refreshSelectedDetail = () => {
    if (!selectedSchedule) {
      return
    }

    setScheduleDetailLoading(true)
    void loadScheduleDetails(selectedSchedule.id)
  }

  const handleJoinSelectedSchedule = async () => {
    if (!selectedSchedule) {
      return
    }

    setJoiningSchedule(true)
    const result = await joinSchedule(selectedSchedule.id)
    setJoiningSchedule(false)

    if (!result.ok) {
      toast.error(result.error ?? "Unable to join this shift.")
      return
    }

    toast.success(result.message)
    router.refresh()
    setScheduleDetailLoading(true)
    void loadScheduleDetails(selectedSchedule.id)
  }

  const handleDeactivate = async () => {
    if (!deactivatingBooth) {
      return
    }

    const boothToDeactivate = deactivatingBooth
    const previousBooths = displayBooths
    const previousSchedules = displaySchedules
    setDisplayBooths((current) =>
      current.map((booth) =>
        booth.id === boothToDeactivate.id
          ? { ...booth, is_active: false }
          : booth
      )
    )
    setDisplaySchedules((current) =>
      cancelScheduledBoothRows(current, boothToDeactivate.id)
    )

    const result = await deactivateBooth(deactivatingBooth.id)
    if (!result.ok) {
      setDisplayBooths(previousBooths)
      setDisplaySchedules(previousSchedules)
      toast.error(result.error ?? "Unable to deactivate booth.")
      throw new Error(result.error ?? "Unable to deactivate booth.")
    }

    toast.success(result.message)
  }

  const handleReactivate = async (booth: Booth) => {
    setReactivatingBoothId(booth.id)
    const previousBooths = displayBooths
    setDisplayBooths((current) =>
      sortBooths(
        current.map((entry) =>
          entry.id === booth.id ? { ...entry, is_active: true } : entry
        )
      )
    )

    try {
      const result = await reactivateBooth(booth.id)
      if (!result.ok) {
        setDisplayBooths(previousBooths)
        toast.error(result.error ?? "Unable to reactivate booth.")
        throw new Error(result.error ?? "Unable to reactivate booth.")
      }

      setDisplayBooths((current) =>
        sortBooths(
          current.map((entry) =>
            entry.id === booth.id
              ? (result.booth ?? { ...entry, is_active: true })
              : entry
          )
        )
      )
      toast.success(result.message)
    } finally {
      setReactivatingBoothId(null)
    }
  }

  const handleDeleteSchedule = async () => {
    if (!deletingSchedule) {
      return
    }

    const scheduleId = deletingSchedule.id
    const previousSchedules = displaySchedules
    const previousDetail = selectedDetail
    setDisplaySchedules((current) =>
      current.filter((schedule) => schedule.id !== scheduleId)
    )
    setSelectedDetail((current) =>
      current?.schedule?.id === scheduleId ? null : current
    )

    const result = await deleteBoothScheduleCascade(
      deletingSchedule.id,
      deletingSchedule.booth_id
    )

    if (!result.ok) {
      setDisplaySchedules(previousSchedules)
      setSelectedDetail(previousDetail)
      toast.error(result.error ?? "Unable to delete shift.")
      throw new Error(result.error ?? "Unable to delete shift.")
    }

    setScheduleDetailOpen(false)
    setScheduleDetailError(null)
    toast.success(result.message)
    router.refresh()
  }

  const handleDeleteBooth = async () => {
    if (!deletingBooth) {
      return
    }

    const boothId = deletingBooth.id
    const previousBooths = displayBooths
    const previousSchedules = displaySchedules
    const previousDetail = selectedDetail
    setDisplayBooths((current) =>
      current.filter((booth) => booth.id !== boothId)
    )
    setDisplaySchedules((current) =>
      current.filter((schedule) => schedule.booth_id !== boothId)
    )
    setSelectedDetail((current) =>
      current?.schedule?.booth_id === boothId ? null : current
    )

    const result = await deleteBoothCascade(boothId)
    if (!result.ok) {
      setDisplayBooths(previousBooths)
      setDisplaySchedules(previousSchedules)
      setSelectedDetail(previousDetail)
      toast.error(result.error ?? "Unable to delete booth.")
      throw new Error(result.error ?? "Unable to delete booth.")
    }

    setScheduleDetailOpen(false)
    setScheduleDetailError(null)
    toast.success(result.message)
    router.refresh()
  }

  const handleCloseoutSaved = () => {
    if (!selectedSchedule) {
      return
    }

    const scheduleId = selectedSchedule.id

    setSelectedDetail((current) =>
      current?.schedule?.id === scheduleId
        ? {
            ...current,
            schedule: { ...current.schedule, status: "closed" },
          }
        : current
    )
    router.refresh()
  }

  const openReopenFromDetails = () => {
    if (!selectedSchedule || selectedSchedule.status !== "closed") {
      return
    }

    setScheduleDetailOpen(false)
    setReopeningSchedule(selectedSchedule)
  }

  const pendingReopenApproval = getPendingReopenApproval(selectedDetail)
  const pendingReopenApprovalCount =
    getPendingReopenApprovalCount(selectedDetail)

  const handleApproveReopenApproval = async () => {
    if (!pendingReopenApproval || !selectedSchedule) {
      return
    }

    await runBooleanPendingApproval({
      action: resolveShiftApproval,
      approvalId: pendingReopenApproval.id,
      boothId: selectedSchedule.booth_id,
      errorMessage: "Unable to approve this request.",
      onSuccess: () => {
        router.refresh()
        refreshSelectedDetail()
      },
      scheduleId: selectedSchedule.id,
      setPending: setResolvingApproval,
    })
  }

  const handleRejectReopenApproval = async () => {
    if (!pendingReopenApproval || !selectedSchedule) {
      return
    }

    await runBooleanPendingApproval({
      action: rejectShiftApproval,
      approvalId: pendingReopenApproval.id,
      boothId: selectedSchedule.booth_id,
      errorMessage: "Unable to reject this request.",
      onSuccess: refreshSelectedDetail,
      scheduleId: selectedSchedule.id,
      setPending: setResolvingApproval,
    })
  }

  const handleApproveSaleApproval = async (approvalId: string) => {
    if (!selectedSchedule) {
      return
    }

    await runIdPendingApproval({
      action: resolveShiftApproval,
      approvalId,
      boothId: selectedSchedule.booth_id,
      errorMessage: "Unable to approve this request.",
      onSuccess: () => {
        router.refresh()
        refreshSelectedDetail()
      },
      scheduleId: selectedSchedule.id,
      setPendingId: setResolvingSaleApprovalId,
    })
  }

  const handleRejectSaleApproval = async (approvalId: string) => {
    if (!selectedSchedule) {
      return
    }

    await runIdPendingApproval({
      action: rejectShiftApproval,
      approvalId,
      boothId: selectedSchedule.booth_id,
      errorMessage: "Unable to reject this request.",
      onSuccess: refreshSelectedDetail,
      scheduleId: selectedSchedule.id,
      setPendingId: setResolvingSaleApprovalId,
    })
  }

  return (
    <div className="app-page flex flex-col gap-6">
      <header className="app-screen-header">
        <div className="app-screen-copy">
          <h1 className="app-screen-title">Booth Management</h1>
          <p className="app-screen-description">Manage booths and shifts.</p>
        </div>
        <div className="app-screen-actions">
          <Button
            render={<Link href="/admin/booths/bulk" />}
            nativeButton={false}
            size="lg"
            variant="outline"
          >
            <TableProperties data-icon="inline-start" />
            Bulk Schedule
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={openScheduleCreate}
            disabled={!displayBooths.some((booth) => booth.is_active)}
          >
            <Plus data-icon="inline-start" />
            Add Shift
          </Button>
          <Button type="button" size="lg" onClick={openCreate}>
            <Plus data-icon="inline-start" />
            Add Booth
          </Button>
        </div>
      </header>

      <Tabs defaultValue="booths">
        <TabsList>
          <TabsTrigger value="booths">Booths</TabsTrigger>
          <TabsTrigger value="calendar">All-Booths Calendar</TabsTrigger>
        </TabsList>
        <TabsContent value="booths">
          {displayBooths.length === 0 ? (
            <div className="app-panel text-muted-foreground p-8 text-center text-sm">
              No booths have been added yet.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {displayBooths.map((booth) => {
                const scheduleCount = displaySchedules.filter(
                  (schedule) =>
                    schedule.booth_id === booth.id &&
                    schedule.status === "scheduled"
                ).length

                return (
                  <Card key={booth.id}>
                    <CardHeader>
                      <CardTitle>{booth.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1.5">
                        <MapPin className="text-primary size-4" />
                        {booth.location_text ?? "No location details"}
                      </CardDescription>
                      <CardAction>
                        <Badge
                          variant={booth.is_active ? "default" : "outline"}
                        >
                          {booth.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </CardAction>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      <div className="bg-muted text-muted-foreground rounded-xl px-4 py-3 text-sm">
                        <span className="text-foreground font-medium">
                          {scheduleCount}
                        </span>{" "}
                        scheduled shift{scheduleCount === 1 ? "" : "s"} this
                        month
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          render={<Link href={`/admin/booths/${booth.id}`} />}
                          nativeButton={false}
                          variant="secondary"
                        >
                          <Store data-icon="inline-start" />
                          View Booth
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => openEdit(booth)}
                        >
                          <Pencil data-icon="inline-start" />
                          Edit
                        </Button>
                        {booth.is_active ? (
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => setDeactivatingBooth(booth)}
                          >
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={reactivatingBoothId === booth.id}
                            onClick={() => handleReactivate(booth)}
                          >
                            {reactivatingBoothId === booth.id ? (
                              <Loader2
                                data-icon="inline-start"
                                className="animate-spin"
                              />
                            ) : (
                              <RotateCcw data-icon="inline-start" />
                            )}
                            Reactivate
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => setDeletingBooth(booth)}
                        >
                          <Trash2 data-icon="inline-start" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <CardTitle>Unified Schedule</CardTitle>
              <CardDescription>
                All booth shifts in one calendar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminScheduleCalendar
                schedules={displaySchedules}
                loadMonths
                onSelectSchedule={openScheduleDetails}
                enableTextExport
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <BoothFormSheet
        booth={editingBooth}
        open={formOpen}
        onOpenChange={setFormOpen}
        onOptimisticSave={handleOptimisticBoothSave}
        onSaved={(booth) => {
          const optimisticId = optimisticBoothIdRef.current
          optimisticBoothIdRef.current = null
          setDisplayBooths((current) =>
            sortBooths([
              booth,
              ...current.filter(
                (entry) => entry.id !== booth.id && entry.id !== optimisticId
              ),
            ])
          )
        }}
      />
      <ScheduleFormSheet
        open={scheduleFormOpen}
        onOpenChange={setScheduleFormOpen}
        schedule={editingSchedule}
        initialBoothId={editingSchedule?.booth_id ?? ""}
        booths={displayBooths.filter((booth) => booth.is_active)}
        employees={employees}
        onOptimisticSave={handleOptimisticScheduleSave}
        onSaved={() => {
          optimisticScheduleIdsRef.current = []
          setEditingSchedule(null)
          router.refresh()
        }}
      />
      <ShiftDetailSheet
        open={scheduleDetailOpen}
        onOpenChange={setScheduleDetailOpen}
        detailData={selectedDetail}
        loading={scheduleDetailLoading}
        loadError={scheduleDetailError}
        assignedEmployeeNames={
          selectedSchedule?.booth_schedule_assignments
            .map((assignment) => getEmployeeDisplayName(assignment.employees))
            .filter(Boolean) ?? []
        }
        operatorName={
          selectedSchedule?.operator
            ? getEmployeeDisplayName(selectedSchedule.operator)
            : null
        }
        canEditReceipts={selectedSchedule?.status === "scheduled"}
        canJoin={canJoinSelectedSchedule}
        joinPending={joiningSchedule}
        onJoin={
          canJoinSelectedSchedule ? handleJoinSelectedSchedule : undefined
        }
        showAdminAudit
        inventoryEvents={selectedSchedule?.inventory_events ?? []}
        operatorPeriods={
          selectedSchedule?.booth_schedule_operator_periods ?? []
        }
        closeouts={selectedSchedule?.shift_closeouts ?? []}
        approvalHistory={selectedDetail?.approvalHistory ?? []}
        approvalProducts={selectedDetail?.products ?? []}
        pendingRevenueIncrease={selectedDetail?.pendingRevenueIncrease ?? 0}
        pendingRevenueDecrease={selectedDetail?.pendingRevenueDecrease ?? 0}
        saleActionMode="direct"
        onSalesChanged={refreshSelectedDetail}
        onAddCashDeduction={
          selectedSchedule?.status === "scheduled"
            ? () => {
                setScheduleDetailOpen(false)
                setCashDeductionOpen(true)
              }
            : undefined
        }
        allowOfflineSaleCache={false}
        canCloseShift={selectedCanClose}
        onCloseShift={
          selectedCanClose
            ? () => {
                setScheduleDetailOpen(false)
                setCloseoutOpen(true)
              }
            : undefined
        }
        onEdit={
          selectedSchedule
            ? () => {
                setScheduleDetailOpen(false)
                setEditingSchedule(selectedSchedule)
                setScheduleFormOpen(true)
              }
            : undefined
        }
        onCancel={
          selectedSchedule &&
          !hasBusinessShiftPassed(
            selectedSchedule.date,
            selectedSchedule.end_time
          )
            ? () => {
                setScheduleDetailOpen(false)
                setCancellingSchedule(selectedSchedule)
              }
            : undefined
        }
        onDelete={
          selectedSchedule
            ? () => {
                setScheduleDetailOpen(false)
                setDeletingSchedule(selectedSchedule)
              }
            : undefined
        }
        onOverride={undefined}
        onReopen={
          selectedSchedule?.status === "closed"
            ? openReopenFromDetails
            : undefined
        }
        pendingReopenApprovalCount={pendingReopenApprovalCount}
        onApproveReopenApproval={
          pendingReopenApproval ? handleApproveReopenApproval : undefined
        }
        onRejectReopenApproval={
          pendingReopenApproval ? handleRejectReopenApproval : undefined
        }
        resolveReopenApprovalPending={resolvingApproval}
        onApproveSaleApproval={handleApproveSaleApproval}
        onRejectSaleApproval={handleRejectSaleApproval}
        resolvingSaleApprovalId={resolvingSaleApprovalId}
      />
      {selectedSchedule ? (
        <ShiftCloseoutSheet
          open={closeoutOpen}
          onOpenChange={setCloseoutOpen}
          schedule={selectedSchedule}
          products={selectedDetail?.products ?? []}
          sales={selectedDetail?.sales ?? []}
          approvalHistory={selectedDetail?.approvalHistory ?? []}
          onSaved={handleCloseoutSaved}
        />
      ) : null}
      {selectedSchedule ? (
        <CashDeductionSheet
          open={cashDeductionOpen}
          onOpenChange={(open) => {
            setCashDeductionOpen(open)
            if (!open) {
              setScheduleDetailOpen(true)
            }
          }}
          schedule={selectedSchedule}
          onSaved={() => {
            setScheduleDetailOpen(true)
            refreshSelectedDetail()
          }}
        />
      ) : null}
      {reopeningSchedule ? (
        <ShiftReopenSheet
          open={Boolean(reopeningSchedule)}
          onOpenChange={(open) => {
            if (!open) {
              setReopeningSchedule(null)
            }
          }}
          boothId={reopeningSchedule.booth_id}
          boothName={reopeningSchedule.booths.name}
          scheduleId={reopeningSchedule.id}
          shiftLabel={`${reopeningSchedule.date} / ${reopeningSchedule.start_time.slice(0, 5)} - ${reopeningSchedule.end_time.slice(0, 5)}`}
          onSaved={() => {
            setReopeningSchedule(null)
            router.refresh()
          }}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(deactivatingBooth)}
        onOpenChange={(open) => {
          if (!open) {
            setDeactivatingBooth(null)
          }
        }}
        title="Deactivate booth?"
        description="Upcoming shifts will be cancelled automatically. A booth with a shift in progress cannot be deactivated."
        confirmLabel="Deactivate Booth"
        pendingLabel="Deactivating..."
        cancelLabel="Keep Active"
        variant="destructive"
        onConfirm={handleDeactivate}
      />
      <ConfirmDialog
        open={Boolean(deletingBooth)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingBooth(null)
          }
        }}
        title="Delete this booth?"
        description="This permanently removes the booth, all of its shifts, all related sales, and receipt history."
        confirmLabel="Delete Booth"
        pendingLabel="Deleting..."
        cancelLabel="Keep Booth"
        variant="destructive"
        onConfirm={handleDeleteBooth}
      />
      <ConfirmDialog
        open={Boolean(cancellingSchedule)}
        onOpenChange={(open) => {
          if (!open) {
            setCancellingSchedule(null)
          }
        }}
        title="Cancel shift?"
        description="This keeps the shift in history but removes it from active scheduling."
        confirmLabel="Cancel Shift"
        pendingLabel="Cancelling..."
        cancelLabel="Keep Shift"
        variant="destructive"
        onConfirm={handleCancelSchedule}
      />
      <ConfirmDialog
        open={Boolean(deletingSchedule)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingSchedule(null)
          }
        }}
        title="Delete this shift?"
        description="This permanently removes the shift, its inventory records, approvals, sales, and receipt history."
        confirmLabel="Delete Shift"
        pendingLabel="Deleting..."
        cancelLabel="Keep Shift"
        variant="destructive"
        onConfirm={handleDeleteSchedule}
      />
    </div>
  )
}
