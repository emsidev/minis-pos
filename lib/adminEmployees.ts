import { createServerSupabaseClient } from "@/lib/supabase-server"
import type { Database } from "@/lib/database.types"
import type { EmployeeRole } from "@/lib/domain-types"
import type { EmployeeApprovalFields } from "@/lib/employeeApproval"

export type AdminEmployeeRecord =
  Database["public"]["Tables"]["employees"]["Row"] & EmployeeApprovalFields

export async function getAdminEmployees() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .order("approval_status", { ascending: false })
    .order("is_active", { ascending: false })
    .order("name")

  if (error) {
    throw new Error(error.message)
  }

  return data as AdminEmployeeRecord[]
}

export function isEmployeeRole(value: string): value is EmployeeRole {
  return value === "admin" || value === "employee"
}
