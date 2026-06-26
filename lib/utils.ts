import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function createClientId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID()
  }

  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))

    return [
      hex.slice(0, 4).join(""),
      hex.slice(4, 6).join(""),
      hex.slice(6, 8).join(""),
      hex.slice(8, 10).join(""),
      hex.slice(10, 16).join(""),
    ].join("-")
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16)
    const value = char === "x" ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

/**
 * Formats a number as Philippine Peso (PHP).
 */
export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount)
}

/**
 * Derives a display name from an email address.
 * Example: "john.doe@example.com" -> "John Doe"
 */
export function deriveNameFromEmail(email: string) {
  const [localPart] = email.split("@")

  return localPart
    .split(/[.\-_]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

/**
 * Constructs an absolute app URL with optional query parameters.
 */
export function buildAppUrl(
  origin: string,
  pathname: string,
  params: Record<string, string> = {}
) {
  const url = new URL(pathname, origin)

  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value)
  })

  return url.toString()
}

/**
 * Constructs a login URL with optional parameters.
 */
export function buildLoginUrl(
  origin: string,
  params: Record<string, string> = {}
) {
  return buildAppUrl(origin, "/login", params)
}

export function buildForgotPasswordUrl(
  origin: string,
  params: Record<string, string> = {}
) {
  return buildAppUrl(origin, "/forgot-password", params)
}

export function buildResetPasswordUrl(
  origin: string,
  params: Record<string, string> = {}
) {
  return buildAppUrl(origin, "/reset-password", params)
}

/**
 * Gets the current date string in YYYY-MM-DD format for the business timezone (Asia/Manila).
 */
export function getBusinessDate(date: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

/**
 * Gets the current time string in HH:mm:ss format for the business timezone (Asia/Manila).
 */
export function getBusinessTime(date: Date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date)
}

type BusinessShiftLike = {
  date: string
  start_time: string
  end_time: string
  status: string | null
}

type ShiftStateOptions = {
  inventoryReady?: boolean
  manuallyStarted?: boolean
  now?: Date
}

type BoothLike = {
  name?: string | null
  location_text?: string | null
}

type EmployeeLike = {
  name?: string | null
  email?: string | null
}

type ProductLike = {
  name?: string | null
}

export function hasStartedOperatorPeriod(
  periods: Array<{ starts_at: string; ends_at: string | null }>,
  now: Date = new Date()
) {
  const currentTime = now.getTime()
  return periods.some(
    (period) =>
      period.ends_at === null &&
      new Date(period.starts_at).getTime() <= currentTime
  )
}

export function hasBusinessShiftStarted(
  date: string,
  startTime: string,
  now: Date = new Date()
) {
  const currentDate = getBusinessDate(now)
  const currentTime = getBusinessTime(now)

  return (
    date < currentDate || (date === currentDate && startTime <= currentTime)
  )
}

export function getBusinessShiftState(
  schedule: BusinessShiftLike,
  {
    inventoryReady = false,
    manuallyStarted = false,
    now = new Date(),
  }: ShiftStateOptions = {}
) {
  const currentDate = getBusinessDate(now)
  const currentTime = getBusinessTime(now)
  const isStartWindowOpen =
    schedule.status === "scheduled" &&
    schedule.date === currentDate &&
    schedule.end_time > currentTime
  const isClockActive =
    schedule.status === "scheduled" &&
    schedule.date === currentDate &&
    schedule.start_time <= currentTime &&
    schedule.end_time > currentTime
  const hasOperationalStart = inventoryReady || manuallyStarted

  return {
    currentDate,
    currentTime,
    isStartWindowOpen,
    isClockActive,
    hasOperationalStart,
    isOperational: isStartWindowOpen && (isClockActive || hasOperationalStart),
    canManuallyStart: isStartWindowOpen && !hasOperationalStart,
    canManageInventory: isStartWindowOpen,
    canRecordSales: isStartWindowOpen && inventoryReady,
    isFuture:
      schedule.status === "scheduled" &&
      !hasOperationalStart &&
      !hasBusinessShiftStarted(schedule.date, schedule.start_time, now),
  }
}

export function isCurrentBusinessShift(
  date: string,
  startTime: string,
  endTime: string,
  now: Date = new Date()
) {
  const currentDate = getBusinessDate(now)
  const currentTime = getBusinessTime(now)

  return (
    date === currentDate && startTime <= currentTime && endTime > currentTime
  )
}

export function hasBusinessShiftPassed(
  date: string,
  endTime: string,
  now: Date = new Date()
) {
  const currentDate = getBusinessDate(now)
  const currentTime = getBusinessTime(now)

  return date < currentDate || (date === currentDate && endTime <= currentTime)
}

export function getBoothDisplayName(booth?: BoothLike | null) {
  return booth?.name?.trim() || booth?.location_text?.trim() || "Unnamed booth"
}

export function getEmployeeDisplayName(employee?: EmployeeLike | null) {
  return employee?.name?.trim() || employee?.email?.trim() || "Unknown employee"
}

export function getProductDisplayName(product?: ProductLike | null) {
  return product?.name?.trim() || "Unknown product"
}
