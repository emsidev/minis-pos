"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useLiveQuery } from "dexie-react-hooks"
import { Calendar } from "lucide-react"
import { toast } from "sonner"

import { claimShiftOperator } from "@/app/actions/shifts"
import { EmptyState } from "@/components/shared/EmptyState"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { ShiftCloseoutSheet } from "@/components/shifts/ShiftCloseoutSheet"
import { ShiftDetailView } from "@/components/shifts/ShiftDetailView"
import type {
  BoothSchedule,
  Product,
  SaleWithJoins,
  SharedBoothSchedule,
} from "@/lib/shifts"
import {
  getCachedActiveShiftDetails,
  getCachedAvailableProducts,
  getCachedShiftDetails,
  type CachedShiftDetails,
} from "@/lib/offlineData"
import {
  getBusinessDate,
  hasBusinessShiftStarted,
  isCurrentBusinessShift,
} from "@/lib/utils"
import {
  refreshActiveShiftWorkspace,
  syncActiveShiftProducts,
} from "@/lib/sync"
import { createClient } from "@/lib/supabase"

type ShiftPageClientProps = {
  employeeId: string
  employeeRole: string | null
  mode: "active" | "fixed"
  scheduleId?: string
  initialData: {
    schedule: SharedBoothSchedule | null
    products: Product[]
    sales: SaleWithJoins[]
  }
  initialAvailableProducts: Product[]
  preferCachedData?: boolean
}

function isFutureShift(schedule: BoothSchedule) {
  return !hasBusinessShiftStarted(schedule.date, schedule.start_time)
}

export function ShiftPageClient({
  employeeId,
  employeeRole,
  mode,
  scheduleId,
  initialData,
  initialAvailableProducts,
  preferCachedData = false,
}: ShiftPageClientProps) {
  const router = useRouter()
  const [confirmTakeover, setConfirmTakeover] = useState(false)
  const [closeoutOpen, setCloseoutOpen] = useState(false)
  const [takeoverPending, setTakeoverPending] = useState(false)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cachedData = useLiveQuery<CachedShiftDetails>(
    () =>
      mode === "active"
        ? getCachedActiveShiftDetails(employeeId)
        : scheduleId
          ? getCachedShiftDetails(scheduleId)
          : Promise.resolve({ schedule: null, products: [], sales: [] }),
    [employeeId, mode, scheduleId]
  )
  const cachedAvailableProducts = useLiveQuery(() =>
    getCachedAvailableProducts()
  )
  const shouldUseCachedData =
    typeof window !== "undefined" &&
    (!window.navigator.onLine || preferCachedData)
  const displayData = shouldUseCachedData
    ? cachedData?.schedule
      ? cachedData
      : initialData
    : initialData
  const availableProducts =
    shouldUseCachedData &&
    cachedAvailableProducts &&
    cachedAvailableProducts.length > 0
      ? cachedAvailableProducts
      : initialAvailableProducts

  useEffect(() => {
    if (
      mode !== "active" ||
      !initialData.schedule?.id ||
      typeof window === "undefined" ||
      !window.navigator.onLine
    ) {
      return
    }

    const supabase = createClient()
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }

      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null
        refreshActiveShiftWorkspace(employeeId)
          .then(() => {
            router.refresh()
          })
          .catch((error) => {
            console.warn("Active shift refresh failed:", error)
          })
      }, 300)
    }

    const channel = supabase
      .channel(`active-shift-live-${employeeId}-${initialData.schedule.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales",
          filter: `schedule_id=eq.${initialData.schedule.id}`,
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "booth_schedule_products",
          filter: `schedule_id=eq.${initialData.schedule.id}`,
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inventory_events",
          filter: `schedule_id=eq.${initialData.schedule.id}`,
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "booth_schedules",
          filter: `id=eq.${initialData.schedule.id}`,
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "booth_schedule_operator_periods",
          filter: `schedule_id=eq.${initialData.schedule.id}`,
        },
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
  }, [employeeId, initialData.schedule?.id, mode, router])

  if (!displayData.schedule) {
    if (mode === "active") {
      return (
        <div className="app-page-center">
          <EmptyState
            icon={<Calendar className="text-primary/60 h-12 w-12" />}
            title="No Active Shift"
            description="You do not have a booth assignment that is currently active. Check your schedule for upcoming shifts."
            actionLabel="View Schedule"
            href="/schedule"
          />
        </div>
      )
    }

    return (
      <div className="app-page-center">
        <p className="text-muted-foreground">
          Shift details are not available offline yet.
        </p>
      </div>
    )
  }

  const schedule = displayData.schedule
  const isAssigned = schedule.booth_schedule_assignments.some(
    (assignment) => assignment.employee_id === employeeId
  )

  if (employeeRole !== "admin" && !isAssigned) {
    return (
      <div className="app-page-center">
        <p className="text-muted-foreground">
          You do not have permission to view this schedule.
        </p>
      </div>
    )
  }

  const active =
    schedule.status === "scheduled" &&
    isCurrentBusinessShift(
      schedule.date,
      schedule.start_time,
      schedule.end_time
    )
  const operatesPos = schedule.operator_employee_id === employeeId
  const canTakeOver =
    employeeRole !== "admin" && isAssigned && active && !operatesPos
  const canCloseShift =
    operatesPos &&
    schedule.status === "scheduled" &&
    schedule.date === getBusinessDate() &&
    hasBusinessShiftStarted(schedule.date, schedule.start_time)

  const handleTakeover = async () => {
    if (!window.navigator.onLine) {
      toast.error("Reconnect before taking over POS for this shift.")
      return
    }

    setTakeoverPending(true)
    const result = await claimShiftOperator(schedule.id)
    if (!result.ok) {
      toast.error(result.error ?? "Unable to take over POS.")
      setTakeoverPending(false)
      return
    }

    await syncActiveShiftProducts(employeeId)
    router.refresh()
    toast.success(result.message)
    setTakeoverPending(false)
  }

  return (
    <>
      <ShiftDetailView
        schedule={schedule}
        products={displayData.products}
        sales={displayData.sales}
        isFuture={isFutureShift(schedule)}
        availableProducts={availableProducts}
        inventoryEmployeeId={employeeId}
        canManageInventory={employeeRole !== "admin" && operatesPos && active}
        canTakeOver={canTakeOver}
        takeoverPending={takeoverPending}
        onTakeOver={() => setConfirmTakeover(true)}
        canCloseShift={canCloseShift}
        onCloseShift={() => setCloseoutOpen(true)}
      />
      <ShiftCloseoutSheet
        open={closeoutOpen}
        onOpenChange={setCloseoutOpen}
        schedule={schedule}
        products={displayData.products}
        sales={displayData.sales}
        onSaved={() => undefined}
      />
      <ConfirmDialog
        open={confirmTakeover}
        onOpenChange={setConfirmTakeover}
        title="Take over POS?"
        description="You will become the only employee able to enter sales and update inventory for this active shared shift."
        confirmLabel="Take Over POS"
        onConfirm={handleTakeover}
      />
    </>
  )
}
