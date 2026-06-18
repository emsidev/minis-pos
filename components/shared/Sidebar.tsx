"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import {
  getNavigationItems,
  type AppNavItem,
  type AppRole,
} from "@/components/shared/navigation"

type SidebarProps = {
  role: AppRole
  className?: string
  onNavigate?: () => void
}

function isActiveItem(pathname: string, item: AppNavItem) {
  if (!item.enabled) {
    return false
  }

  return (
    pathname === item.href ||
    (item.href !== "/" && pathname.startsWith(item.href))
  )
}

export function Sidebar({ role, className, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const items = getNavigationItems(role)

  return (
    <div
      className={cn(
        "app-panel flex h-full min-h-0 flex-col overflow-hidden p-3 sm:p-4",
        className
      )}
    >
      <nav className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {items.map((item) => {
          const active = isActiveItem(pathname, item)
          const Icon = item.icon
          const sharedClasses =
            "flex min-h-12 items-center justify-between gap-3 rounded-[calc(var(--radius)-0.2rem)] px-3.5 py-3 text-sm transition-colors"

          if (item.enabled) {
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                onClick={onNavigate}
                className={cn(
                  sharedClasses,
                  active
                    ? "bg-primary text-primary-foreground shadow-[0_18px_35px_-24px_rgba(224,64,160,0.85)]"
                    : "hover:bg-muted/80 text-foreground hover:text-primary"
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
                      active
                        ? "border-primary-foreground/15 bg-primary-foreground/12 text-primary-foreground"
                        : "border-border/80 bg-background/80 text-primary"
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="truncate font-medium">{item.label}</span>
                </div>
              </Link>
            )
          }

          return (
            <div
              key={item.href}
              aria-disabled="true"
              className={cn(
                sharedClasses,
                "border-border/70 bg-muted/45 cursor-not-allowed border border-dashed text-muted-foreground"
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="border-border/70 bg-background/70 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-muted-foreground">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="truncate font-medium">{item.label}</span>
              </div>
              {item.comingSoon ? (
                <Badge
                  variant="outline"
                  className="border-border/70 bg-background/85 rounded-full px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.18em]"
                >
                  Soon
                </Badge>
              ) : null}
            </div>
          )
        })}
      </nav>
    </div>
  )
}
