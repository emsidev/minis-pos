import { NextResponse } from "next/server"

import { isSupabaseConfigured } from "@/lib/env"
import {
  clearPasswordRecoveryCookie,
  writePasswordRecoveryCookie,
} from "@/lib/passwordRecovery"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { buildForgotPasswordUrl, buildResetPasswordUrl } from "@/lib/utils"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const origin = requestUrl.origin

  if (!isSupabaseConfigured) {
    const response = NextResponse.redirect(
      buildForgotPasswordUrl(origin, { error: "config" })
    )
    clearPasswordRecoveryCookie(response.cookies)
    return response
  }

  const code = requestUrl.searchParams.get("code")

  if (!code) {
    const response = NextResponse.redirect(
      buildForgotPasswordUrl(origin, { error: "recovery-expired" })
    )
    clearPasswordRecoveryCookie(response.cookies)
    return response
  }

  const supabase = await createServerSupabaseClient()
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    const response = NextResponse.redirect(
      buildForgotPasswordUrl(origin, { error: "recovery-expired" })
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
      buildForgotPasswordUrl(origin, { error: "recovery-expired" })
    )
    clearPasswordRecoveryCookie(response.cookies)
    return response
  }

  const response = NextResponse.redirect(buildResetPasswordUrl(origin))
  writePasswordRecoveryCookie(response.cookies)
  return response
}
