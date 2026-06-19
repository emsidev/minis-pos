"use client"

import { useEffect, useState } from "react"
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
  UserRound,
} from "lucide-react"
import { toast } from "sonner"

import {
  cancelBoothSchedule,
  deactivateBooth,
  loadAdminShiftDetail,
  reactivateBooth,
} from "@/app/actions/adminBooths"
import { BoothMapPreview } from "@/components/admin/BoothMapPreview"
import { AdminScheduleCalendar } from "@/components/admin/AdminScheduleCalendar"
import { BoothFormSheet } from "@/components/admin/BoothFormSheet"
import { InventoryOverrideSheet } from "@/components/admin/InventoryOverrideSheet"
import { ScheduleFormSheet } from "@/components/admin/ScheduleFormSheet"
import { ShiftReopenSheet } from "@/components/admin/ShiftReopenSheet"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
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
  const [scheduleDetailLoading, setScheduleDetailLoading] = useState(false)
  const [scheduleDetailError, setScheduleDetailError] = useState<string | null>(
    null
  )
  const [joiningSchedule, setJoiningSchedule] = useState(false)
  const [cancellingSchedule, setCancellingSchedule] =
    useState<AdminSchedule | null>(null)
  const [overridingSchedule, setOverridingSchedule] =
    useState<AdminSchedule | null>(null)
  const [reopeningSchedule, setReopeningSchedule] =
    useState<AdminSchedule | null>(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [reactivatingBooth, setReactivatingBooth] = useState(false)
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
      const detail = await loadAdminShiftDetail(scheduleId)
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
  const selectedOperatorCanClose =
    selectedSchedule?.operator_employee_id === currentEmployeeId &&
    selectedSchedule.status === "scheduled" &&
    hasBusinessShiftPassed(selectedSchedule.date, selectedSchedule.end_time)
  const adminAssignedToSelected =
    selectedSchedule?.booth_schedule_assignments.some(
      (assignment) => assignment.employee_id === currentEmployeeId
    ) ?? false
  const canJoinSelectedSchedule =
    selectedSchedule !== null &&
    selectedSchedule.status === "scheduled" &&
    !adminAssignedToSelected

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
    if (
      !selectedSchedule ||
      hasBusinessShiftPassed(selectedSchedule.date, selectedSchedule.end_time)
    ) {
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

  const openOverrideFromDetails = () => {
    if (!selectedSchedule) {
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

    const result = await cancelBoothSchedule(
      cancellingSchedule.id,
      cancellingSchedule.booth_id
    )
    if (!result.ok) {
      toast.error(result.error ?? "Unable to cancel shift.")
      throw new Error(result.error ?? "Unable to cancel shift.")
    }

    setDisplaySchedules((current) =>
      current.map((schedule) =>
        schedule.id === cancellingSchedule.id
          ? { ...schedule, status: "cancelled" }
          : schedule
      )
    )
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

  const handleDeactivate = async () => {
    const result = await deactivateBooth(displayBooth.id)
    if (!result.ok) {
      toast.error(result.error ?? "Unable to deactivate booth.")
      throw new Error(result.error ?? "Unable to deactivate booth.")
    }

    setDisplayBooth((current) => ({ ...current, is_active: false }))
    setDisplayBooths((current) =>
      current.map((entry) =>
        entry.id === displayBooth.id ? { ...entry, is_active: false } : entry
      )
    )
    toast.success(result.message)
    router.refresh()
  }

  const handleReactivate = async () => {
    setReactivatingBooth(true)

    try {
      const result = await reactivateBooth(displayBooth.id)
      if (!result.ok) {
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
        <div className="app-panel flex flex-col justify-between gap-5 p-5 sm:flex-row sm:items-start sm:p-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold">{displayBooth.name}</h1>
              <Badge variant={displayBooth.is_active ? "default" : "outline"}>
                {displayBooth.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
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
          <div className="flex flex-wrap gap-2">
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
              </>
            ) : (
              <Button
                type="button"
                variant="secondary"
                disabled={reactivatingBooth}
                onClick={handleReactivate}
              >
                {reactivatingBooth ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <RotateCcw data-icon="inline-start" />
                )}
                Reactivate Booth
              </Button>
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
                Scheduled, closed, and cancelled assignments remain in audit
                history.
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="app-kicker">Assignment History</p>
                <h2 className="app-section-title">Shift Setup And Actions</h2>
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
                    .map(
                      (assignment) =>
                        assignment.employees?.name ?? "Unknown employee"
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
              <CardDescription>
                Review the saved booth location and copy the saved map link.
              </CardDescription>
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
            .map(
              (assignment) => assignment.employees?.name ?? "Unknown employee"
            )
            .filter(Boolean) ?? []
        }
        operatorName={selectedSchedule?.operator?.name ?? null}
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
        allowOfflineSaleCache={false}
        canCloseShift={selectedOperatorCanClose}
        onCloseShift={
          selectedOperatorCanClose
            ? () => {
                setScheduleDetailOpen(false)
                setCloseoutOpen(true)
              }
            : undefined
        }
        onEdit={
          selectedSchedule &&
          !hasBusinessShiftPassed(
            selectedSchedule.date,
            selectedSchedule.end_time
          )
            ? openScheduleEditFromDetails
            : undefined
        }
        onCancel={
          selectedSchedule &&
          !hasBusinessShiftPassed(
            selectedSchedule.date,
            selectedSchedule.end_time
          )
            ? openCancelFromDetails
            : undefined
        }
        onOverride={openOverrideFromDetails}
        onReopen={openReopenFromDetails}
      />
      {selectedSchedule ? (
        <ShiftCloseoutSheet
          open={closeoutOpen}
          onOpenChange={setCloseoutOpen}
          schedule={selectedSchedule}
          products={selectedDetail?.products ?? []}
          sales={selectedDetail?.sales ?? []}
          onSaved={handleCloseoutSaved}
        />
      ) : null}
      <BoothFormSheet
        booth={displayBooth}
        open={boothFormOpen}
        onOpenChange={setBoothFormOpen}
        onSaved={(nextBooth) => {
          setDisplayBooth(nextBooth)
          setDisplayBooths((current) =>
            current.map((entry) =>
              entry.id === nextBooth.id ? nextBooth : entry
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
        onSaved={() => {
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
    </div>
  )
}
