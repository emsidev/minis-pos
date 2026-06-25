import { AdminEmployeesClient } from "@/components/admin/AdminEmployeesClient"
import { getAdminEmployees } from "@/lib/adminEmployees"

export default async function AdminEmployeesPage() {
  const employees = await getAdminEmployees()

  return <AdminEmployeesClient employees={employees} />
}
