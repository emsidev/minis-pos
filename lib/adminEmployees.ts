import { createServerSupabaseClient } from "@/lib/supabase-server"
import type { Database, EmployeeRole } from "@/lib/database.types"

export type AdminEmployeeRecord =
  Database["public"]["Tables"]["employees"]["Row"]

export async function getAdminEmployees() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from("employees")
    .select("*")
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
