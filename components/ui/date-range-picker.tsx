"use client"

import { useEffect, useState } from "react"
import { CalendarIcon } from "lucide-react"
import { TZDate, type DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type DateRangePickerValue = {
  startDate: string
  endDate: string
}

type DateRangePickerCommonProps = {
  disabled?: boolean
  className?: string
  minDate?: string
}

type SingleDatePickerProps = DateRangePickerCommonProps & {
  mode: "single"
  value: string
  onChange: (nextValue: string) => void
}

type RangeDatePickerProps = DateRangePickerCommonProps & {
  mode?: "range"
  value: DateRangePickerValue
  onChange: (nextValue: DateRangePickerValue) => void
}

type DateRangePickerProps = SingleDatePickerProps | RangeDatePickerProps

const BUSINESS_TIME_ZONE = "Asia/Manila"

const dateLabelFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeZone: BUSINESS_TIME_ZONE,
})

const rangeStartFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  timeZone: BUSINESS_TIME_ZONE,
})

const rangeEndFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: BUSINESS_TIME_ZONE,
})

const ymdFormatter = new Intl.DateTimeFormat("en", {
  day: "2-digit",
  month: "2-digit",
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
})

function dateFromYmd(value: string) {
  const [year, month, day] = value.split("-").map(Number)

  if (!year || !month || !day) {
    return undefined
  }

  return new TZDate(year, month - 1, day, 12, BUSINESS_TIME_ZONE)
}

function dateToYmd(value: Date) {
  const parts = ymdFormatter.formatToParts(value)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value

  return `${year}-${month}-${day}`
}

function formatRangeLabel({ startDate, endDate }: DateRangePickerValue) {
  const start = dateFromYmd(startDate)
  const end = dateFromYmd(endDate)

  if (!start || !end) {
    return "Select date range"
  }

  if (startDate === endDate) {
    return rangeEndFormatter.format(start)
  }

  return `${rangeStartFormatter.format(start)} - ${rangeEndFormatter.format(end)}`
}

function rangeFromValue(value: DateRangePickerValue): DateRange {
  return {
    from: dateFromYmd(value.startDate),
    to: dateFromYmd(value.endDate),
  }
}

function rangeToValue(range: DateRange): DateRangePickerValue | null {
  if (!range.from) {
    return null
  }

  const startDate = dateToYmd(range.from)
  const endDate = dateToYmd(range.to ?? range.from)

  if (startDate <= endDate) {
    return { startDate, endDate }
  }

  return { startDate: endDate, endDate: startDate }
}

function useCompactCalendar() {
  const [isCompact, setIsCompact] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const mediaQuery = window.matchMedia("(max-width: 640px)")
    const updateCompact = (event?: MediaQueryListEvent) => {
      setIsCompact(event ? event.matches : mediaQuery.matches)
    }

    updateCompact()
    mediaQuery.addEventListener("change", updateCompact)

    return () => {
      mediaQuery.removeEventListener("change", updateCompact)
    }
  }, [])

  return isCompact
}

function SingleDatePicker({
  value,
  onChange,
  className,
  disabled = false,
  minDate,
}: SingleDatePickerProps) {
  const [open, setOpen] = useState(false)
  const min = minDate ? dateFromYmd(minDate) : undefined
  const selected = dateFromYmd(value)

  return (
    <Popover open={open} onOpenChange={(nextOpen) => setOpen(nextOpen)}>
      <PopoverTrigger render={<Button variant="outline" />} disabled={disabled}>
        <CalendarIcon data-icon="inline-start" />
        {selected ? dateLabelFormatter.format(selected) : "Select date"}
      </PopoverTrigger>
      <PopoverContent className={cn("w-auto p-0", className)} align="start">
        <Calendar
          mode="single"
          defaultMonth={selected}
          selected={selected}
          onSelect={(nextDate) => {
            if (!nextDate) {
              return
            }

            onChange(dateToYmd(nextDate))
            setOpen(false)
          }}
          disabled={(date) => (min ? date < min : false)}
        />
      </PopoverContent>
    </Popover>
  )
}

function RangeDatePicker({
  value,
  onChange,
  className,
  disabled = false,
  minDate,
}: RangeDatePickerProps) {
  const isCompact = useCompactCalendar()
  const [open, setOpen] = useState(false)
  const [draftRange, setDraftRange] = useState<DateRange>(() =>
    rangeFromValue(value)
  )
  const min = minDate ? dateFromYmd(minDate) : undefined
  const rangeValue = value as DateRangePickerValue
  const appliedRange = rangeFromValue(rangeValue)
  const draftValue = rangeToValue(draftRange)

  useEffect(() => {
    if (open) {
      setDraftRange(rangeFromValue(value))
    }
  }, [open, value])

  const handleApply = () => {
    if (!draftValue) {
      return
    }

    onChange(draftValue)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={(nextOpen) => setOpen(nextOpen)}>
      <PopoverTrigger render={<Button variant="outline" />} disabled={disabled}>
        <CalendarIcon data-icon="inline-start" />
        {formatRangeLabel(rangeValue)}
      </PopoverTrigger>
      <PopoverContent
        className={cn("w-[calc(100vw-1rem)] p-0 sm:w-auto", className)}
        align="start"
      >
        <Calendar
          mode="range"
          defaultMonth={appliedRange.from}
          numberOfMonths={isCompact ? 1 : 2}
          selected={draftRange.from ? draftRange : undefined}
          onSelect={(nextRange) =>
            setDraftRange(nextRange ?? { from: undefined })
          }
          disabled={(date) => (min ? date < min : false)}
        />
        <div className="border-border flex flex-col gap-2 border-t p-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground truncate text-xs">
            {draftValue ? formatRangeLabel(draftValue) : "Select date range"}
          </p>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="w-full sm:w-auto"
              disabled={!draftValue}
              onClick={handleApply}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function DateRangePicker(props: DateRangePickerProps) {
  if (props.mode === "single") {
    return <SingleDatePicker {...props} />
  }

  return <RangeDatePicker {...props} />
}

export { DateRangePicker }
