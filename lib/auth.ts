import type { SupabaseClient, User } from "@supabase/supabase-js"
import { cache } from "react"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"

import type { Database, EmployeeRole } from "@/lib/database.types"
import {
  EMPLOYEE_SNAPSHOT_COOKIE,
  employeeSnapshotToRecord,
  parseEmployeeSnapshot,
} from "@/lib/employeeSnapshot"
import { isSupabaseAdminConfigured } from "@/lib/env"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { deriveNameFromEmail } from "@/lib/utils"

export type EmployeeRecord = Database["public"]["Tables"]["employees"]["Row"]

export type SessionProfileSource =
  | "live"
  | "snapshot"
  | "missing"
  | "unavailable"

export type SessionContext = {
  employee: EmployeeRecord | null
  user: User
  profileSource: SessionProfileSource
}

export function normalizeEmployeeRole(
  role: string | null | undefined
): EmployeeRole {
  return role === "admin" ? "admin" : "employee"
}

export function getHomeRouteForRole(role: string | null | undefined) {
  return normalizeEmployeeRole(role) === "admin" ? "/admin/dashboard" : "/"
}

function normalizeEmployeeEmail(email: string) {
  return email.trim().toLowerCase()
}

export async function ensureEmployeeProfile(
  supabase: SupabaseClient<Database>,
  user: User
) {
  const employeeClient = isSupabaseAdminConfigured
    ? createAdminSupabaseClient()
    : supabase

  const { data: existingEmployee, error: employeeError } = await employeeClient
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

  const email = user.email ? normalizeEmployeeEmail(user.email) : ""

  if (!email) {
    throw new Error("Authenticated users must have an email address.")
  }

  const fallbackName =
    user.user_metadata.name?.toString().trim() ||
    user.user_metadata.full_name?.toString().trim() ||
    deriveNameFromEmail(email)

  const { data: invitedEmployee, error: invitedEmployeeError } =
    await employeeClient
      .from("employees")
      .select("*")
      .ilike("email", email)
      .is("user_id", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

  if (invitedEmployeeError) {
    throw new Error(invitedEmployeeError.message)
  }

  if (invitedEmployee) {
    const { data: claimedEmployee, error: claimError } = await employeeClient
      .from("employees")
      .update({
        user_id: user.id,
        email,
        name: invitedEmployee.name?.trim() || fallbackName,
      })
      .eq("id", invitedEmployee.id)
      .is("user_id", null)
      .select("*")
      .maybeSingle()

    if (claimError) {
      throw new Error(claimError.message)
    }

    if (claimedEmployee) {
      return claimedEmployee
    }
  }

  const { data: createdEmployee, error: insertError } = await employeeClient
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

function isConnectivityLikeError(message: string) {
  const lowered = message.toLowerCase()

  return [
    "failed to fetch",
    "fetch failed",
    "network",
    "offline",
    "timeout",
    "timed out",
    "connection",
  ].some((pattern) => lowered.includes(pattern))
}

function getSnapshotForUser(userId: string): EmployeeRecord | null {
  const cookieStore = cookies()
  const snapshot = parseEmployeeSnapshot(
    cookieStore.get(EMPLOYEE_SNAPSHOT_COOKIE)?.value
  )

  if (!snapshot || snapshot.user_id !== userId) {
    return null
  }

  return employeeSnapshotToRecord(snapshot)
}

export const getCurrentSessionContext = cache(
  async (): Promise<SessionContext | null> => {
    const supabase = createServerSupabaseClient()
    const {
      data: { user: validatedUser },
      error: userError,
    } = await supabase.auth.getUser()

    const user = validatedUser

    if (userError || !user) {
      if (!userError || !isConnectivityLikeError(userError.message)) {
        return null
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        return null
      }

      const snapshotEmployee = getSnapshotForUser(session.user.id)
      if (snapshotEmployee) {
        return {
          employee: snapshotEmployee,
          user: session.user,
          profileSource: "snapshot",
        }
      }

      return {
        employee: null,
        user: session.user,
        profileSource: "unavailable",
      }
    }

    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()

    if (employeeError) {
      const snapshotEmployee = getSnapshotForUser(user.id)

      if (snapshotEmployee) {
        return {
          employee: snapshotEmployee,
          user,
          profileSource: "snapshot",
        }
      }

      if (isConnectivityLikeError(employeeError.message)) {
        return {
          employee: null,
          user,
          profileSource: "unavailable",
        }
      }

      throw new Error(employeeError.message)
    }

    return {
      employee: employee ?? null,
      user,
      profileSource: employee ? "live" : "missing",
    }
  }
)

export async function requireEmployeeRole(
  allowedRoles: EmployeeRole | EmployeeRole[]
) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]

  const sessionContext = await getCurrentSessionContext()

  if (!sessionContext) {
    redirect("/login")
  }

  if (sessionContext.profileSource === "unavailable") {
    redirect("/offline-access?reason=profile-unavailable")
  }

  if (!sessionContext.employee) {
    redirect("/login?error=profile-missing")
  }

  if (!sessionContext.employee.is_active) {
    redirect("/login?error=inactive")
  }

  const currentRole = normalizeEmployeeRole(sessionContext.employee.role)

  if (sessionContext.profileSource === "snapshot" && currentRole === "admin") {
    redirect("/offline-access?reason=admin-online-required")
  }

  if (!roles.includes(currentRole)) {
    redirect(getHomeRouteForRole(currentRole))
  }

  return {
    employee: sessionContext.employee,
    user: sessionContext.user,
    profileSource: sessionContext.profileSource,
  }
}
