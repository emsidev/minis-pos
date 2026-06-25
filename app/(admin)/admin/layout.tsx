import type { ReactNode } from "react"

import { AppShell } from "@/components/shared/AppShell"
import { requireEmployeeRole } from "@/lib/auth.server"

export const dynamic = "force-dynamic"

export default async function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  const { employee } = await requireEmployeeRole("admin")

  return (
    <AppShell role="admin" userName={employee.name} employeeId={employee.id}>
      {children}
    </AppShell>
  )
}
