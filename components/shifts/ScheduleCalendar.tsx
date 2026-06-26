"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLiveQuery } from "dexie-react-hooks"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"

import {
  claimShiftOperator,
  getShiftDetails,
  joinSchedule,
  loadEmployeeScheduleBrowserItems,
} from "@/app/actions/shifts"
import { CashDeductionSheet } from "@/components/shifts/CashDeductionSheet"
import { AllBoothsBrowseCalendar } from "@/components/shifts/AllBoothsBrowseCalendar"
import { ShiftCloseoutSheet } from "@/components/shifts/ShiftCloseoutSheet"
import { ShiftDetailSheet } from "@/components/shifts/ShiftDetailSheet"
import { Button } from "@/components/ui/button"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import {
  formatCalendarDate,
  getBusinessMonthStart,
  getCalendarMonth,
} from "@/lib/calendar"
import {
  getCachedSchedulesForEmployee,
  getCachedShiftDetails,
} from "@/lib/offlineData"
import type {
  ScheduleBrowserItem,
  ShiftDetailData,
  SharedBoothSchedule,
} from "@/lib/shifts"
import { syncActiveShiftProducts } from "@/lib/sync"
import {
  getBusinessDate,
  getBusinessShiftState,
  hasBusinessShiftPassed,
  hasStartedOperatorPeriod,
} from "@/lib/utils"

type ScheduleCalendarProps = {
  employeeId: string
  employeeRole: string | null
  browseSchedules: ScheduleBrowserItem[]
  preferCachedData?: boolean
}

type CachedScheduleSummary = Pick<
  SharedBoothSchedule,
  | "id"
  | "booth_id"
  | "date"
  | "start_time"
  | "end_time"
  | "status"
  | "created_at"
  | "operator_employee_id"
> & {
  booths: Pick<SharedBoothSchedule["booths"], "name" | "location_text">
  booth_schedule_assignments: Array<{ employee_id: string }>
}

function monthStartFromDateString(value: string) {
  const [year, month] = value.split("-").map(Number)

  if (!year || !month) {
    return getBusinessMonthStart()
  }

  return new Date(year, month - 1, 1)
}

function getMonthKey(value: Date) {
  return `${value.getFullYear()}-${value.getMonth()}`
}

function sortScheduleBrowserItems(
  left: ScheduleBrowserItem,
  right: ScheduleBrowserItem
) {
  return (
    left.date.localeCompare(right.date) ||
    left.start_time.localeCompare(right.start_time) ||
    (left.created_at ?? "").localeCompare(right.created_at ?? "")
  )
}

function buildCachedBrowseSchedule(
  schedule: CachedScheduleSummary,
  employeeId: string
): ScheduleBrowserItem {
  const assignedToCurrentEmployee = schedule.booth_schedule_assignments.some(
    (assignment) => assignment.employee_id === employeeId
  )

  return {
    id: schedule.id,
    booth_id: schedule.booth_id,
    date: schedule.date,
    start_time: schedule.start_time,
    end_time: schedule.end_time,
    status: schedule.status,
    created_at: schedule.created_at ?? "",
    operator_employee_id: schedule.operator_employee_id,
    booth_name: schedule.booths.name,
    booth_location_text: schedule.booths.location_text,
    operator_name: schedule.operator_employee_id === employeeId ? "You" : null,
    assigned_employee_names: assignedToCurrentEmployee ? ["You"] : [],
    is_assigned: assignedToCurrentEmployee,
  }
}

function emptyShiftDetail(): ShiftDetailData {
  return {
    schedule: null,
    products: [],
    sales: [],
    saleItems: [],
  }
}

export function ScheduleCalendar({
  employeeId,
  employeeRole,
  browseSchedules,
  preferCachedData = false,
}: ScheduleCalendarProps) {
  const router = useRouter()
  const businessDate = getBusinessDate()
  const initialMonth = getBusinessMonthStart()
  const initialMonthKey = getMonthKey(initialMonth)
  const [currentMonth, setCurrentMonth] = useState(initialMonth)
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(businessDate)
  const [currentMonthSchedules, setCurrentMonthSchedules] =
    useState(browseSchedules)
  const [monthLoadError, setMonthLoadError] = useState<string | null>(null)
  const [selectedSchedule, setSelectedSchedule] =
    useState<ScheduleBrowserItem | null>(null)
  const [shiftData, setShiftData] = useState<ShiftDetailData>(emptyShiftDetail)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [closeoutOpen, setCloseoutOpen] = useState(false)
  const [cashDeductionOpen, setCashDeductionOpen] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(() =>
    typeof window === "undefined" ? true : window.navigator.onLine
  )
  const [isPending, startTransition] = useTransition()
  const [, startMonthTransition] = useTransition()
  const [isJoiningShift, startJoinTransition] = useTransition()
  const [isStartingShift, startShiftTransition] = useTransition()
  const monthRequestRef = useRef(0)
  const cachedSchedules = useLiveQuery(
    () => getCachedSchedulesForEmployee(employeeId),
    [employeeId]
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  useEffect(() => {
    if (preferCachedData || !isOnline) {
      monthRequestRef.current += 1
      return
    }

    const currentMonthKey = getMonthKey(currentMonth)
    if (currentMonthKey === initialMonthKey) {
      monthRequestRef.current += 1
      setCurrentMonthSchedules(browseSchedules)
      setMonthLoadError(null)
      return
    }

    const requestId = ++monthRequestRef.current
    const startDate = formatCalendarDate(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      1
    )
    const endDate = formatCalendarDate(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        0
      ).getDate()
    )

    setMonthLoadError(null)
    startMonthTransition(async () => {
      try {
        const nextSchedules = await loadEmployeeScheduleBrowserItems(
          startDate,
          endDate
        )
        if (monthRequestRef.current !== requestId) {
          return
        }
        setCurrentMonthSchedules(nextSchedules)
      } catch {
        if (monthRequestRef.current !== requestId) {
          return
        }
        setCurrentMonthSchedules([])
        setMonthLoadError(
          "Could not load the full calendar. Showing joined shifts instead."
        )
      }
    })
  }, [
    browseSchedules,
    currentMonth,
    initialMonthKey,
    isOnline,
    preferCachedData,
  ])

  const cachedBrowseSchedules = (cachedSchedules ?? [])
    .map((schedule) =>
      buildCachedBrowseSchedule(schedule as CachedScheduleSummary, employeeId)
    )
    .sort(sortScheduleBrowserItems)

  const usingFallbackCalendar =
    preferCachedData ||
    !isOnline ||
    (monthLoadError !== null && cachedBrowseSchedules.length > 0)
  const visibleSchedules = usingFallbackCalendar
    ? cachedBrowseSchedules
    : currentMonthSchedules
  const visibleMonthSchedules = visibleSchedules.filter((schedule) => {
    const scheduleMonth = monthStartFromDateString(schedule.date)
    return getMonthKey(scheduleMonth) === getMonthKey(currentMonth)
  })
  const { label: monthName, year } = getCalendarMonth(currentMonth)

  const openScheduleSheet = (schedule: ScheduleBrowserItem) => {
    setSelectedSchedule(schedule)
    setSelectedCalendarDate(schedule.date)
    setShiftData(emptyShiftDetail())
    setLoadError(null)
    setSheetOpen(true)

    startTransition(async () => {
      let cachedData: ShiftDetailData | null = null

      if (schedule.is_assigned) {
        const cachedShiftData = await getCachedShiftDetails(schedule.id)
        if (cachedShiftData.schedule) {
          cachedData = cachedShiftData
          setShiftData(cachedShiftData)
        }
      }

      if (!window.navigator.onLine) {
        if (!schedule.is_assigned) {
          setLoadError("Reconnect to browse full details for unjoined shifts.")
          return
        }

        if (!cachedData?.schedule) {
          setLoadError("Shift details are not available offline yet.")
        }
        return
      }

      try {
        const data = await getShiftDetails(schedule.id)
        setShiftData(data)
        if (!data.schedule) {
          setLoadError("Could not load shift details.")
        }
      } catch {
        if (!cachedData?.schedule) {
          setLoadError(
            "Could not load shift details. Try again once you reconnect."
          )
        }
      }
    })
  }

  const handleJoinSelectedSchedule = () => {
    if (!selectedSchedule) {
      return
    }

    startJoinTransition(async () => {
      const result = await joinSchedule(selectedSchedule.id)
      if (!result.ok) {
        toast.error(result.error ?? "Unable to join this shift.")
        return
      }

      const joinedSchedule = {
        ...selectedSchedule,
        is_assigned: true,
      }

      setSelectedSchedule(joinedSchedule)
      setCurrentMonthSchedules((current) =>
        current.map((schedule) =>
          schedule.id === joinedSchedule.id
            ? { ...schedule, is_assigned: true }
            : schedule
        )
      )

      try {
        const data = await getShiftDetails(joinedSchedule.id)
        setShiftData(data)
      } catch {
        toast.error("Shift joined, but the refreshed details could not load.")
      }
    })
  }

  const handleDateChange = (nextDate: string) => {
    setSelectedCalendarDate(nextDate)
    setCurrentMonth(monthStartFromDateString(nextDate))
  }

  const selectedScheduleStatus =
    shiftData.schedule?.status ?? selectedSchedule?.status
  const isAssignedToSelected = selectedSchedule?.is_assigned ?? false
  const selectedDetailSchedule = shiftData.schedule
  const selectedOperatorCanClose =
    selectedDetailSchedule?.operator_employee_id === employeeId &&
    selectedDetailSchedule.status === "scheduled" &&
    hasBusinessShiftPassed(
      selectedDetailSchedule.date,
      selectedDetailSchedule.end_time
    )
  const canJoinSelectedSchedule =
    Boolean(selectedSchedule) &&
    !isAssignedToSelected &&
    selectedScheduleStatus === "scheduled" &&
    isOnline
  const selectedShiftState =
    selectedDetailSchedule !== null
      ? getBusinessShiftState(selectedDetailSchedule, {
          inventoryReady: shiftData.products.length > 0,
          manuallyStarted: hasStartedOperatorPeriod(
            selectedDetailSchedule.booth_schedule_operator_periods
          ),
        })
      : null
  const canStartSelectedSchedule =
    selectedDetailSchedule !== null &&
    isAssignedToSelected &&
    Boolean(selectedShiftState?.canManuallyStart) &&
    isOnline
  const canManageSelectedSales =
    employeeRole === "admin" ||
    (selectedDetailSchedule?.operator_employee_id === employeeId &&
      isAssignedToSelected)
  const canAddCashDeduction =
    selectedDetailSchedule?.status === "scheduled" &&
    (employeeRole === "admin" ||
      selectedDetailSchedule?.operator_employee_id === employeeId)
  const saleActionMode =
    employeeRole === "admin"
      ? "direct"
      : canManageSelectedSales
        ? "request"
        : "none"

  const refreshSelectedDetail = async () => {
    if (!selectedSchedule || !window.navigator.onLine) {
      return
    }

    try {
      const data = await getShiftDetails(selectedSchedule.id)
      setShiftData(data)
    } catch {
      toast.error("Unable to refresh shift details.")
    }
  }

  const handleStartSelectedSchedule = () => {
    if (!selectedDetailSchedule) {
      return
    }

    startShiftTransition(async () => {
      const result = await claimShiftOperator(selectedDetailSchedule.id)
      if (!result.ok) {
        toast.error(result.error ?? "Unable to start this shift.")
        return
      }

      await syncActiveShiftProducts(employeeId)
      await refreshSelectedDetail()
      router.refresh()
    })
  }

  const handleCloseoutSaved = () => {
    if (!selectedDetailSchedule) {
      return
    }

    const scheduleId = selectedDetailSchedule.id

    setSelectedSchedule((current) =>
      current && current.id === scheduleId
        ? { ...current, status: "closed" }
        : current
    )
    setCurrentMonthSchedules((current) =>
      current.map((schedule) =>
        schedule.id === scheduleId
          ? { ...schedule, status: "closed" }
          : schedule
      )
    )
    setShiftData((current) =>
      current.schedule?.id === scheduleId
        ? {
            ...current,
            schedule: { ...current.schedule, status: "closed" },
          }
        : current
    )
    router.refresh()
  }

  return (
    <>
      <section className="app-panel space-y-4 p-3 sm:p-5">
        <header className="app-screen-header sm:items-start">
          <div className="app-screen-copy">
            <h2 className="app-screen-title">
              {monthName}{" "}
              <span className="text-muted-foreground font-medium">{year}</span>
            </h2>
            <p className="app-screen-description max-w-xl">
              Tap a shift to open it.
            </p>
          </div>

          <div className="app-screen-actions sm:justify-end">
            <DateRangePicker
              mode="single"
              value={selectedCalendarDate}
              onChange={handleDateChange}
              className="w-full sm:w-auto"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() =>
                setCurrentMonth(
                  new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth() - 1,
                    1
                  )
                )
              }
              className="rounded-full"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() =>
                setCurrentMonth(
                  new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth() + 1,
                    1
                  )
                )
              }
              className="rounded-full"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {usingFallbackCalendar ? (
          <div className="border-border text-muted-foreground rounded-[var(--radius)] border px-4 py-3 text-sm">
            {preferCachedData || !isOnline
              ? "Offline view is limited to joined shifts saved on this device."
              : monthLoadError}
          </div>
        ) : monthLoadError ? (
          <div className="border-destructive/20 bg-destructive/5 text-destructive rounded-[var(--radius)] border px-4 py-3 text-sm">
            {monthLoadError}
          </div>
        ) : null}

        <AllBoothsBrowseCalendar
          schedules={visibleSchedules}
          currentDate={currentMonth}
          selectedDate={selectedCalendarDate}
          onSelectSchedule={openScheduleSheet}
        />

        {visibleMonthSchedules.length === 0 ? (
          <div className="border-border text-muted-foreground rounded-[var(--radius)] border border-dashed px-4 py-6 text-center text-sm">
            No shifts this month.
          </div>
        ) : null}
      </section>

      <ShiftDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        detailData={shiftData}
        loading={isPending && !shiftData.schedule}
        loadError={loadError}
        assignedEmployeeNames={selectedSchedule?.assigned_employee_names ?? []}
        operatorName={selectedSchedule?.operator_name ?? null}
        readOnly={employeeRole !== "admin" && !isAssignedToSelected}
        canJoin={canJoinSelectedSchedule}
        joinPending={isJoiningShift}
        onJoin={
          canJoinSelectedSchedule ? handleJoinSelectedSchedule : undefined
        }
        canTakeOver={canStartSelectedSchedule}
        takeoverPending={isStartingShift}
        onTakeOver={
          canStartSelectedSchedule ? handleStartSelectedSchedule : undefined
        }
        operatorActionLabel="Start Shift"
        saleActionMode={saleActionMode}
        approvalHistory={shiftData.approvalHistory ?? []}
        approvalProducts={shiftData.products}
        pendingRevenueIncrease={shiftData.pendingRevenueIncrease ?? 0}
        pendingRevenueDecrease={shiftData.pendingRevenueDecrease ?? 0}
        onSalesChanged={() => {
          void refreshSelectedDetail()
        }}
        onAddCashDeduction={
          canAddCashDeduction
            ? () => {
                setSheetOpen(false)
                setCashDeductionOpen(true)
              }
            : undefined
        }
        canCloseShift={selectedOperatorCanClose}
        onCloseShift={
          selectedOperatorCanClose
            ? () => {
                setSheetOpen(false)
                setCloseoutOpen(true)
              }
            : undefined
        }
      />
      {selectedDetailSchedule ? (
        <ShiftCloseoutSheet
          open={closeoutOpen}
          onOpenChange={setCloseoutOpen}
          schedule={selectedDetailSchedule}
          products={shiftData.products}
          sales={shiftData.sales}
          approvalHistory={shiftData.approvalHistory ?? []}
          onSaved={handleCloseoutSaved}
        />
      ) : null}
      {selectedDetailSchedule ? (
        <CashDeductionSheet
          open={cashDeductionOpen}
          onOpenChange={(open) => {
            setCashDeductionOpen(open)
            if (!open) {
              setSheetOpen(true)
            }
          }}
          schedule={selectedDetailSchedule}
          onSaved={() => {
            setSheetOpen(true)
            void refreshSelectedDetail()
          }}
        />
      ) : null}
    </>
  )
}
