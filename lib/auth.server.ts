"use server"

import { redirect } from "next/navigation"
import { cache } from "react"
import {
  SessionContext,
  normalizeEmployeeRole,
  getHomeRouteForRole,
  EmployeeRecord,
  normalizeEmployeeEmail,
} from "./auth.shared"
import { Database } from "./database.types"
import type { EmployeeRole } from "./domain-types"
import { createServerSupabaseClient } from "./supabase-server"
import { cookies } from "next/headers"
import {
  parseEmployeeSnapshot,
  EMPLOYEE_SNAPSHOT_COOKIE,
  employeeSnapshotToRecord,
} from "./employeeSnapshot"
import { SupabaseClient, User } from "@supabase/supabase-js"
import { isSupabaseAdminConfigured } from "./env"
import { createAdminSupabaseClient } from "./supabase-admin"
import { deriveNameFromEmail } from "./utils"
import { isEmployeePendingApproval } from "./employeeApproval"

export const getCurrentSessionContext = cache(
  async (): Promise<SessionContext | null> => {
    const supabase = await createServerSupabaseClient()
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

      const snapshotEmployee = await getSnapshotForUser(session.user.id)
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
      const snapshotEmployee = await getSnapshotForUser(user.id)

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

  if (isEmployeePendingApproval(sessionContext.employee)) {
    redirect("/login?error=approval-pending")
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

async function getSnapshotForUser(
  userId: string
): Promise<EmployeeRecord | null> {
  const cookieStore = await cookies()
  const snapshot = parseEmployeeSnapshot(
    cookieStore.get(EMPLOYEE_SNAPSHOT_COOKIE)?.value
  )

  if (!snapshot || snapshot.user_id !== userId) {
    return null
  }

  return employeeSnapshotToRecord(snapshot)
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
    const claimedEmployeeUpdate = {
      user_id: user.id,
      email,
      name: invitedEmployee.name?.trim() || fallbackName,
    }

    const { data: claimedEmployee, error: claimError } = await employeeClient
      .from("employees")
      .update(claimedEmployeeUpdate)
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

  const pendingEmployeeInsert = {
    email,
    name: fallbackName,
    role: "employee" as const,
    user_id: user.id,
    is_active: false,
    approval_status: "pending" as const,
  }

  const { data: createdEmployee, error: insertError } = await employeeClient
    .from("employees")
    .insert(pendingEmployeeInsert)
    .select("*")
    .single()

  if (insertError) {
    throw new Error(insertError.message)
  }

  return createdEmployee
}
