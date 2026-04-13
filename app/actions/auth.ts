"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { isSupabaseConfigured } from "@/lib/env"
import { createServerSupabaseClient } from "@/lib/supabase-server"

function buildLoginRedirect(params: Record<string, string>) {
  const query = new URLSearchParams(params)

  return `/login?${query.toString()}`
}

function getRequestOrigin() {
  const headerList = headers()
  const forwardedHost = headerList.get("x-forwarded-host")
  const host = forwardedHost ?? headerList.get("host")
  const protocol =
    headerList.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https")

  return host ? `${protocol}://${host}` : "http://localhost:3000"
}

export async function requestMagicLinkAction(formData: FormData) {
  if (!isSupabaseConfigured) {
    redirect(buildLoginRedirect({ error: "config" }))
  }

  const emailValue = formData.get("email")
  const email = typeof emailValue === "string" ? emailValue.trim() : ""

  if (!email) {
    redirect(buildLoginRedirect({ error: "Please enter an email address." }))
  }

  const supabase = createServerSupabaseClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${getRequestOrigin()}/auth/callback`,
    },
  })

  if (error) {
    redirect(buildLoginRedirect({ error: error.message }))
  }

  redirect(buildLoginRedirect({ email, sent: "1" }))
}

export async function signOutAction() {
  if (isSupabaseConfigured) {
    const supabase = createServerSupabaseClient()

    await supabase.auth.signOut()
  }

  redirect("/login")
}
