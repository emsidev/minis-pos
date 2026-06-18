import { getBusinessDate } from "@/lib/utils"

export function getBusinessMonthStart() {
  const [year, month] = getBusinessDate().split("-").map(Number)
  return new Date(year, month - 1, 1)
}

export function formatCalendarDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function getCalendarMonth(currentDate: Date) {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const leadingDays = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  return {
    year,
    month,
    label: new Intl.DateTimeFormat("en-PH", { month: "long" }).format(
      currentDate
    ),
    leadingDays,
    days: Array.from({ length: daysInMonth }, (_, index) => index + 1),
  }
}
