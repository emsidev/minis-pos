"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useLiveQuery } from "dexie-react-hooks"
import { Calendar, Clock, ShieldAlert, Store, WifiOff } from "lucide-react"
import { toast } from "sonner"

import {
  claimShiftOperator,
  getShiftDetails,
  requestShiftReopenApproval,
} from "@/app/actions/shifts"
import { CashDeductionSheet } from "@/components/shifts/CashDeductionSheet"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { EmptyState } from "@/components/shared/EmptyState"
import { ShiftCloseoutSheet } from "@/components/shifts/ShiftCloseoutSheet"
import { ShiftDetailSheet } from "@/components/shifts/ShiftDetailSheet"
import { ShiftDetailView } from "@/components/shifts/ShiftDetailView"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  getCachedActiveShiftDetails,
  getCachedAvailableProducts,
  getCachedShiftDetails,
  hasInFlightScheduleOperations,
  type CachedShiftDetails,
} from "@/lib/offlineData"
import type {
  Product,
  SaleWithJoins,
  SharedBoothSchedule,
  ShiftDetailData,
  TodayShiftListItem,
} from "@/lib/shifts"
import {
  getBoothDisplayName,
  getBusinessShiftState,
  getEmployeeDisplayName,
  hasStartedOperatorPeriod,
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
    saleItems: ShiftDetailData["saleItems"]
    approvalHistory?: ShiftDetailData["approvalHistory"]
    pendingRevenueIncrease?: number
    pendingRevenueDecrease?: number
  }
  initialAvailableProducts: Product[]
  preferCachedData?: boolean
  todayShifts?: TodayShiftListItem[]
}

function emptyShiftDetailData(): ShiftDetailData {
  return {
    schedule: null,
    products: [],
    sales: [],
    saleItems: [],
  }
}

export function ShiftPageClient({
  employeeId,
  employeeRole,
  mode,
  scheduleId,
  initialData,
  initialAvailableProducts,
  preferCachedData = false,
  todayShifts = [],
}: ShiftPageClientProps) {
  const router = useRouter()
  const [confirmTakeover, setConfirmTakeover] = useState(false)
  const [closeoutOpen, setCloseoutOpen] = useState(false)
  const [cashDeductionOpen, setCashDeductionOpen] = useState(false)
  const [cashDeductionTarget, setCashDeductionTarget] =
    useState<SharedBoothSchedule | null>(null)
  const [holdOptimisticInventory, setHoldOptimisticInventory] = useState(false)
  const [startingScheduleId, setStartingScheduleId] = useState<string | null>(
    null
  )
  const [takeoverPending, setTakeoverPending] = useState(false)
  const [reopenApprovalPending, setReopenApprovalPending] = useState(false)
  const [pendingReopenApprovalCount, setPendingReopenApprovalCount] =
    useState(0)
  const [todayDetailOpen, setTodayDetailOpen] = useState(false)
  const [todayDetailLoading, setTodayDetailLoading] = useState(false)
  const [todayDetailError, setTodayDetailError] = useState<string | null>(null)
  const [selectedTodayShift, setSelectedTodayShift] =
    useState<TodayShiftListItem | null>(null)
  const [todayDetailData, setTodayDetailData] =
    useState<ShiftDetailData>(emptyShiftDetailData)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cachedData = useLiveQuery<CachedShiftDetails>(
    () =>
      mode === "active"
        ? getCachedActiveShiftDetails(employeeId)
        : scheduleId
          ? getCachedShiftDetails(scheduleId)
          : Promise.resolve({
              schedule: null,
              products: [],
              sales: [],
              saleItems: [],
            }),
    [employeeId, mode, scheduleId]
  )
  const cachedAvailableProducts = useLiveQuery(() =>
    getCachedAvailableProducts()
  )
  const resolvedScheduleId = initialData.schedule?.id ?? scheduleId
  const hasInFlightScheduleOps = useLiveQuery(
    () =>
      resolvedScheduleId
        ? hasInFlightScheduleOperations(resolvedScheduleId)
        : Promise.resolve(false),
    [resolvedScheduleId],
    false
  )
  const shouldUseCachedData =
    typeof window !== "undefined" &&
    (!window.navigator.onLine || preferCachedData)
  const shouldUseOptimisticData =
    typeof window !== "undefined" &&
    window.navigator.onLine &&
    Boolean(initialData.schedule) &&
    Boolean(cachedData?.schedule) &&
    (hasInFlightScheduleOps || holdOptimisticInventory)
  const displayData = shouldUseCachedData
    ? cachedData?.schedule
      ? cachedData
      : initialData
    : shouldUseOptimisticData
      ? {
          schedule: initialData.schedule ?? cachedData?.schedule ?? null,
          products: cachedData?.products ?? initialData.products,
          sales: cachedData?.sales ?? initialData.sales,
          saleItems: cachedData?.saleItems ?? initialData.saleItems,
          approvalHistory:
            initialData.approvalHistory ?? cachedData?.approvalHistory ?? [],
          pendingRevenueIncrease:
            initialData.pendingRevenueIncrease ??
            cachedData?.pendingRevenueIncrease ??
            0,
          pendingRevenueDecrease:
            initialData.pendingRevenueDecrease ??
            cachedData?.pendingRevenueDecrease ??
            0,
        }
      : initialData
  const availableProducts =
    shouldUseCachedData &&
    cachedAvailableProducts &&
    cachedAvailableProducts.length > 0
      ? cachedAvailableProducts
      : initialAvailableProducts

  const resetTodayDetail = () => {
    setTodayDetailOpen(false)
    setTodayDetailLoading(false)
    setTodayDetailError(null)
    setSelectedTodayShift(null)
    setTodayDetailData(emptyShiftDetailData())
  }

  const handleInventorySavePhaseChange = async (
    phase: "started" | "queued" | "reconciled"
  ) => {
    if (phase === "started") {
      setHoldOptimisticInventory(true)
      return
    }

    if (
      phase !== "reconciled" ||
      !resolvedScheduleId ||
      typeof window === "undefined" ||
      !window.navigator.onLine
    ) {
      setHoldOptimisticInventory(false)
      return
    }

    try {
      await refreshActiveShiftWorkspace(employeeId)
      router.refresh()
    } catch (error) {
      console.warn("Shift inventory reconciliation failed:", error)
    } finally {
      setHoldOptimisticInventory(false)
    }
  }

  const loadTodayShiftDetail = async (shift: TodayShiftListItem) => {
    let cachedDetail: CachedShiftDetails | null = null

    try {
      cachedDetail = await getCachedShiftDetails(shift.id)
      if (cachedDetail.schedule) {
        setTodayDetailData(cachedDetail)
      }

      if (!window.navigator.onLine) {
        if (!cachedDetail.schedule) {
          setTodayDetailError("Shift details are not available offline yet.")
        }
        return
      }

      const detail = await getShiftDetails(shift.id)
      setTodayDetailData(detail)
      setTodayDetailError(
        detail.schedule ? null : "Could not load shift details."
      )
    } catch {
      if (!cachedDetail?.schedule) {
        setTodayDetailError(
          "Could not load shift details. Try again once you reconnect."
        )
      }
    } finally {
      setTodayDetailLoading(false)
    }
  }

  const openTodayShiftDetail = async (shift: TodayShiftListItem) => {
    if (displayData.schedule?.id === shift.id) {
      return
    }

    setSelectedTodayShift(shift)
    setTodayDetailOpen(true)
    setTodayDetailLoading(true)
    setTodayDetailError(null)
    setTodayDetailData(emptyShiftDetailData())
    await loadTodayShiftDetail(shift)
  }

  const openCashDeductionSheet = (target: SharedBoothSchedule) => {
    setCashDeductionTarget(target)
    setCashDeductionOpen(true)
  }

  const startShift = async (targetScheduleId: string) => {
    if (!window.navigator.onLine) {
      toast.error("Reconnect before starting this shift.")
      return false
    }

    setStartingScheduleId(targetScheduleId)
    const result = await claimShiftOperator(targetScheduleId)
    if (!result.ok) {
      toast.error(result.error ?? "Unable to start this shift.")
      setStartingScheduleId(null)
      return false
    }

    await syncActiveShiftProducts(employeeId)
    resetTodayDetail()
    router.refresh()
    setStartingScheduleId(null)
    return true
  }

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
          table: "products",
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
          table: "shift_action_approvals",
          filter: `schedule_id=eq.${initialData.schedule.id}`,
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shift_closeouts",
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
          table: "booth_schedule_assignments",
          filter: `schedule_id=eq.${initialData.schedule.id}`,
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "booth_schedule_assignments",
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

  useEffect(() => {
    if (
      mode !== "active" ||
      initialData.schedule?.id ||
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
            console.warn("Active shift empty-state refresh failed:", error)
          })
      }, 300)
    }

    const channel = supabase
      .channel(`active-shift-empty-live-${employeeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "booth_schedule_assignments",
          filter: `employee_id=eq.${employeeId}`,
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

  const renderTodayShifts = () => {
    if (mode !== "active" || todayShifts.length === 0) {
      return null
    }

    return (
      <section className="app-panel space-y-4 p-4 sm:p-5">
        <div className="app-screen-header sm:items-center">
          <div className="app-screen-copy">
            <h2 className="app-section-title">Today&apos;s Shifts</h2>
            <p className="app-screen-description max-w-xl">
              Open another shift for details or start it early.
            </p>
          </div>
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {todayShifts.length}
          </Badge>
        </div>
        <div className="space-y-3">
          {todayShifts.map((shift) => {
            const shiftState = getBusinessShiftState(shift, {
              inventoryReady: shift.hasOpeningInventory,
              manuallyStarted: hasStartedOperatorPeriod(
                shift.booth_schedule_operator_periods
              ),
            })
            const isCurrent = displayData.schedule?.id === shift.id
            const canStart = !isCurrent && shiftState.canManuallyStart

            return (
              <div
                key={shift.id}
                className="app-panel-muted flex items-center justify-between gap-3 rounded-[calc(var(--radius)-0.15rem)] p-4"
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">
                      {getBoothDisplayName(shift.booths)}
                    </p>
                    {isCurrent ? (
                      <Badge className="rounded-full">Current</Badge>
                    ) : null}
                    {canStart ? (
                      <Badge variant="secondary" className="rounded-full">
                        Start available
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {shift.start_time.slice(0, 5)} -{" "}
                      {shift.end_time.slice(0, 5)}
                    </span>
                    {shift.operator ? (
                      <span className="truncate">
                        POS: {getEmployeeDisplayName(shift.operator)}
                      </span>
                    ) : null}
                  </div>
                </div>
                {isCurrent ? null : (
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() => void openTodayShiftDetail(shift)}
                    >
                      Details
                    </Button>
                    {canStart ? (
                      <Button
                        className="rounded-full"
                        disabled={startingScheduleId !== null}
                        onClick={() => void startShift(shift.id)}
                      >
                        <Store className="mr-2 h-4 w-4" />
                        {startingScheduleId === shift.id
                          ? "Starting..."
                          : "Start Shift"}
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  if (!displayData.schedule) {
    if (mode === "active") {
      return (
        <>
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
            <div className="app-page-center">
              <EmptyState
                icon={<Calendar className="text-primary/60 h-12 w-12" />}
                title="No Active Shift"
                description="No shift is active right now. Check today's list or open your schedule."
                actionLabel="View Schedule"
                href="/schedule"
              />
            </div>
            {renderTodayShifts()}
          </div>
          <ShiftDetailSheet
            open={todayDetailOpen}
            onOpenChange={(open) => {
              if (!open) {
                resetTodayDetail()
              }
            }}
            detailData={todayDetailData}
            loading={todayDetailLoading}
            loadError={todayDetailError}
            assignedEmployeeNames={
              selectedTodayShift?.booth_schedule_assignments.map((assignment) =>
                getEmployeeDisplayName(assignment.employees)
              ) ?? []
            }
            operatorName={
              selectedTodayShift?.operator
                ? getEmployeeDisplayName(selectedTodayShift.operator)
                : null
            }
            canTakeOver={Boolean(
              selectedTodayShift &&
              todayDetailData.schedule &&
              getBusinessShiftState(todayDetailData.schedule, {
                inventoryReady: todayDetailData.products.length > 0,
                manuallyStarted: hasStartedOperatorPeriod(
                  todayDetailData.schedule.booth_schedule_operator_periods
                ),
              }).canManuallyStart
            )}
            takeoverPending={startingScheduleId === selectedTodayShift?.id}
            onTakeOver={
              selectedTodayShift
                ? () => {
                    void startShift(selectedTodayShift.id)
                  }
                : undefined
            }
            operatorActionLabel="Start Shift"
          />
        </>
      )
    }

    return (
      <div className="app-page-center">
        <EmptyState
          icon={<WifiOff className="text-primary/60 h-12 w-12" />}
          title="Shift Details Unavailable Offline"
          description="Reconnect once to save this shift for offline use."
          actionLabel="View Schedule"
          href="/schedule"
        />
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
        <EmptyState
          icon={<ShieldAlert className="text-primary/60 h-12 w-12" />}
          title="Shift Access Restricted"
          description="Only assigned employees can open this shift."
          actionLabel="View Schedule"
          href="/schedule"
        />
      </div>
    )
  }

  const inventoryReady = displayData.products.length > 0
  const manuallyStarted = hasStartedOperatorPeriod(
    schedule.booth_schedule_operator_periods
  )
  const shiftState = getBusinessShiftState(schedule, {
    inventoryReady,
    manuallyStarted,
  })
  const operatesPos = schedule.operator_employee_id === employeeId
  const assignedEmployeeNames = schedule.booth_schedule_assignments.map(
    (assignment) => getEmployeeDisplayName(assignment.employees)
  )
  const operatorName = schedule.operator
    ? getEmployeeDisplayName(schedule.operator)
    : null
  const canTakeOver = isAssigned && shiftState.isStartWindowOpen && !operatesPos
  const operatorActionLabel = shiftState.hasOperationalStart
    ? "Take Over POS"
    : "Start Shift"
  const canCloseShift =
    schedule.status === "scheduled" &&
    inventoryReady &&
    (employeeRole === "admin" || operatesPos) &&
    (schedule.date < shiftState.currentDate || shiftState.isStartWindowOpen)
  const canAddCashDeduction =
    schedule.status === "scheduled" && (employeeRole === "admin" || operatesPos)
  const canEditReceipts =
    schedule.status === "scheduled" && (employeeRole === "admin" || operatesPos)
  const saleActionMode =
    employeeRole === "admin" ? "direct" : operatesPos ? "request" : "none"
  const canManageInventory =
    shiftState.canManageInventory && (employeeRole === "admin" || operatesPos)

  const handleTakeover = async () => {
    setTakeoverPending(true)
    await startShift(schedule.id)
    setTakeoverPending(false)
  }

  const handleRequestReopenApproval = async () => {
    setReopenApprovalPending(true)
    const result = await requestShiftReopenApproval(schedule.id)
    setReopenApprovalPending(false)

    if (!result.ok) {
      toast.error(result.error ?? "Unable to request reopen approval.")
      return
    }

    setPendingReopenApprovalCount(1)
  }

  return (
    <>
      {renderTodayShifts()}
      <ShiftDetailView
        schedule={schedule}
        products={displayData.products}
        sales={displayData.sales}
        saleItems={displayData.saleItems}
        isFuture={shiftState.isFuture}
        assignedEmployeeNames={assignedEmployeeNames}
        operatorName={operatorName}
        availableProducts={availableProducts}
        inventoryEmployeeId={employeeId}
        canManageInventory={canManageInventory}
        preferCachedInventoryData={preferCachedData}
        onInventorySavePhaseChange={handleInventorySavePhaseChange}
        canEditReceipts={canEditReceipts}
        saleActionMode={saleActionMode}
        approvalHistory={displayData.approvalHistory ?? []}
        approvalProducts={displayData.products}
        pendingRevenueIncrease={displayData.pendingRevenueIncrease ?? 0}
        pendingRevenueDecrease={displayData.pendingRevenueDecrease ?? 0}
        onSalesChanged={() => router.refresh()}
        onAddCashDeduction={
          canAddCashDeduction
            ? () => {
                openCashDeductionSheet(schedule)
              }
            : undefined
        }
        canTakeOver={canTakeOver}
        takeoverPending={takeoverPending}
        onTakeOver={() => setConfirmTakeover(true)}
        operatorActionLabel={operatorActionLabel}
        canCloseShift={canCloseShift}
        onCloseShift={() => setCloseoutOpen(true)}
        onRequestReopenApproval={
          schedule.status === "closed" && employeeRole !== "admin"
            ? handleRequestReopenApproval
            : undefined
        }
        requestReopenApprovalPending={reopenApprovalPending}
        pendingReopenApprovalCount={pendingReopenApprovalCount}
      />
      <ShiftCloseoutSheet
        open={closeoutOpen}
        onOpenChange={setCloseoutOpen}
        schedule={schedule}
        products={displayData.products}
        sales={displayData.sales}
        approvalHistory={displayData.approvalHistory ?? []}
        onSaved={() => undefined}
      />
      {cashDeductionTarget ? (
        <CashDeductionSheet
          open={cashDeductionOpen}
          onOpenChange={(open) => {
            setCashDeductionOpen(open)
            if (!open) {
              if (cashDeductionTarget.id === selectedTodayShift?.id) {
                setTodayDetailOpen(true)
              }
              setCashDeductionTarget(null)
            }
          }}
          schedule={cashDeductionTarget}
          onSaved={() => {
            if (cashDeductionTarget.id === selectedTodayShift?.id) {
              setTodayDetailLoading(true)
              setTodayDetailError(null)
              void loadTodayShiftDetail(selectedTodayShift)
              return
            }

            router.refresh()
          }}
        />
      ) : null}
      <ConfirmDialog
        open={confirmTakeover}
        onOpenChange={setConfirmTakeover}
        title={
          operatorActionLabel === "Start Shift"
            ? "Start this shift?"
            : "Take over POS?"
        }
        description={
          operatorActionLabel === "Start Shift"
            ? "You will become the POS operator and can enter opening inventory for this shift."
            : "You will become the only employee able to enter sales and update inventory for this active shared shift."
        }
        confirmLabel={operatorActionLabel}
        onConfirm={handleTakeover}
      />
      <ShiftDetailSheet
        open={todayDetailOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetTodayDetail()
          }
        }}
        detailData={todayDetailData}
        loading={todayDetailLoading}
        loadError={todayDetailError}
        assignedEmployeeNames={
          selectedTodayShift?.booth_schedule_assignments.map((assignment) =>
            getEmployeeDisplayName(assignment.employees)
          ) ?? []
        }
        operatorName={
          selectedTodayShift?.operator
            ? getEmployeeDisplayName(selectedTodayShift.operator)
            : null
        }
        canTakeOver={Boolean(
          selectedTodayShift &&
          todayDetailData.schedule &&
          getBusinessShiftState(todayDetailData.schedule, {
            inventoryReady: todayDetailData.products.length > 0,
            manuallyStarted: hasStartedOperatorPeriod(
              todayDetailData.schedule.booth_schedule_operator_periods
            ),
          }).canManuallyStart
        )}
        takeoverPending={startingScheduleId === selectedTodayShift?.id}
        onTakeOver={
          selectedTodayShift
            ? () => {
                void startShift(selectedTodayShift.id)
              }
            : undefined
        }
        operatorActionLabel="Start Shift"
        saleActionMode={
          employeeRole === "admin"
            ? "direct"
            : todayDetailData.schedule?.operator_employee_id === employeeId
              ? "request"
              : "none"
        }
        approvalHistory={todayDetailData.approvalHistory ?? []}
        approvalProducts={todayDetailData.products}
        pendingRevenueIncrease={todayDetailData.pendingRevenueIncrease ?? 0}
        pendingRevenueDecrease={todayDetailData.pendingRevenueDecrease ?? 0}
        onSalesChanged={() => {
          if (selectedTodayShift) {
            setTodayDetailLoading(true)
            setTodayDetailError(null)
            void loadTodayShiftDetail(selectedTodayShift)
          }
        }}
        onAddCashDeduction={
          todayDetailData.schedule?.status === "scheduled" &&
          (employeeRole === "admin" ||
            todayDetailData.schedule?.operator_employee_id === employeeId)
            ? () => {
                if (todayDetailData.schedule) {
                  setTodayDetailOpen(false)
                  openCashDeductionSheet(todayDetailData.schedule)
                }
              }
            : undefined
        }
      />
    </>
  )
}
