import type { SupabaseClient, User } from "@supabase/supabase-js"
import { cache } from "react"
import { redirect } from "next/navigation"

import type { Database, EmployeeRole } from "@/lib/database.types"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export type EmployeeRecord = Database["public"]["Tables"]["employees"]["Row"]

export type SessionContext = {
  employee: EmployeeRecord | null
  user: User
}

function deriveNameFromEmail(email: string) {
  const [localPart] = email.split("@")

  return localPart
    .split(/[.\-_]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

export function normalizeEmployeeRole(role: string | null | undefined): EmployeeRole {
  return role === "admin" ? "admin" : "employee"
}

export function getHomeRouteForRole(role: string | null | undefined) {
  return normalizeEmployeeRole(role) === "admin" ? "/admin/dashboard" : "/"
}

export async function ensureEmployeeProfile(
  supabase: SupabaseClient<Database>,
  user: User
) {
  const { data: existingEmployee, error: employeeError } = await supabase
    .from("employees")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  if (employeeError) {
    throw new Error(employeeError.message)
  }

  if (existingEmployee) {
    return existingEmployee
  }

  const email = user.email?.trim()

  if (!email) {
    throw new Error("Authenticated users must have an email address.")
  }

  const fallbackName =
    user.user_metadata.name?.toString().trim() ||
    user.user_metadata.full_name?.toString().trim() ||
    deriveNameFromEmail(email)

  const { data: createdEmployee, error: insertError } = await supabase
    .from("employees")
    .insert({
      email,
      name: fallbackName,
      role: "employee",
      user_id: user.id,
    })
    .select("*")
    .single()

  if (insertError) {
    throw new Error(insertError.message)
  }

  return createdEmployee
}

export const getCurrentSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    throw new Error(authError.message)
  }

  if (!user) {
    return null
  }

  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  if (employeeError) {
    throw new Error(employeeError.message)
  }

  return {
    employee: employee ?? null,
    user,
  }
})

export async function requireEmployeeRole(
  allowedRoles: EmployeeRole | EmployeeRole[]
) {
  const sessionContext = await getCurrentSessionContext()

  if (!sessionContext) {
    redirect("/login")
  }

  if (!sessionContext.employee) {
    redirect("/login?error=profile-missing")
  }

  if (!sessionContext.employee.is_active) {
    redirect("/login?error=inactive")
  }

  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]
  const currentRole = normalizeEmployeeRole(sessionContext.employee.role)

  if (!roles.includes(currentRole)) {
    redirect(getHomeRouteForRole(currentRole))
  }

  return {
    employee: sessionContext.employee,
    user: sessionContext.user,
  }
}
