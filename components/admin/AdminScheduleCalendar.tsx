"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Clock, Store } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { loadAdminScheduleCalendarItems } from "@/app/actions/adminBooths"
import type {
  AdminSchedule,
  AdminScheduleCalendarItem,
} from "@/lib/adminBooths"
import {
  formatCalendarDate,
  getBusinessMonthStart,
  getCalendarMonth,
} from "@/lib/calendar"
import { cn, getBusinessDate } from "@/lib/utils"

type AdminScheduleCalendarProps = {
  schedules: AdminScheduleCalendarItem[]
  boothId?: string
  boothDetailMode?: boolean
  loadMonths?: boolean
  onSelectSchedule?: (scheduleId: string) => void
}

function getScheduleCardClassName(status: AdminSchedule["status"]) {
  if (status === "cancelled") {
    return "border-destructive/20 text-muted-foreground"
  }

  if (status === "closed") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-900"
  }

  return "border-primary/15 text-foreground"
}

export function AdminScheduleCalendar({
  schedules,
  boothId,
  boothDetailMode = false,
  loadMonths = false,
  onSelectSchedule,
}: AdminScheduleCalendarProps) {
  const [currentDate, setCurrentDate] = useState(getBusinessMonthStart)
  const [visibleSchedules, setVisibleSchedules] = useState(schedules)
  const [isLoadingMonth, startMonthTransition] = useTransition()

  useEffect(() => {
    if (!loadMonths) {
      setVisibleSchedules(schedules)
      return
    }

    const businessMonth = getBusinessMonthStart()
    if (
      businessMonth.getFullYear() === currentDate.getFullYear() &&
      businessMonth.getMonth() === currentDate.getMonth()
    ) {
      setVisibleSchedules(schedules)
    }
  }, [currentDate, loadMonths, schedules])
  const {
    days,
    label: monthName,
    leadingDays,
    month,
    year,
  } = getCalendarMonth(currentDate)
  const businessDate = getBusinessDate()

  const schedulesForDay = (day: number) => {
    const date = formatCalendarDate(year, month, day)
    return visibleSchedules.filter((schedule) => schedule.date === date)
  }

  const changeMonth = (nextDate: Date) => {
    setCurrentDate(nextDate)

    if (!loadMonths) {
      return
    }

    startMonthTransition(async () => {
      const nextYear = nextDate.getFullYear()
      const nextMonth = nextDate.getMonth()
      const startDate = formatCalendarDate(nextYear, nextMonth, 1)
      const endDate = formatCalendarDate(
        nextYear,
        nextMonth,
        new Date(nextYear, nextMonth + 1, 0).getDate()
      )

      try {
        const rows = await loadAdminScheduleCalendarItems(
          startDate,
          endDate,
          boothId
        )
        setVisibleSchedules(rows)
      } catch (error) {
        console.error("Unable to load schedule month:", error)
        setVisibleSchedules([])
      }
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="app-kicker">Schedule Calendar</p>
          <h2 className="app-section-title">
            {monthName}{" "}
            <span className="font-normal text-muted-foreground">{year}</span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label="Previous month"
            disabled={isLoadingMonth}
            onClick={() => changeMonth(new Date(year, month - 1, 1))}
          >
            <ChevronLeft data-icon="inline-start" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label="Next month"
            disabled={isLoadingMonth}
            onClick={() => changeMonth(new Date(year, month + 1, 1))}
          >
            <ChevronRight data-icon="inline-start" />
          </Button>
        </div>
      </header>

      <div className="bg-border/60 grid grid-cols-7 gap-px overflow-hidden rounded-[calc(var(--radius)+0.2rem)] border border-border">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="bg-muted px-2 py-3 text-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
        {Array.from({ length: leadingDays }, (_, index) => (
          <div
            key={`empty-${index}`}
            className="bg-background/40 min-h-24 sm:min-h-32"
          />
        ))}
        {days.map((day) => {
          const date = formatCalendarDate(year, month, day)
          const daySchedules = schedulesForDay(day)

          return (
            <div
              key={date}
              className={cn(
                "min-h-24 bg-card p-1.5 sm:min-h-32 sm:p-2",
                date === businessDate && "bg-primary/5"
              )}
            >
              <span
                className={cn(
                  "mb-1 flex size-7 items-center justify-center rounded-full text-xs font-medium",
                  date === businessDate && "bg-primary text-primary-foreground"
                )}
              >
                {day}
              </span>
              <div className="flex flex-col gap-1">
                {daySchedules.map((schedule) =>
                  boothDetailMode && onSelectSchedule ? (
                    <button
                      key={schedule.id}
                      type="button"
                      onClick={() => onSelectSchedule(schedule.id)}
                      className={cn(
                        "focus-visible:ring-3 focus-visible:ring-ring/50 w-full rounded-lg border bg-background px-1.5 py-1 text-left text-[0.62rem] transition-colors hover:bg-muted focus-visible:outline-none sm:text-xs",
                        getScheduleCardClassName(schedule.status)
                      )}
                    >
                      <span className="flex items-center gap-1 font-medium">
                        <Clock className="size-3 shrink-0 text-primary" />
                        <span className="truncate">
                          {schedule.operator?.name ?? "Employee"}
                        </span>
                      </span>
                      <span className="block truncate text-muted-foreground">
                        {schedule.start_time.slice(0, 5)} -{" "}
                        {schedule.end_time.slice(0, 5)}
                      </span>
                      {schedule.status === "cancelled" ? (
                        <Badge
                          variant="destructive"
                          className="mt-1 min-h-5 px-1.5 py-0 text-[0.55rem] uppercase"
                        >
                          Cancelled
                        </Badge>
                      ) : schedule.status === "closed" ? (
                        <Badge
                          variant="outline"
                          className="mt-1 min-h-5 border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0 text-[0.55rem] uppercase text-emerald-700"
                        >
                          Closed
                        </Badge>
                      ) : null}
                    </button>
                  ) : (
                    <Link
                      key={schedule.id}
                      href={`/admin/booths/${schedule.booth_id}`}
                      className={cn(
                        "rounded-lg border bg-background px-1.5 py-1 text-[0.62rem] transition-colors hover:bg-muted sm:text-xs",
                        getScheduleCardClassName(schedule.status)
                      )}
                    >
                      <span className="flex items-center gap-1 font-medium">
                        {boothDetailMode ? (
                          <Clock className="size-3 shrink-0 text-primary" />
                        ) : (
                          <Store className="size-3 shrink-0 text-primary" />
                        )}
                        <span className="truncate">
                          {boothDetailMode
                            ? (schedule.operator?.name ?? "Employee")
                            : schedule.booths.name}
                        </span>
                      </span>
                      <span className="block truncate text-muted-foreground">
                        {schedule.start_time.slice(0, 5)} -{" "}
                        {schedule.end_time.slice(0, 5)}
                      </span>
                      {schedule.status === "cancelled" ? (
                        <Badge
                          variant="destructive"
                          className="mt-1 min-h-5 px-1.5 py-0 text-[0.55rem] uppercase"
                        >
                          Cancelled
                        </Badge>
                      ) : schedule.status === "closed" ? (
                        <Badge
                          variant="outline"
                          className="mt-1 min-h-5 border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0 text-[0.55rem] uppercase text-emerald-700"
                        >
                          Closed
                        </Badge>
                      ) : null}
                    </Link>
                  )
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
