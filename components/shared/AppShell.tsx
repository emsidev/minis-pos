import Link from "next/link"
import type { ReactNode } from "react"

import { AppWordmark } from "@/components/shared/AppWordmark"
import { SignOutButton } from "@/components/shared/SignOutButton"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

type NavItem = {
  href: string
  label: string
}

type AppShellProps = {
  children: ReactNode
  navItems: NavItem[]
  note?: string
  sectionLabel: string
  userName: string
}

export function AppShell({
  children,
  navItems,
  note,
  sectionLabel,
  userName,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="overflow-hidden rounded-[2rem] border border-border bg-card/95 shadow-[0_20px_60px_-32px_rgba(26,26,26,0.45)] backdrop-blur">
          <div className="flex flex-col gap-5 p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-col gap-3">
                <AppWordmark eyebrow={sectionLabel} />
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{sectionLabel}</Badge>
                  <Badge variant="outline">Signed in as {userName}</Badge>
                </div>
              </div>
              <SignOutButton />
            </div>
            <Separator />
            <nav className="flex flex-wrap gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(buttonVariants({ size: "sm", variant: "outline" }), "justify-start")}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            {note ? <p className="max-w-3xl text-sm text-muted-foreground">{note}</p> : null}
          </div>
        </header>
        <main className="grid gap-6">{children}</main>
      </div>
    </div>
  )
}
