"use client"

import { useEffect, useState, useTransition } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Receipt,
  Store,
} from "lucide-react"

import { getEmployeeSalesHistory, getShiftDetails } from "@/app/actions/shifts"
import { EmptyState } from "@/components/shared/EmptyState"
import {
  LoadingBanner,
  ShiftDetailSkeleton,
} from "@/components/shared/LoadingSkeletons"
import { ShiftDetailView } from "@/components/shifts/ShiftDetailView"
import { SalesTable } from "@/components/shifts/SalesTable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  formatCalendarDate,
  getBusinessMonthStart,
  getCalendarMonth,
} from "@/lib/calendar"
import {
  getCachedEmployeeSalesHistoryForDate,
  getCachedSchedulesForEmployee,
  getCachedShiftDetails,
} from "@/lib/offlineData"
import type {
  BoothSchedule,
  EmployeeSalesHistoryGroup,
  Product,
  SaleWithJoins,
  SharedBoothSchedule,
} from "@/lib/shifts"
import {
  cn,
  formatCurrency,
  getBusinessDate,
  hasBusinessShiftStarted,
} from "@/lib/utils"

type ScheduleCalendarProps = {
  employeeId: string
  schedules: SharedBoothSchedule[]
  initialSalesHistoryDate: string
  initialSalesHistoryGroups: EmployeeSalesHistoryGroup[]
  preferCachedSalesHistory?: boolean
}

type ShiftDetailData = {
  schedule: SharedBoothSchedule | null
  products: Product[]
  sales: SaleWithJoins[]
}

const historyDateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "full",
  timeZone: "Asia/Manila",
})

function getScheduleCardClassName(status: SharedBoothSchedule["status"]) {
  if (status === "cancelled") {
    return "border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10"
  }

  if (status === "closed") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-900 hover:bg-emerald-500/15"
  }

  return "border-primary/10 bg-primary/5 hover:bg-primary/10"
}

function getScheduleStatusBadge(status: SharedBoothSchedule["status"]) {
  if (status === "cancelled") {
    return (
      <Badge
        variant="destructive"
        className="mt-1.5 w-fit rounded-full px-2 py-0.5 text-[0.52rem] font-semibold uppercase tracking-[0.14em]"
      >
        Cancelled
      </Badge>
    )
  }

  if (status === "closed") {
    return (
      <Badge
        variant="outline"
        className="mt-1.5 w-fit rounded-full border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-emerald-700"
      >
        Closed
      </Badge>
    )
  }

  return null
}

function monthStartFromDateString(value: string) {
  const [year, month] = value.split("-").map(Number)

  if (!year || !month) {
    return getBusinessMonthStart()
  }

  return new Date(year, month - 1, 1)
}

function dateFromYmd(value: string) {
  const [year, month, day] = value.split("-").map(Number)

  if (!year || !month || !day) {
    return null
  }

  return new Date(year, month - 1, day, 12)
}

export function ScheduleCalendar({
  employeeId,
  schedules,
  initialSalesHistoryDate,
  initialSalesHistoryGroups,
  preferCachedSalesHistory = false,
}: ScheduleCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() =>
    monthStartFromDateString(initialSalesHistoryDate)
  )
  const [sheetOpen, setSheetOpen] = useState(false)
  const [shiftData, setShiftData] = useState<ShiftDetailData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(
    initialSalesHistoryDate
  )
  const [historyGroups, setHistoryGroups] = useState(initialSalesHistoryGroups)
  const [historyResultDate, setHistoryResultDate] = useState(
    initialSalesHistoryDate
  )
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(() =>
    typeof window === "undefined" ? true : window.navigator.onLine
  )
  const [isPending, startTransition] = useTransition()
  const [isHistoryPending, startHistoryTransition] = useTransition()
  const cachedSchedules = useLiveQuery(
    () => getCachedSchedulesForEmployee(employeeId),
    [employeeId]
  )
  const cachedHistory = useLiveQuery(
    () => getCachedEmployeeSalesHistoryForDate(employeeId, selectedHistoryDate),
    [employeeId, selectedHistoryDate]
  )
  const displaySchedules =
    cachedSchedules && cachedSchedules.length > 0 ? cachedSchedules : schedules
  const shouldUseCachedHistory = !isOnline || preferCachedSalesHistory

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

  const {
    days: calendarDays,
    label: monthName,
    leadingDays,
    month,
    year,
  } = getCalendarMonth(currentDate)

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const prevMonthDays = Array.from({ length: leadingDays }, (_, index) =>
    new Date(year, month, -index).getDate()
  ).reverse()

  const getSchedulesForDay = (day: number) => {
    const dateStr = formatCalendarDate(year, month, day)
    return displaySchedules.filter((schedule) => schedule.date === dateStr)
  }

  const businessDate = getBusinessDate()
  const todaysSchedules = displaySchedules.filter(
    (schedule) => schedule.date === businessDate
  )
  const isToday = (day: number) =>
    businessDate === formatCalendarDate(year, month, day)

  const handleSelectSchedule = (scheduleId: string) => {
    setShiftData(null)
    setLoadError(null)
    setSheetOpen(true)

    startTransition(async () => {
      const cachedData = await getCachedShiftDetails(scheduleId)
      if (cachedData.schedule) {
        setShiftData(cachedData as ShiftDetailData)
      }

      if (!window.navigator.onLine) {
        if (!cachedData.schedule) {
          setLoadError("Shift details are not available offline yet.")
        }
        return
      }

      try {
        const data = await getShiftDetails(scheduleId)
        setShiftData(data as ShiftDetailData)
        if (!data.schedule) {
          setLoadError("Could not load shift details.")
        }
      } catch {
        if (!cachedData.schedule) {
          setLoadError(
            "Could not load shift details. Try again once you reconnect."
          )
        }
      }
    })
  }

  const handleHistoryDateChange = (nextDate: string) => {
    setSelectedHistoryDate(nextDate)
    setCurrentDate(monthStartFromDateString(nextDate))
    setHistoryError(null)

    if (
      preferCachedSalesHistory ||
      typeof window === "undefined" ||
      !window.navigator.onLine
    ) {
      return
    }

    startHistoryTransition(async () => {
      try {
        const groups = await getEmployeeSalesHistory(nextDate)
        setHistoryGroups(groups)
        setHistoryResultDate(nextDate)
      } catch {
        setHistoryGroups([])
        setHistoryResultDate(nextDate)
        setHistoryError(
          "Could not load sales history for this date. Try again once you reconnect."
        )
      }
    })
  }

  const isShiftFuture = (schedule: BoothSchedule) => {
    return !hasBusinessShiftStarted(schedule.date, schedule.start_time)
  }

  const displayHistory = shouldUseCachedHistory
    ? cachedHistory
    : historyResultDate === selectedHistoryDate
      ? {
          availability: "available" as const,
          groups: historyGroups,
        }
      : null
  const selectedHistoryDateValue = dateFromYmd(selectedHistoryDate)

  return (
    <>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {monthName}{" "}
              <span className="font-medium text-muted-foreground">{year}</span>
            </h2>
            <p className="text-sm text-muted-foreground">
              Your assigned booth schedules
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={prevMonth}
              className="rounded-full"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={nextMonth}
              className="rounded-full"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <section className="app-panel space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="app-kicker">Sales History</p>
              <h3 className="text-lg font-semibold tracking-tight text-foreground">
                Manual date filter
              </h3>
              <p className="text-sm text-muted-foreground">
                Pick any business date to review your assigned shift sales.
              </p>
            </div>

            <DateRangePicker
              mode="single"
              value={selectedHistoryDate}
              onChange={handleHistoryDateChange}
            />
          </div>
        </section>

        <div className="bg-border/40 grid grid-cols-7 gap-px overflow-hidden rounded-[calc(var(--radius)*1.5)] border border-border shadow-xl">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="text-muted-foreground/80 bg-surface-container-low px-2 py-3 text-center text-[0.65rem] font-bold uppercase tracking-[0.2em]"
            >
              {day}
            </div>
          ))}

          {prevMonthDays.map((day) => (
            <div
              key={`prev-${day}`}
              className="bg-background/40 min-h-[100px] p-2 opacity-30 sm:min-h-[140px]"
            >
              <span className="text-xs font-medium">{day}</span>
            </div>
          ))}

          {calendarDays.map((day) => {
            const daySchedules = getSchedulesForDay(day)
            const today = isToday(day)

            return (
              <div
                key={day}
                className={cn(
                  "hover:bg-surface-container-low/30 group relative min-h-[100px] bg-background p-2 transition-colors sm:min-h-[140px]",
                  today && "bg-primary/5"
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                      today
                        ? "shadow-primary/20 bg-primary text-primary-foreground shadow-lg"
                        : "text-foreground"
                    )}
                  >
                    {day}
                  </span>
                </div>

                <div className="mt-2 space-y-1">
                  {daySchedules.map((schedule) => (
                    <Button
                      key={schedule.id}
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSelectSchedule(schedule.id)}
                      className={cn(
                        "flex h-auto w-full items-start justify-start whitespace-normal rounded-[1.7rem] border px-2.5 py-2 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0",
                        getScheduleCardClassName(schedule.status)
                      )}
                    >
                      <div className="flex w-full items-start gap-2 overflow-hidden">
                        <Store
                          className={cn(
                            "mt-0.5 h-3.5 w-3.5 shrink-0",
                            schedule.status === "cancelled"
                              ? "text-destructive"
                              : schedule.status === "closed"
                                ? "text-emerald-700"
                                : "text-primary"
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "truncate text-[0.68rem] font-bold leading-none sm:text-[0.72rem]",
                              schedule.status === "cancelled"
                                ? "text-destructive"
                                : schedule.status === "closed"
                                  ? "text-emerald-900"
                                  : "text-primary"
                            )}
                          >
                            {schedule.booths.name}
                          </p>
                          <div
                            className={cn(
                              "mt-1 flex items-center gap-1 text-[0.58rem] leading-none sm:text-[0.64rem]",
                              schedule.status === "cancelled"
                                ? "text-destructive/70"
                                : schedule.status === "closed"
                                  ? "text-emerald-700/70"
                                  : "text-primary/60"
                            )}
                          >
                            <Clock className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">
                              {schedule.start_time.slice(0, 5)} -{" "}
                              {schedule.end_time.slice(0, 5)}
                            </span>
                          </div>
                          {getScheduleStatusBadge(schedule.status)}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="app-panel p-4 lg:hidden">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Today&apos;s Schedule
          </h3>
          {todaysSchedules.length === 0 ? (
            <p className="text-xs italic text-muted-foreground">
              No schedules for today
            </p>
          ) : (
            <div className="space-y-3">
              {todaysSchedules.map((schedule) => (
                <Button
                  key={schedule.id}
                  type="button"
                  variant="ghost"
                  onClick={() => handleSelectSchedule(schedule.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-2xl p-4 transition-colors",
                    schedule.status === "cancelled"
                      ? "bg-destructive/5 hover:bg-destructive/10"
                      : schedule.status === "closed"
                        ? "bg-emerald-500/10 hover:bg-emerald-500/15"
                        : "bg-surface-container-low hover:bg-surface-container"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full",
                        schedule.status === "cancelled"
                          ? "bg-destructive/10 text-destructive"
                          : schedule.status === "closed"
                            ? "bg-emerald-500/15 text-emerald-700"
                            : "bg-primary/10 text-primary"
                      )}
                    >
                      <Store className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                      <h4 className="font-semibold text-foreground">
                        {schedule.booths.name}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {schedule.start_time} - {schedule.end_time}
                        </span>
                      </div>
                      {schedule.status === "cancelled" ? (
                        <Badge variant="destructive" className="mt-2 uppercase">
                          Cancelled
                        </Badge>
                      ) : schedule.status === "closed" ? (
                        <Badge
                          variant="outline"
                          className="mt-2 border-emerald-500/20 bg-emerald-500/10 uppercase text-emerald-700"
                        >
                          Closed
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </Button>
              ))}
            </div>
          )}
        </div>

        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="app-kicker">Selected Date</p>
              <h3 className="text-xl font-semibold tracking-tight text-foreground">
                {selectedHistoryDateValue
                  ? historyDateFormatter.format(selectedHistoryDateValue)
                  : selectedHistoryDate}
              </h3>
            </div>
            <Badge
              variant="outline"
              className="w-fit rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em]"
            >
              <CalendarDays data-icon="inline-start" />
              {selectedHistoryDate}
            </Badge>
          </div>

          {isHistoryPending && !shouldUseCachedHistory ? (
            <LoadingBanner label="Loading sales history for the selected date..." />
          ) : null}

          {historyError ? (
            <div className="border-destructive/20 bg-destructive/5 rounded-[var(--radius)] border px-4 py-3 text-sm text-destructive">
              {historyError}
            </div>
          ) : null}

          {shouldUseCachedHistory && !cachedHistory ? (
            <LoadingBanner label="Loading cached sales history..." />
          ) : null}

          {displayHistory?.availability === "unavailable" ? (
            <EmptyState
              icon={<CalendarDays className="h-10 w-10" />}
              title="Sales History Not Cached Yet"
              description="This date falls outside the current offline warm-up window. Reconnect once to load this date's history."
            />
          ) : null}

          {displayHistory?.availability === "available" &&
          displayHistory.groups.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-10 w-10" />}
              title="No Assigned Shifts"
              description="You did not have any booth assignments on this date, so there is no sales history to review."
            />
          ) : null}

          {displayHistory?.availability === "available" &&
            displayHistory.groups.map((group) => {
              const totalRevenue = group.sales.reduce(
                (sum, sale) => sum + Number(sale.total_amount),
                0
              )

              return (
                <article
                  key={group.schedule.id}
                  className="app-panel space-y-4 p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="truncate text-lg font-semibold text-foreground">
                          {group.schedule.booths.name}
                        </h4>
                        {getScheduleStatusBadge(group.schedule.status)}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          {group.schedule.start_time.slice(0, 5)} -{" "}
                          {group.schedule.end_time.slice(0, 5)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Store className="h-3.5 w-3.5 text-primary" />
                          {group.schedule.booths.location_text || "No location"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:min-w-[14rem]">
                      <div className="bg-background/70 rounded-2xl border border-border px-3 py-2">
                        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Sales
                        </p>
                        <p className="mt-1 text-lg font-bold text-foreground">
                          {group.sales.length}
                        </p>
                      </div>
                      <div className="border-primary/15 bg-primary/5 rounded-2xl border px-3 py-2">
                        <p className="text-primary/70 text-[0.62rem] font-semibold uppercase tracking-[0.18em]">
                          Revenue
                        </p>
                        <p className="mt-1 text-lg font-bold text-primary">
                          {formatCurrency(totalRevenue)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {group.sales.length === 0 ? (
                    <div className="rounded-[var(--radius)] border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                      No completed sales were recorded for this shift.
                    </div>
                  ) : (
                    <SalesTable sales={group.sales} />
                  )}
                </article>
              )
            })}
        </section>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full max-w-2xl p-0">
          <div className="sr-only">
            <SheetTitle>Shift Details</SheetTitle>
            <SheetDescription>
              View booth assignment details, inventory, and sales for this
              shift.
            </SheetDescription>
          </div>

          {isPending && !shiftData ? (
            <ShiftDetailSkeleton />
          ) : shiftData?.schedule ? (
            <ScrollArea className="h-full">
              <ShiftDetailView
                schedule={shiftData.schedule}
                products={shiftData.products}
                sales={shiftData.sales}
                isFuture={isShiftFuture(shiftData.schedule)}
                className="p-0 pt-14"
              />
            </ScrollArea>
          ) : loadError ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
              {loadError}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Could not load shift details.
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
