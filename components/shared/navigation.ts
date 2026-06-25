import type { LucideIcon } from "lucide-react"
import {
  ClipboardCheck,
  Calendar,
  CircleDot,
  HandCoins,
  LayoutDashboard,
  Receipt,
  Settings,
  Store,
  Users,
} from "lucide-react"

export type AppRole = "admin" | "employee"

export type AppNavItem = {
  href: string
  label: string
  icon: LucideIcon
  enabled: boolean
  comingSoon?: boolean
}

const adminNavItems: AppNavItem[] = [
  {
    href: "/admin/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    enabled: true,
  },
  { href: "/", label: "Counter", icon: HandCoins, enabled: true },
  { href: "/shift", label: "Active Shift", icon: Store, enabled: true },
  {
    href: "/admin/products",
    label: "Products",
    icon: CircleDot,
    enabled: true,
  },
  { href: "/admin/booths", label: "Booths", icon: Store, enabled: true },
  {
    href: "/admin/approvals",
    label: "Approvals",
    icon: ClipboardCheck,
    enabled: true,
  },
  { href: "/admin/employees", label: "Employees", icon: Users, enabled: true },
  { href: "/admin/sales", label: "Sales", icon: Receipt, enabled: true },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    enabled: false,
    comingSoon: true,
  },
]

const employeeNavItems: AppNavItem[] = [
  { href: "/", label: "Counter", icon: HandCoins, enabled: true },
  { href: "/shift", label: "Active Shift", icon: Store, enabled: true },
  { href: "/schedule", label: "Schedule", icon: Calendar, enabled: true },
  {
    href: "/sales",
    label: "Sales",
    icon: Receipt,
    enabled: false,
    comingSoon: true,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    enabled: false,
    comingSoon: true,
  },
]

export function getNavigationItems(role: AppRole) {
  return role === "admin" ? adminNavItems : employeeNavItems
}
