import { NextResponse } from "next/server"

import { getHomeRouteForRole } from "@/lib/auth.shared"
import { ensureEmployeeProfile } from "@/lib/auth.server"
import {
  clearEmployeeSnapshotCookie,
  writeEmployeeSnapshotCookie,
} from "@/lib/employeeSnapshot"
import { isEmployeePendingApproval } from "@/lib/employeeApproval"
import { isSupabaseConfigured } from "@/lib/env"
import { clearPasswordRecoveryCookie } from "@/lib/passwordRecovery"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { buildLoginUrl } from "@/lib/utils"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const origin = requestUrl.origin

  if (!isSupabaseConfigured) {
    const response = NextResponse.redirect(
      buildLoginUrl(origin, { error: "config" })
    )
    clearPasswordRecoveryCookie(response.cookies)
    return response
  }

  const code = requestUrl.searchParams.get("code")

  if (!code) {
    const response = NextResponse.redirect(
      buildLoginUrl(origin, { error: "Missing authentication code." })
    )
    clearPasswordRecoveryCookie(response.cookies)
    return response
  }

  const supabase = await createServerSupabaseClient()
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    const response = NextResponse.redirect(
      buildLoginUrl(origin, { error: exchangeError.message })
    )
    clearPasswordRecoveryCookie(response.cookies)
    return response
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    const response = NextResponse.redirect(
      buildLoginUrl(origin, {
        error: userError?.message ?? "Unable to load the signed-in user.",
      })
    )
    clearPasswordRecoveryCookie(response.cookies)
    return response
  }

  const employee = await ensureEmployeeProfile(supabase, user)

  if (isEmployeePendingApproval(employee)) {
    await supabase.auth.signOut()

    const response = NextResponse.redirect(
      buildLoginUrl(origin, { error: "approval-pending" })
    )
    clearEmployeeSnapshotCookie(response.cookies)
    clearPasswordRecoveryCookie(response.cookies)
    return response
  }

  if (!employee.is_active) {
    await supabase.auth.signOut()

    const response = NextResponse.redirect(
      buildLoginUrl(origin, { error: "inactive" })
    )
    clearEmployeeSnapshotCookie(response.cookies)
    clearPasswordRecoveryCookie(response.cookies)
    return response
  }

  const response = NextResponse.redirect(
    new URL(getHomeRouteForRole(employee.role), origin)
  )
  clearPasswordRecoveryCookie(response.cookies)
  writeEmployeeSnapshotCookie(response.cookies, employee)
  return response
}
