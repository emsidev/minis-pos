import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
