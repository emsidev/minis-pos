import { User } from "@supabase/supabase-js"
import { Database, EmployeeRole } from "./database.types"
import type { EmployeeApprovalFields } from "./employeeApproval"

export type EmployeeRecord = Database["public"]["Tables"]["employees"]["Row"] &
  EmployeeApprovalFields

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

export function normalizeEmployeeEmail(email: string) {
  return email.trim().toLowerCase()
}
