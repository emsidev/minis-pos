"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, MapPin, Pencil, Plus, RotateCcw, Store } from "lucide-react"
import { toast } from "sonner"

import { deactivateBooth, reactivateBooth } from "@/app/actions/adminBooths"
import { AdminScheduleCalendar } from "@/components/admin/AdminScheduleCalendar"
import { BoothFormSheet } from "@/components/admin/BoothFormSheet"
import { ScheduleFormSheet } from "@/components/admin/ScheduleFormSheet"
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
import type {
  AdminEmployeeOption,
  AdminScheduleCalendarItem,
} from "@/lib/adminBooths"
import type { Booth } from "@/lib/shifts"

type AdminBoothsClientProps = {
  booths: Booth[]
  schedules: AdminScheduleCalendarItem[]
  employees: AdminEmployeeOption[]
}

function sortBooths(rows: Booth[]) {
  return rows.slice().sort((left, right) => left.name.localeCompare(right.name))
}

export function AdminBoothsClient({
  booths,
  schedules,
  employees,
}: AdminBoothsClientProps) {
  const [displayBooths, setDisplayBooths] = useState(booths)
  const [formOpen, setFormOpen] = useState(false)
  const [scheduleFormOpen, setScheduleFormOpen] = useState(false)
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

  const openEdit = (booth: Booth) => {
    setEditingBooth(booth)
    setFormOpen(true)
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
            onClick={() => setScheduleFormOpen(true)}
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
              <AdminScheduleCalendar schedules={schedules} loadMonths />
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
        schedule={null}
        initialBoothId=""
        booths={displayBooths.filter((booth) => booth.is_active)}
        employees={employees}
        onSaved={() => undefined}
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
    </div>
  )
}
