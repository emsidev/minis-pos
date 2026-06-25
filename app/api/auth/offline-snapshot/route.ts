import { NextResponse } from "next/server"

import {
  clearEmployeeSnapshotCookie,
  writeEmployeeSnapshotCookie,
} from "@/lib/employeeSnapshot"
import { isSupabaseConfigured } from "@/lib/env"
import { createServerSupabaseClient } from "@/lib/supabase-server"

function readErrorText(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause
    return [error.name, error.message, cause ? readErrorText(cause) : ""]
      .filter(Boolean)
      .join(" ")
  }

  if (typeof error === "string" || typeof error === "number") {
    return String(error)
  }

  if (typeof error !== "object" || error === null) {
    return ""
  }

  const record = error as Record<string, unknown>
  const values = [
    record.name,
    record.message,
    record.code,
    record.status,
    record.details,
    record.hint,
    record.error,
    record.error_description,
  ]
  const cause = record.cause

  return [
    ...values
      .filter(
        (value): value is string | number =>
          typeof value === "string" || typeof value === "number"
      )
      .map(String),
    cause ? readErrorText(cause) : "",
  ]
    .filter(Boolean)
    .join(" ")
}

function isConnectivityLikeError(error: unknown) {
  const text = readErrorText(error).toLowerCase()

  return [
    "failed to fetch",
    "fetch failed",
    "network",
    "offline",
    "timeout",
    "timed out",
    "connection",
    "enotfound",
    "eai_again",
    "econnrefused",
    "econnreset",
    "etimedout",
    "getaddrinfo",
  ].some((pattern) => text.includes(pattern))
}

function failureResponse(reason: string, status: number) {
  return NextResponse.json({ ok: false, reason }, { status })
}

function warnSnapshotFailure(reason: string, error: unknown) {
  const errorText = readErrorText(error)

  console.warn(
    errorText
      ? `Employee snapshot refresh skipped: ${reason} (${errorText})`
      : `Employee snapshot refresh skipped: ${reason}`
  )
}

export async function POST() {
  if (!isSupabaseConfigured) {
    return failureResponse("config", 503)
  }

  const signingKey = process.env.OFFLINE_SNAPSHOT_SIGNING_KEY?.trim()
  if (!signingKey) {
    return failureResponse("snapshot-disabled", 503)
  }

  const supabase = await createServerSupabaseClient()
  let userId: string

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      if (userError && isConnectivityLikeError(userError)) {
        warnSnapshotFailure("auth-unavailable", userError)
        return failureResponse("auth-unavailable", 503)
      }

      const response = failureResponse("unauthenticated", 401)
      clearEmployeeSnapshotCookie(response.cookies)
      return response
    }

    userId = user.id
  } catch (error) {
    warnSnapshotFailure("auth-unavailable", error)
    return failureResponse("auth-unavailable", 503)
  }

  try {
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()

    if (employeeError) {
      const reason = isConnectivityLikeError(employeeError)
        ? "profile-unavailable"
        : "profile-query-failed"

      warnSnapshotFailure(reason, employeeError)
      return failureResponse(reason, 503)
    }

    if (!employee?.is_active) {
      const response = failureResponse(
        employee ? "inactive" : "profile-missing",
        403
      )
      clearEmployeeSnapshotCookie(response.cookies)
      return response
    }

    const response = NextResponse.json({ ok: true })
    writeEmployeeSnapshotCookie(response.cookies, employee)
    return response
  } catch (error) {
    warnSnapshotFailure("profile-unavailable", error)
    return failureResponse("profile-unavailable", 503)
  }
}
