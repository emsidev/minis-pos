"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, MapPin, Pencil, Plus, RotateCcw, Store } from "lucide-react"
import { toast } from "sonner"

import {
  cancelBoothSchedule,
  deactivateBooth,
  loadAdminShiftDetail,
  reactivateBooth,
} from "@/app/actions/adminBooths"
import { AdminScheduleCalendar } from "@/components/admin/AdminScheduleCalendar"
import { BoothFormSheet } from "@/components/admin/BoothFormSheet"
import { ScheduleFormSheet } from "@/components/admin/ScheduleFormSheet"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
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

export function AdminBoothsClient({
  booths,
  schedules,
  employees,
  currentEmployeeId,
}: AdminBoothsClientProps) {
  const router = useRouter()
  const [displayBooths, setDisplayBooths] = useState(booths)
  const [formOpen, setFormOpen] = useState(false)
  const [scheduleFormOpen, setScheduleFormOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<AdminSchedule | null>(
    null
  )
  const [selectedDetail, setSelectedDetail] =
    useState<AdminShiftDetailData | null>(null)
  const [scheduleDetailOpen, setScheduleDetailOpen] = useState(false)
  const [scheduleDetailLoading, setScheduleDetailLoading] = useState(false)
  const [scheduleDetailError, setScheduleDetailError] = useState<string | null>(
    null
  )
  const [joiningSchedule, setJoiningSchedule] = useState(false)
  const [cancellingSchedule, setCancellingSchedule] =
    useState<AdminSchedule | null>(null)
  const [editingBooth, setEditingBooth] = useState<Booth | null>(null)
  const [deactivatingBooth, setDeactivatingBooth] = useState<Booth | null>(null)
  const [reactivatingBoothId, setReactivatingBoothId] = useState<string | null>(
    null
  )

  useEffect(() => {
    setDisplayBooths(booths)
  }, [booths])

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

    toast.success(result.message)
    router.refresh()
  }

  const selectedSchedule = selectedDetail?.schedule ?? null
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

  const handleDeactivate = async () => {
    if (!deactivatingBooth) {
      return
    }

    const result = await deactivateBooth(deactivatingBooth.id)
    if (!result.ok) {
      toast.error(result.error ?? "Unable to deactivate booth.")
      throw new Error(result.error ?? "Unable to deactivate booth.")
    }

    setDisplayBooths((current) =>
      current.map((booth) =>
        booth.id === deactivatingBooth.id
          ? { ...booth, is_active: false }
          : booth
      )
    )
    toast.success(result.message)
  }

  const handleReactivate = async (booth: Booth) => {
    setReactivatingBoothId(booth.id)

    try {
      const result = await reactivateBooth(booth.id)
      if (!result.ok) {
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

  return (
    <div className="app-page flex flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="app-kicker">Admin Workspace</p>
          <h1 className="text-3xl font-semibold">Booth Management</h1>
          <p className="app-caption">
            Manage sales locations and assign scheduled Counter shifts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
            <div className="app-panel p-8 text-center text-sm text-muted-foreground">
              No booths have been added yet.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {displayBooths.map((booth) => {
                const scheduleCount = schedules.filter(
                  (schedule) =>
                    schedule.booth_id === booth.id &&
                    schedule.status === "scheduled"
                ).length

                return (
                  <Card key={booth.id}>
                    <CardHeader>
                      <CardTitle>{booth.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1.5">
                        <MapPin className="size-4 text-primary" />
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
                      <div className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">
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
                All booth assignments, including retained cancellation history.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminScheduleCalendar
                schedules={schedules}
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
        onSaved={(booth) => {
          setDisplayBooths((current) =>
            sortBooths([
              booth,
              ...current.filter((entry) => entry.id !== booth.id),
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
        onSaved={() => {
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
          selectedSchedule
            ? () => {
                setScheduleDetailOpen(false)
                setCancellingSchedule(selectedSchedule)
              }
            : undefined
        }
        onOverride={undefined}
        onReopen={undefined}
      />
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
    </div>
  )
}
