import type { ReactNode } from "react"

import { AppShell } from "@/components/shared/AppShell"
import { requireEmployeeRole } from "@/lib/auth"

const employeeNavItems = [
  { href: "/", label: "POS" },
  { href: "/sales", label: "Sales" },
  { href: "/schedule", label: "Schedule" },
]

export const dynamic = "force-dynamic"

export default async function EmployeeLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  const { employee } = await requireEmployeeRole("employee")

  return (
    <AppShell
      navItems={employeeNavItems}
      note="Milestone 1 establishes the protected employee shell. The actual cashier screen, schedule calendar, and sales history arrive in later milestones."
      sectionLabel="Employee view"
      userName={employee.name}
    >
      {children}
    </AppShell>
  )
}
