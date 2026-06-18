"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
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
  loadAdminScheduleDetail,
  reactivateBooth,
} from "@/app/actions/adminBooths"
import { BoothMapPreview } from "@/components/admin/BoothMapPreview"
import { AdminScheduleCalendar } from "@/components/admin/AdminScheduleCalendar"
import { AdminScheduleDetailSheet } from "@/components/admin/AdminScheduleDetailSheet"
import { BoothFormSheet } from "@/components/admin/BoothFormSheet"
import { InventoryOverrideSheet } from "@/components/admin/InventoryOverrideSheet"
import { ScheduleFormSheet } from "@/components/admin/ScheduleFormSheet"
import { ShiftReopenSheet } from "@/components/admin/ShiftReopenSheet"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
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
import type { AdminEmployeeOption, AdminSchedule } from "@/lib/adminBooths"
import type { Booth, Product } from "@/lib/shifts"
import { hasBusinessShiftStarted, isCurrentBusinessShift } from "@/lib/utils"

type AdminBoothDetailClientProps = {
  booth: Booth
  booths: Booth[]
  employees: AdminEmployeeOption[]
  products: Product[]
  schedules: AdminSchedule[]
}

function formatCoordinateLabel(value: number) {
  return value.toFixed(6)
}

export function AdminBoothDetailClient({
  booth,
  booths,
  employees,
  products,
  schedules,
}: AdminBoothDetailClientProps) {
  const [displayBooth, setDisplayBooth] = useState(booth)
  const [displayBooths, setDisplayBooths] = useState(booths)
  const [displaySchedules, setDisplaySchedules] = useState(schedules)
  const [boothFormOpen, setBoothFormOpen] = useState(false)
  const [scheduleFormOpen, setScheduleFormOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<AdminSchedule | null>(
    null
  )
  const [selectedSchedule, setSelectedSchedule] =
    useState<AdminSchedule | null>(null)
  const [scheduleDetailOpen, setScheduleDetailOpen] = useState(false)
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

  useEffect(() => {
    setSelectedSchedule((current) => {
      if (!current) {
        return null
      }

      const nextSummary = displaySchedules.find(
        (schedule) => schedule.id === current.id
      )

      if (!nextSummary) {
        return current
      }

      return {
        ...nextSummary,
        booth_schedule_operator_periods:
          nextSummary.booth_schedule_operator_periods.length > 0
            ? nextSummary.booth_schedule_operator_periods
            : current.booth_schedule_operator_periods,
        inventory_events:
          nextSummary.inventory_events.length > 0
            ? nextSummary.inventory_events
            : current.inventory_events,
      }
    })
  }, [displaySchedules])

  const openScheduleCreate = () => {
    setEditingSchedule(null)
    setScheduleFormOpen(true)
  }

  const openScheduleEdit = (schedule: AdminSchedule) => {
    setEditingSchedule(schedule)
    setScheduleFormOpen(true)
  }

  const openScheduleDetails = async (scheduleId: string) => {
    try {
      const schedule = await loadAdminScheduleDetail(scheduleId)
      if (!schedule) {
        toast.error("This shift is no longer available.")
        return
      }

      setSelectedSchedule(schedule)
      setScheduleDetailOpen(true)
    } catch (error) {
      console.error("Unable to load shift details:", error)
      toast.error("Unable to load shift details.")
    }
  }

  const openScheduleEditFromDetails = () => {
    if (!selectedSchedule) {
      return
    }

    setScheduleDetailOpen(false)
    openScheduleEdit(selectedSchedule)
  }

  const openCancelFromDetails = () => {
    if (!selectedSchedule) {
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
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="size-4 text-primary" />
              {displayBooth.location_text ?? "No location details"}
            </p>
            {mapLink ? (
              <a
                href={mapLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-2 text-sm font-medium text-primary hover:underline"
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
            <div>
              <p className="app-kicker">Assignment History</p>
              <h2 className="app-section-title">Shift Setup And Actions</h2>
            </div>
            {displaySchedules.length === 0 ? (
              <div className="app-panel p-8 text-center text-sm text-muted-foreground">
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
                        className="hover:bg-muted/35 focus-visible:ring-3 focus-visible:ring-ring/50 flex w-full flex-col text-left transition-colors focus-visible:outline-none"
                        aria-label={`Open details for shift on ${schedule.date} from ${schedule.start_time.slice(0, 5)} to ${schedule.end_time.slice(0, 5)}`}
                      >
                        <CardHeader>
                          <CardTitle>
                            {schedule.date} / {schedule.start_time.slice(0, 5)}{" "}
                            - {schedule.end_time.slice(0, 5)}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-1.5">
                            <UserRound className="size-4 text-primary" />
                            POS: {schedule.operator?.name ?? "Unknown employee"}
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
                          <div className="text-sm text-muted-foreground">
                            Assigned: {assignedEmployees}
                          </div>
                          <div className="rounded-xl bg-muted p-3 text-sm font-medium text-foreground">
                            {initialized
                              ? `${schedule.booth_schedule_products.length} products / ${totalOpeningStock} opening / ${totalCurrentStock} current`
                              : "Awaiting employee inventory setup"}
                          </div>
                          <div className="border-border/70 bg-background/80 flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-medium text-primary">
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
                <div className="bg-muted/40 rounded-xl border border-border px-4 py-3">
                  <p className="app-kicker">Location</p>
                  <p className="mt-1 text-sm text-foreground">
                    {displayBooth.location_text ?? "No location details"}
                  </p>
                </div>
                <div className="bg-muted/40 rounded-xl border border-border px-4 py-3">
                  <p className="app-kicker">Coordinates</p>
                  <p className="mt-1 text-sm text-foreground">
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

      <AdminScheduleDetailSheet
        open={scheduleDetailOpen}
        onOpenChange={setScheduleDetailOpen}
        schedule={selectedSchedule}
        onEdit={openScheduleEditFromDetails}
        onCancel={openCancelFromDetails}
        onOverride={openOverrideFromDetails}
        onReopen={openReopenFromDetails}
      />
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
        onSaved={() => undefined}
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
        onSaved={() => undefined}
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
          onSaved={() => undefined}
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
