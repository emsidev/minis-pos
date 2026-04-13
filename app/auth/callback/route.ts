import { NextResponse } from "next/server"

import { ensureEmployeeProfile, getHomeRouteForRole } from "@/lib/auth"
import { isSupabaseConfigured } from "@/lib/env"
import { createServerSupabaseClient } from "@/lib/supabase-server"

function redirectToLogin(origin: string, error: string) {
  const url = new URL("/login", origin)

  url.searchParams.set("error", error)

  return NextResponse.redirect(url)
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)

  if (!isSupabaseConfigured) {
    return redirectToLogin(requestUrl.origin, "config")
  }

  const code = requestUrl.searchParams.get("code")

  if (!code) {
    return redirectToLogin(requestUrl.origin, "Missing authentication code.")
  }

  const supabase = createServerSupabaseClient()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    return redirectToLogin(requestUrl.origin, exchangeError.message)
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return redirectToLogin(requestUrl.origin, userError?.message ?? "Unable to load the signed-in user.")
  }

  const employee = await ensureEmployeeProfile(supabase, user)

  if (!employee.is_active) {
    await supabase.auth.signOut()

    return redirectToLogin(requestUrl.origin, "inactive")
  }

  return NextResponse.redirect(new URL(getHomeRouteForRole(employee.role), requestUrl.origin))
}
