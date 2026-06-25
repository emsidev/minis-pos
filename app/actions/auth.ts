"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { getHomeRouteForRole } from "@/lib/auth.shared"
import { ensureEmployeeProfile } from "@/lib/auth.server"
import {
  clearEmployeeSnapshotCookie,
  writeEmployeeSnapshotCookie,
} from "@/lib/employeeSnapshot"
import { isSupabaseConfigured } from "@/lib/env"
import {
  clearPasswordRecoveryCookie,
  hasPasswordRecoveryCookie,
} from "@/lib/passwordRecovery"
import { getRequestOrigin } from "@/lib/server-utils"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import {
  buildForgotPasswordUrl,
  buildLoginUrl,
  buildResetPasswordUrl,
} from "@/lib/utils"
import { isEmployeePendingApproval } from "@/lib/employeeApproval"

function readRequiredFormString(formData: FormData, key: string) {
  const value = formData.get(key)

  return typeof value === "string" ? value.trim() : ""
}

export async function signInWithGoogleAction() {
  const origin = await getRequestOrigin()
  const cookieStore = await cookies()

  if (!isSupabaseConfigured) {
    redirect(buildLoginUrl(origin, { error: "config" }))
  }

  clearPasswordRecoveryCookie(cookieStore)

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  })

  if (error || !data.url) {
    redirect(
      buildLoginUrl(origin, {
        error: error?.message ?? "Unable to start Google sign-in.",
      })
    )
  }

  redirect(data.url)
}

export async function signInWithPasswordAction(formData: FormData) {
  const origin = await getRequestOrigin()
  const cookieStore = await cookies()

  if (!isSupabaseConfigured) {
    redirect(buildLoginUrl(origin, { error: "config" }))
  }

  const email = readRequiredFormString(formData, "email")
  const password = readRequiredFormString(formData, "password")

  if (!email) {
    redirect(buildLoginUrl(origin, { error: "Please enter an email address." }))
  }

  if (!password) {
    redirect(
      buildLoginUrl(origin, {
        email,
        error: "Please enter your password.",
      })
    )
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: signInError,
  } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (signInError || !user) {
    redirect(
      buildLoginUrl(origin, {
        email,
        error: signInError?.message ?? "Unable to sign in.",
      })
    )
  }

  const employee = await ensureEmployeeProfile(supabase, user)

  if (isEmployeePendingApproval(employee)) {
    await supabase.auth.signOut()
    clearEmployeeSnapshotCookie(cookieStore)
    clearPasswordRecoveryCookie(cookieStore)
    redirect(buildLoginUrl(origin, { error: "approval-pending" }))
  }

  if (!employee.is_active) {
    await supabase.auth.signOut()
    clearEmployeeSnapshotCookie(cookieStore)
    clearPasswordRecoveryCookie(cookieStore)
    redirect(buildLoginUrl(origin, { error: "inactive" }))
  }

  clearPasswordRecoveryCookie(cookieStore)
  writeEmployeeSnapshotCookie(cookieStore, employee)

  redirect(new URL(getHomeRouteForRole(employee.role), origin).toString())
}

export async function requestPasswordResetAction(formData: FormData) {
  const origin = await getRequestOrigin()
  const cookieStore = await cookies()

  if (!isSupabaseConfigured) {
    redirect(buildForgotPasswordUrl(origin, { error: "config" }))
  }

  const email = readRequiredFormString(formData, "email")

  if (!email) {
    redirect(
      buildForgotPasswordUrl(origin, {
        error: "Please enter an email address.",
      })
    )
  }

  clearPasswordRecoveryCookie(cookieStore)

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/recovery`,
  })

  if (error) {
    redirect(
      buildForgotPasswordUrl(origin, {
        email,
        error: error.message,
      })
    )
  }

  redirect(buildForgotPasswordUrl(origin, { email, sent: "1" }))
}

export async function updatePasswordAction(formData: FormData) {
  const origin = await getRequestOrigin()
  const cookieStore = await cookies()

  if (!isSupabaseConfigured) {
    redirect(buildResetPasswordUrl(origin, { error: "config" }))
  }

  if (!hasPasswordRecoveryCookie(cookieStore)) {
    redirect(buildForgotPasswordUrl(origin, { error: "recovery-expired" }))
  }

  const password = readRequiredFormString(formData, "password")
  const confirmPassword = readRequiredFormString(formData, "confirmPassword")

  if (!password) {
    redirect(
      buildResetPasswordUrl(origin, {
        error: "Please enter a new password.",
      })
    )
  }

  if (!confirmPassword) {
    redirect(
      buildResetPasswordUrl(origin, {
        error: "Please confirm your new password.",
      })
    )
  }

  if (password !== confirmPassword) {
    redirect(
      buildResetPasswordUrl(origin, {
        error: "Passwords do not match.",
      })
    )
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    clearPasswordRecoveryCookie(cookieStore)
    redirect(buildForgotPasswordUrl(origin, { error: "recovery-expired" }))
  }

  const { error: updateError } = await supabase.auth.updateUser({ password })

  if (updateError) {
    redirect(
      buildResetPasswordUrl(origin, {
        error: updateError.message,
      })
    )
  }

  await supabase.auth.signOut()

  clearEmployeeSnapshotCookie(cookieStore)
  clearPasswordRecoveryCookie(cookieStore)

  redirect(
    buildLoginUrl(origin, {
      email: user.email?.trim() ?? "",
      passwordReset: "1",
    })
  )
}

export async function signOutAction() {
  const cookieStore = await cookies()

  if (isSupabaseConfigured) {
    const supabase = await createServerSupabaseClient()

    await supabase.auth.signOut()
  }

  clearEmployeeSnapshotCookie(cookieStore)
  clearPasswordRecoveryCookie(cookieStore)

  redirect("/login?signedOut=1")
}
