import { AdminEmployeesClient } from "@/components/admin/AdminEmployeesClient"
import { isMagicLinkAuthEnabled } from "@/lib/env"
import { getAdminEmployees } from "@/lib/adminEmployees"

export default async function AdminEmployeesPage() {
  const employees = await getAdminEmployees()
  const magicLinkEnabled = isMagicLinkAuthEnabled()

  return (
    <AdminEmployeesClient
      employees={employees}
      magicLinkEnabled={magicLinkEnabled}
    />
  )
}
