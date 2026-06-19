"use client"

import { Clock, Store } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { formatCalendarDate, getCalendarMonth } from "@/lib/calendar"
import type { ScheduleBrowserItem } from "@/lib/shifts"
import { cn, getBusinessDate } from "@/lib/utils"

type AllBoothsBrowseCalendarProps = {
  schedules: ScheduleBrowserItem[]
  currentDate: Date
  selectedDate: string | null
  onSelectSchedule: (schedule: ScheduleBrowserItem) => void
}

function getScheduleCardClassName(status: ScheduleBrowserItem["status"]) {
  if (status === "cancelled") {
    return "border-destructive/20 bg-destructive/5 text-destructive"
  }

  if (status === "closed") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-900"
  }

  return "border-primary/10 bg-primary/5 text-foreground"
}

export function AllBoothsBrowseCalendar({
  schedules,
  currentDate,
  selectedDate,
  onSelectSchedule,
}: AllBoothsBrowseCalendarProps) {
  const { days, leadingDays, month, year } = getCalendarMonth(currentDate)
  const businessDate = getBusinessDate()

  const schedulesForDay = (day: number) => {
    const date = formatCalendarDate(year, month, day)
    return schedules.filter((schedule) => schedule.date === date)
  }

  return (
    <div className="bg-border/60 border-border grid grid-cols-7 gap-px overflow-hidden rounded-[calc(var(--radius)+0.2rem)] border">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
        <div
          key={day}
          className="bg-muted text-muted-foreground px-2 py-3 text-center text-xs font-medium"
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
        const isToday = date === businessDate
        const isSelected = date === selectedDate

        return (
          <div
            key={date}
            className={cn(
              "bg-card min-h-24 p-1.5 sm:min-h-32 sm:p-2",
              isToday && "bg-primary/5",
              isSelected && "ring-primary/20 ring-2 ring-inset"
            )}
          >
            <span
              className={cn(
                "mb-1 flex size-7 items-center justify-center rounded-full text-xs font-medium",
                isToday && "bg-primary text-primary-foreground",
                isSelected &&
                  !isToday &&
                  "ring-primary/30 bg-surface-container text-foreground ring-2"
              )}
            >
              {day}
            </span>
            <div className="flex flex-col gap-1">
              {daySchedules.map((schedule) => (
                <button
                  key={schedule.id}
                  type="button"
                  onClick={() => onSelectSchedule(schedule)}
                  className={cn(
                    "focus-visible:ring-ring/50 hover:bg-muted w-full rounded-lg border px-1.5 py-1 text-left text-[0.62rem] transition-colors focus-visible:ring-3 focus-visible:outline-none sm:text-xs",
                    getScheduleCardClassName(schedule.status)
                  )}
                >
                  <span className="flex items-center gap-1 font-medium">
                    <Store className="text-primary size-3 shrink-0" />
                    <span className="truncate">{schedule.booth_name}</span>
                  </span>
                  <span className="text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                    <Clock className="size-3 shrink-0" />
                    {schedule.start_time.slice(0, 5)} -{" "}
                    {schedule.end_time.slice(0, 5)}
                  </span>
                  <span className="text-muted-foreground block truncate">
                    {schedule.assigned_employee_names.length > 0
                      ? schedule.assigned_employee_names.join(", ")
                      : "Open shift"}
                  </span>
                  {schedule.is_assigned ? (
                    <Badge
                      variant="secondary"
                      className="mt-1 min-h-5 px-1.5 py-0 text-[0.55rem] uppercase"
                    >
                      Joined
                    </Badge>
                  ) : schedule.status === "cancelled" ? (
                    <Badge
                      variant="destructive"
                      className="mt-1 min-h-5 px-1.5 py-0 text-[0.55rem] uppercase"
                    >
                      Cancelled
                    </Badge>
                  ) : schedule.status === "closed" ? (
                    <Badge
                      variant="outline"
                      className="mt-1 min-h-5 border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0 text-[0.55rem] text-emerald-700 uppercase"
                    >
                      Closed
                    </Badge>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
