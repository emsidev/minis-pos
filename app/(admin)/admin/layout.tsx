import type { ReactNode } from "react"

import { AppShell } from "@/components/shared/AppShell"
import { requireEmployeeRole } from "@/lib/auth"

const adminNavItems = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/booths", label: "Booths" },
  { href: "/admin/employees", label: "Employees" },
]

export const dynamic = "force-dynamic"

export default async function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  const { employee } = await requireEmployeeRole("admin")

  return (
    <AppShell
      navItems={adminNavItems}
      note="Milestone 1 establishes admin-only navigation and route protection. Sales reporting and management tools will be layered into these pages later."
      sectionLabel="Admin view"
      userName={employee.name}
    >
      {children}
    </AppShell>
  )
}
