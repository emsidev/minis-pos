import { AdminApprovalsClient } from "@/components/admin/AdminApprovalsClient"
import { getAdminPendingShiftApprovals } from "@/lib/shiftApprovals"

export default async function AdminApprovalsPage() {
  const data = await getAdminPendingShiftApprovals()

  return <AdminApprovalsClient data={data} />
}
