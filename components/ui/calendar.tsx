"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const mergedClassNames = {
    months: "flex flex-col gap-3 sm:flex-row",
    month: "flex flex-col gap-3",
    month_caption: "relative flex items-center justify-center pt-1",
    caption_label: "text-sm font-medium",
    nav: "flex items-center gap-1",
    button_previous: cn(
      buttonVariants({ variant: "outline", size: "icon-xs" }),
      "absolute left-1 top-1 size-7"
    ),
    button_next: cn(
      buttonVariants({ variant: "outline", size: "icon-xs" }),
      "absolute right-1 top-1 size-7"
    ),
    month_grid: "w-full border-collapse space-y-1",
    weekdays: "flex",
    weekday: "w-9 text-center text-[0.78rem] font-medium text-muted-foreground",
    week: "mt-1 flex w-full",
    day: "relative h-9 w-9 p-0 text-center text-sm [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-range-start)]:rounded-l-md [&:has([aria-selected])]:bg-primary/10 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md",
    day_button: cn(
      buttonVariants({ variant: "ghost", size: "icon-xs" }),
      "size-9 rounded-md p-0 font-normal aria-selected:opacity-100"
    ),
    range_start: "day-range-start",
    range_end: "day-range-end",
    selected:
      "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
    today: "bg-accent text-accent-foreground",
    outside:
      "day-outside text-muted-foreground opacity-40 aria-selected:bg-primary/10 aria-selected:text-muted-foreground",
    disabled: "text-muted-foreground opacity-40",
    range_middle: "aria-selected:bg-primary/10 aria-selected:text-foreground",
    hidden: "invisible",
    ...classNames,
  } as CalendarProps["classNames"]

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-2", className)}
      classNames={mergedClassNames}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          ),
      }}
      timeZone="Asia/Manila"
      noonSafe
      {...props}
    />
  )
}

export { Calendar }
