"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  UserRound,
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
  buildOptimisticAdminSchedules,
  buildOptimisticBoothRecord,
} from "@/lib/adminOptimistic"
import {
  fetchAdminShiftDetail,
  getPendingReopenApproval,
  getPendingReopenApprovalCount,
  runBooleanPendingApproval,
  runIdPendingApproval,
} from "@/components/admin/adminShiftDetailHelpers"
import { BoothMapPreview } from "@/components/admin/BoothMapPreview"
import { AdminScheduleCalendar } from "@/components/admin/AdminScheduleCalendar"
import { BoothFormSheet } from "@/components/admin/BoothFormSheet"
import { InventoryOverrideSheet } from "@/components/admin/InventoryOverrideSheet"
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
import { buildBoothMapLink, getBoothCoordinates } from "@/lib/boothMaps"
import { buildBoothAssignmentExportText } from "@/lib/scheduleExports"
import type {
  AdminEmployeeOption,
  AdminSchedule,
  AdminShiftDetailData,
} from "@/lib/adminBooths"
import type { Booth, Product } from "@/lib/shifts"
import {
  getEmployeeDisplayName,
  hasBusinessShiftPassed,
  hasBusinessShiftStarted,
  isCurrentBusinessShift,
} from "@/lib/utils"
import { joinSchedule } from "@/app/actions/shifts"

type AdminBoothDetailClientProps = {
  booth: Booth
  booths: Booth[]
  employees: AdminEmployeeOption[]
  products: Product[]
  schedules: AdminSchedule[]
  currentEmployeeId: string
}

function formatCoordinateLabel(value: number) {
  return value.toFixed(6)
}

function monthStartFromScheduleDate(value?: string) {
  if (!value) {
    return new Date()
  }

  const [year, month] = value.split("-").map(Number)
  return new Date(year, Math.max(month - 1, 0), 1)
}

function sortBooths(rows: Booth[]) {
  return rows.slice().sort((left, right) => left.name.localeCompare(right.name))
}

function sortSchedules(rows: AdminSchedule[]) {
  return rows
    .slice()
    .sort((left, right) =>
      `${left.date} ${left.start_time}`.localeCompare(
        `${right.date} ${right.start_time}`
      )
    )
}

function cancelScheduledBoothRows(rows: AdminSchedule[], boothId: string) {
  return rows.map((schedule) =>
    schedule.booth_id === boothId && schedule.status === "scheduled"
      ? { ...schedule, status: "cancelled" as const }
      : schedule
  )
}

export function AdminBoothDetailClient({
  booth,
  booths,
  employees,
  products,
  schedules,
  currentEmployeeId,
}: AdminBoothDetailClientProps) {
  const router = useRouter()
  const [displayBooth, setDisplayBooth] = useState(booth)
  const [displayBooths, setDisplayBooths] = useState(booths)
  const [displaySchedules, setDisplaySchedules] = useState(schedules)
  const [boothFormOpen, setBoothFormOpen] = useState(false)
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
  const [deletingSchedule, setDeletingSchedule] =
    useState<AdminSchedule | null>(null)
  const [overridingSchedule, setOverridingSchedule] =
    useState<AdminSchedule | null>(null)
  const [reopeningSchedule, setReopeningSchedule] =
    useState<AdminSchedule | null>(null)
  const [resolvingSaleApprovalId, setResolvingSaleApprovalId] = useState<
    string | null
  >(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [confirmDeleteBooth, setConfirmDeleteBooth] = useState(false)
  const [reactivatingBooth, setReactivatingBooth] = useState(false)
  const optimisticBoothIdRef = useRef<string | null>(null)
  const optimisticScheduleIdsRef = useRef<string[]>([])
  const mapLink = buildBoothMapLink(displayBooth)
  const coordinates = getBoothCoordinates(displayBooth)

  useEffect(() => {
    setDisplayBooth(booth)
  }, [booth])

  useEffect(() => {
    setDisplayBooths(booths)
  }, [booths])

  useEffect(() => {
    setDisplaySchedules(schedules)
  }, [schedules])

  const handleOptimisticBoothSave = useCallback(
    (input: BoothFormInput) => {
      const previousBooth = displayBooth
      const previousBooths = displayBooths
      const optimisticId = input.id ?? `optimistic-booth-${crypto.randomUUID()}`

      optimisticBoothIdRef.current = input.id ? null : optimisticId

      const optimisticBooth = buildOptimisticBoothRecord(
        input,
        optimisticId,
        displayBooth
      )

      setDisplayBooth(optimisticBooth)
      setDisplayBooths((current) =>
        sortBooths(
          current.map((entry) =>
            entry.id === displayBooth.id ? optimisticBooth : entry
          )
        )
      )

      return () => {
        optimisticBoothIdRef.current = null
        setDisplayBooth(previousBooth)
        setDisplayBooths(previousBooths)
      }
    },
    [displayBooth, displayBooths]
  )

  const handleOptimisticScheduleSave = useCallback(
    (input: ScheduleFormInput) => {
      const previousSchedules = displaySchedules
      const previousDetail = selectedDetail
      const optimisticSchedules = buildOptimisticAdminSchedules(
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
      setSelectedDetail((current) => {
        if (!current?.schedule || !("id" in input) || !input.id) {
          return current
        }

        return current.schedule.id === input.id
          ? {
              ...current,
              schedule: optimisticSchedules[0],
            }
          : current
      })

      return () => {
        optimisticScheduleIdsRef.current = []
        setDisplaySchedules(previousSchedules)
        setSelectedDetail(previousDetail)
      }
    },
    [displayBooths, displaySchedules, employees, selectedDetail]
  )

  const openScheduleCreate = () => {
    setEditingSchedule(null)
    setScheduleFormOpen(true)
  }

  const openScheduleEdit = (schedule: AdminSchedule) => {
    setEditingSchedule(schedule)
    setScheduleFormOpen(true)
  }

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

  const selectedSchedule = selectedDetail?.schedule ?? null
  const [resolvingApproval, setResolvingApproval] = useState(false)
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
  const selectedScheduleIsActive =
    selectedSchedule?.status === "scheduled" &&
    isCurrentBusinessShift(
      selectedSchedule.date,
      selectedSchedule.start_time,
      selectedSchedule.end_time
    )
  const canOverrideSelectedSchedule =
    Boolean(selectedScheduleIsActive) &&
    (selectedSchedule?.booth_schedule_products.length ?? 0) > 0
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

  const openScheduleEditFromDetails = () => {
    if (!selectedSchedule) {
      return
    }

    setScheduleDetailOpen(false)
    openScheduleEdit(selectedSchedule)
  }

  const openCancelFromDetails = () => {
    if (
      !selectedSchedule ||
      hasBusinessShiftPassed(selectedSchedule.date, selectedSchedule.end_time)
    ) {
      return
    }

    setScheduleDetailOpen(false)
    setCancellingSchedule(selectedSchedule)
  }

  const openDeleteFromDetails = () => {
    if (!selectedSchedule) {
      return
    }

    setScheduleDetailOpen(false)
    setDeletingSchedule(selectedSchedule)
  }

  const openOverrideFromDetails = () => {
    if (!selectedSchedule || !canOverrideSelectedSchedule) {
      return
    }

    setScheduleDetailOpen(false)
    setOverridingSchedule(selectedSchedule)
  }

  const openReopenFromDetails = () => {
    if (!selectedSchedule) {
      return
    }

    setScheduleDetailOpen(false)
    setReopeningSchedule(selectedSchedule)
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

  const handleCloseoutSaved = () => {
    if (!selectedSchedule) {
      return
    }

    const scheduleId = selectedSchedule.id

    setDisplaySchedules((current) =>
      current.map((schedule) =>
        schedule.id === scheduleId
          ? { ...schedule, status: "closed" }
          : schedule
      )
    )
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

  const handleDeactivate = async () => {
    const previousBooth = displayBooth
    const previousBooths = displayBooths
    const previousSchedules = displaySchedules
    setDisplayBooth((current) => ({ ...current, is_active: false }))
    setDisplayBooths((current) =>
      current.map((entry) =>
        entry.id === displayBooth.id ? { ...entry, is_active: false } : entry
      )
    )
    setDisplaySchedules((current) =>
      cancelScheduledBoothRows(current, displayBooth.id)
    )

    const result = await deactivateBooth(displayBooth.id)
    if (!result.ok) {
      setDisplayBooth(previousBooth)
      setDisplayBooths(previousBooths)
      setDisplaySchedules(previousSchedules)
      toast.error(result.error ?? "Unable to deactivate booth.")
      throw new Error(result.error ?? "Unable to deactivate booth.")
    }
    toast.success(result.message)
    router.refresh()
  }

  const handleDeleteBooth = async () => {
    const previousBooth = displayBooth
    const previousBooths = displayBooths
    const previousSchedules = displaySchedules
    const previousDetail = selectedDetail
    setDisplayBooths((current) =>
      current.filter((entry) => entry.id !== displayBooth.id)
    )
    setDisplaySchedules((current) =>
      current.filter((schedule) => schedule.booth_id !== displayBooth.id)
    )
    setSelectedDetail((current) =>
      current?.schedule?.booth_id === displayBooth.id ? null : current
    )

    const result = await deleteBoothCascade(displayBooth.id)
    if (!result.ok) {
      setDisplayBooth(previousBooth)
      setDisplayBooths(previousBooths)
      setDisplaySchedules(previousSchedules)
      setSelectedDetail(previousDetail)
      toast.error(result.error ?? "Unable to delete booth.")
      throw new Error(result.error ?? "Unable to delete booth.")
    }

    toast.success(result.message)
    router.push("/admin/booths")
    router.refresh()
  }

  const handleReactivate = async () => {
    setReactivatingBooth(true)
    const previousBooth = displayBooth
    const previousBooths = displayBooths
    setDisplayBooth((current) => ({ ...current, is_active: true }))
    setDisplayBooths((current) =>
      sortBooths(
        current.map((entry) =>
          entry.id === displayBooth.id ? { ...entry, is_active: true } : entry
        )
      )
    )

    try {
      const result = await reactivateBooth(displayBooth.id)
      if (!result.ok) {
        setDisplayBooth(previousBooth)
        setDisplayBooths(previousBooths)
        toast.error(result.error ?? "Unable to reactivate booth.")
        throw new Error(result.error ?? "Unable to reactivate booth.")
      }

      const nextBooth = result.booth ?? { ...displayBooth, is_active: true }
      setDisplayBooth(nextBooth)
      setDisplayBooths((current) =>
        current.map((entry) => (entry.id === nextBooth.id ? nextBooth : entry))
      )
      toast.success(result.message)
    } finally {
      setReactivatingBooth(false)
    }
  }

  const handleCopyMapLink = async () => {
    if (!mapLink) {
      toast.error("No map link is available for this booth.")
      return
    }

    try {
      await navigator.clipboard.writeText(mapLink)
      toast.success("Map link copied.")
    } catch {
      toast.error("Unable to copy the map link.")
    }
  }

  const handleCopyAssignments = async () => {
    const text = buildBoothAssignmentExportText(
      displayBooth.name,
      displaySchedules.map((schedule) => ({
        date: schedule.date,
        startTime: schedule.start_time,
        endTime: schedule.end_time,
        status: schedule.status,
        assignedEmployeeNames: schedule.booth_schedule_assignments
          .map((assignment) => assignment.employees?.name ?? "")
          .filter(Boolean),
      })),
      monthStartFromScheduleDate(displaySchedules[0]?.date)
    )

    try {
      await navigator.clipboard.writeText(text)
      toast.success("Assignment text copied.")
    } catch {
      toast.error("Unable to copy the assignment text.")
    }
  }

  return (
    <div className="app-page flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <Button
          render={<Link href="/admin/booths" />}
          nativeButton={false}
          variant="ghost"
          className="w-fit"
        >
          <ArrowLeft data-icon="inline-start" />
          Back to booths
        </Button>
        <div className="app-panel app-screen-header p-5 sm:p-6">
          <div className="app-screen-copy">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={displayBooth.is_active ? "default" : "outline"}>
                {displayBooth.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <h1 className="app-screen-title">{displayBooth.name}</h1>
            <p className="app-screen-description flex items-center gap-2">
              <MapPin className="text-primary size-4" />
              {displayBooth.location_text ?? "No location details"}
            </p>
            {mapLink ? (
              <a
                href={mapLink}
                target="_blank"
                rel="noreferrer"
                className="text-primary inline-flex w-fit items-center gap-2 text-sm font-medium hover:underline"
              >
                Open map
                <ExternalLink className="size-4" />
              </a>
            ) : null}
          </div>
          <div className="app-screen-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setBoothFormOpen(true)}
            >
              <Pencil data-icon="inline-start" />
              Edit Booth
            </Button>
            {displayBooth.is_active ? (
              <>
                <Button type="button" onClick={openScheduleCreate}>
                  <Plus data-icon="inline-start" />
                  Add Shift
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setConfirmDeactivate(true)}
                >
                  Deactivate
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setConfirmDeleteBooth(true)}
                >
                  <Trash2 data-icon="inline-start" />
                  Delete Booth
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={reactivatingBooth}
                  onClick={handleReactivate}
                >
                  {reactivatingBooth ? (
                    <Loader2
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                  ) : (
                    <RotateCcw data-icon="inline-start" />
                  )}
                  Reactivate Booth
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setConfirmDeleteBooth(true)}
                >
                  <Trash2 data-icon="inline-start" />
                  Delete Booth
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
        </TabsList>
        <TabsContent value="schedule" className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Booth Schedule</CardTitle>
              <CardDescription>
                Scheduled and past shifts for this booth.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminScheduleCalendar
                schedules={displaySchedules}
                boothDetailMode
                onSelectSchedule={openScheduleDetails}
              />
            </CardContent>
          </Card>

          <section className="flex flex-col gap-4">
            <div className="app-screen-header sm:items-center">
              <div className="app-screen-copy">
                <h2 className="app-section-title">Shifts</h2>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyAssignments}
              >
                <Copy data-icon="inline-start" />
                Copy Text
              </Button>
            </div>
            {displaySchedules.length === 0 ? (
              <div className="app-panel text-muted-foreground p-8 text-center text-sm">
                This booth has no assignments yet.
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {displaySchedules.map((schedule) => {
                  const started = hasBusinessShiftStarted(
                    schedule.date,
                    schedule.start_time
                  )
                  const active =
                    schedule.status === "scheduled" &&
                    isCurrentBusinessShift(
                      schedule.date,
                      schedule.start_time,
                      schedule.end_time
                    )
                  const isClosed = schedule.status === "closed"
                  const lifecycleLabel =
                    schedule.status === "cancelled"
                      ? "Cancelled"
                      : isClosed
                        ? "Closed"
                        : active
                          ? "Active"
                          : started
                            ? "Open"
                            : "Upcoming"
                  const totalOpeningStock =
                    schedule.booth_schedule_products.reduce(
                      (total, item) => total + item.quantity,
                      0
                    )
                  const totalCurrentStock =
                    schedule.booth_schedule_products.reduce(
                      (total, item) => total + item.stock,
                      0
                    )
                  const initialized =
                    schedule.booth_schedule_products.length > 0
                  const assignedEmployees = schedule.booth_schedule_assignments
                    .map((assignment) =>
                      getEmployeeDisplayName(assignment.employees)
                    )
                    .join(", ")

                  return (
                    <Card
                      key={schedule.id}
                      size="sm"
                      className="overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => void openScheduleDetails(schedule.id)}
                        className="hover:bg-muted/35 focus-visible:ring-ring/50 flex w-full flex-col text-left transition-colors focus-visible:ring-3 focus-visible:outline-none"
                        aria-label={`Open details for shift on ${schedule.date} from ${schedule.start_time.slice(0, 5)} to ${schedule.end_time.slice(0, 5)}`}
                      >
                        <CardHeader>
                          <CardTitle>
                            {schedule.date} / {schedule.start_time.slice(0, 5)}{" "}
                            - {schedule.end_time.slice(0, 5)}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-1.5">
                            <UserRound className="text-primary size-4" />
                            POS: {schedule.operator?.name ?? "Unassigned"}
                          </CardDescription>
                          <CardAction>
                            <Badge
                              variant={
                                schedule.status === "cancelled"
                                  ? "destructive"
                                  : isClosed
                                    ? "outline"
                                    : active
                                      ? "default"
                                      : "secondary"
                              }
                              className={
                                isClosed
                                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
                                  : undefined
                              }
                            >
                              {lifecycleLabel}
                            </Badge>
                          </CardAction>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3 pb-4">
                          <div className="text-muted-foreground text-sm">
                            Assigned: {assignedEmployees}
                          </div>
                          <div className="bg-muted text-foreground rounded-xl p-3 text-sm font-medium">
                            {initialized
                              ? `${schedule.booth_schedule_products.length} products / ${totalOpeningStock} opening / ${totalCurrentStock} current`
                              : "Awaiting employee inventory setup"}
                          </div>
                          <div className="border-border/70 bg-background/80 text-primary flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-medium">
                            <span>View shift details</span>
                            <ChevronRight className="size-4" />
                          </div>
                        </CardContent>
                      </button>
                    </Card>
                  )
                })}
              </div>
            )}
          </section>
        </TabsContent>
        <TabsContent value="map">
          <Card>
            <CardHeader>
              <CardTitle>Booth Map</CardTitle>
              <CardDescription>Saved location and map link.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={!mapLink}
                  onClick={handleCopyMapLink}
                >
                  <Copy data-icon="inline-start" />
                  Copy Link
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!mapLink}
                  render={
                    <a href={mapLink ?? "#"} target="_blank" rel="noreferrer" />
                  }
                  nativeButton={false}
                >
                  <ExternalLink data-icon="inline-start" />
                  Open Map
                </Button>
              </div>

              <BoothMapPreview
                booth={displayBooth}
                className="min-h-[20rem]"
                emptyTitle="No booth map yet"
                emptyDescription="Save booth coordinates or a location search result to render the map preview."
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="bg-muted/40 border-border rounded-xl border px-4 py-3">
                  <p className="app-kicker">Location</p>
                  <p className="text-foreground mt-1 text-sm">
                    {displayBooth.location_text ?? "No location details"}
                  </p>
                </div>
                <div className="bg-muted/40 border-border rounded-xl border px-4 py-3">
                  <p className="app-kicker">Coordinates</p>
                  <p className="text-foreground mt-1 text-sm">
                    {coordinates
                      ? `${formatCoordinateLabel(coordinates.latitude)}, ${formatCoordinateLabel(coordinates.longitude)}`
                      : "No coordinates saved"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
        allowOfflineSaleCache={false}
        onAddCashDeduction={
          selectedSchedule?.status === "scheduled"
            ? () => {
                setScheduleDetailOpen(false)
                setCashDeductionOpen(true)
              }
            : undefined
        }
        canCloseShift={selectedCanClose}
        onCloseShift={
          selectedCanClose
            ? () => {
                setScheduleDetailOpen(false)
                setCloseoutOpen(true)
              }
            : undefined
        }
        onEdit={selectedSchedule ? openScheduleEditFromDetails : undefined}
        onCancel={
          selectedSchedule &&
          !hasBusinessShiftPassed(
            selectedSchedule.date,
            selectedSchedule.end_time
          )
            ? openCancelFromDetails
            : undefined
        }
        onDelete={selectedSchedule ? openDeleteFromDetails : undefined}
        onOverride={
          canOverrideSelectedSchedule ? openOverrideFromDetails : undefined
        }
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
      <BoothFormSheet
        booth={displayBooth}
        open={boothFormOpen}
        onOpenChange={setBoothFormOpen}
        onOptimisticSave={handleOptimisticBoothSave}
        onSaved={(nextBooth) => {
          const optimisticId = optimisticBoothIdRef.current
          optimisticBoothIdRef.current = null
          setDisplayBooth(nextBooth)
          setDisplayBooths((current) =>
            sortBooths(
              current
                .filter(
                  (entry) =>
                    entry.id !== optimisticId && entry.id !== nextBooth.id
                )
                .concat(nextBooth)
            )
          )
        }}
      />
      <ScheduleFormSheet
        open={scheduleFormOpen}
        onOpenChange={setScheduleFormOpen}
        schedule={editingSchedule}
        initialBoothId={displayBooth.id}
        boothLocked
        booths={displayBooths.filter((candidate) => candidate.is_active)}
        employees={employees}
        onOptimisticSave={handleOptimisticScheduleSave}
        onSaved={() => {
          optimisticScheduleIdsRef.current = []
          setEditingSchedule(null)
          router.refresh()
        }}
      />
      <InventoryOverrideSheet
        open={Boolean(overridingSchedule)}
        onOpenChange={(open) => {
          if (!open) {
            setOverridingSchedule(null)
          }
        }}
        schedule={overridingSchedule}
        products={products}
        onSaved={() => {
          setOverridingSchedule(null)
          router.refresh()
        }}
      />
      {reopeningSchedule ? (
        <ShiftReopenSheet
          open={Boolean(reopeningSchedule)}
          onOpenChange={(open) => {
            if (!open) {
              setReopeningSchedule(null)
            }
          }}
          boothId={displayBooth.id}
          boothName={displayBooth.name}
          scheduleId={reopeningSchedule.id}
          shiftLabel={`${reopeningSchedule.date} / ${reopeningSchedule.start_time.slice(0, 5)} - ${reopeningSchedule.end_time.slice(0, 5)}`}
          onSaved={() => {
            setReopeningSchedule(null)
            router.refresh()
          }}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(cancellingSchedule)}
        onOpenChange={(open) => {
          if (!open) {
            setCancellingSchedule(null)
          }
        }}
        title="Cancel this shift?"
        description="The assignment will be removed from Counter access but retained in admin and employee history."
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
      <ConfirmDialog
        open={confirmDeactivate}
        onOpenChange={setConfirmDeactivate}
        title="Deactivate this booth?"
        description="Upcoming shifts will be cancelled automatically. Deactivation is blocked while a scheduled shift is currently active."
        confirmLabel="Deactivate Booth"
        pendingLabel="Deactivating..."
        cancelLabel="Keep Active"
        variant="destructive"
        onConfirm={handleDeactivate}
      />
      <ConfirmDialog
        open={confirmDeleteBooth}
        onOpenChange={setConfirmDeleteBooth}
        title="Delete this booth?"
        description="This permanently removes the booth, all of its shifts, all related sales, and receipt history."
        confirmLabel="Delete Booth"
        pendingLabel="Deleting..."
        cancelLabel="Keep Booth"
        variant="destructive"
        onConfirm={handleDeleteBooth}
      />
    </div>
  )
}
