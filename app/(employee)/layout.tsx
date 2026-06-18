import type { ReactNode } from "react"

import { AppShell } from "@/components/shared/AppShell"
import { requireEmployeeRole } from "@/lib/auth"

export default async function EmployeeLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  const { employee } = await requireEmployeeRole(["employee", "admin"])

  return (
    <AppShell
      role={employee.role === "admin" ? "admin" : "employee"}
      userName={employee.name}
      employeeId={employee.id}
    >
      {children}
    </AppShell>
  )
}
