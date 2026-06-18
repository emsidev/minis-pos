import Link from "next/link"
import { WifiOff, ShieldAlert, RefreshCcw } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { publicEnv } from "@/lib/env"
import { cn } from "@/lib/utils"

type OfflineAccessPageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

function readQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function getReasonContent(reason: string | undefined) {
  if (reason === "admin-online-required") {
    return {
      title: "Admin Access Needs Internet",
      description:
        "This account requires an online check before opening admin-capable workspaces. Reconnect to continue.",
      hint: "Once your connection is back, refresh or revisit your previous page.",
      icon: ShieldAlert,
    }
  }

  return {
    title: "Offline Setup Not Ready Yet",
    description:
      "You are signed in, but this device has not cached enough profile data yet for offline access.",
    hint: "Reconnect once to initialize offline access for employee pages.",
    icon: WifiOff,
  }
}

export default function OfflineAccessPage({
  searchParams,
}: OfflineAccessPageProps) {
  const reason = readQueryValue(searchParams?.reason)
  const content = getReasonContent(reason)
  const Icon = content.icon

  return (
    <main className="selection:bg-primary/30 relative flex min-h-screen flex-col overflow-hidden bg-background px-4 py-12 selection:text-primary-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="bg-primary/20 absolute -left-24 -top-20 h-80 w-80 rounded-full blur-3xl"></div>
        <div className="bg-secondary/20 absolute bottom-0 right-0 h-72 w-72 rounded-full blur-3xl"></div>
      </div>

      <div className="relative mx-auto flex w-full max-w-xl flex-1 items-center">
        <section className="border-primary/10 w-full rounded-[2.25rem] border bg-card p-8 shadow-candy sm:p-10">
          <div className="bg-primary/10 mb-6 inline-flex rounded-full p-4 text-primary">
            <Icon className="h-7 w-7" />
          </div>

          <h1 className="font-heading text-3xl font-bold text-foreground">
            {content.title}
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            {content.description}
          </p>
          <p className="text-muted-foreground/90 mt-2 text-sm font-medium">
            {content.hint}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/offline-access"
              className={cn(
                buttonVariants({ variant: "default", size: "lg" }),
                "h-11 rounded-full px-6 font-semibold"
              )}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Try Again
            </Link>
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-11 rounded-full px-6 font-semibold"
              )}
            >
              Go to Login
            </Link>
          </div>
        </section>
      </div>

      <footer className="text-muted-foreground/50 relative mt-6 text-center text-[11px] uppercase tracking-[0.22em]">
        {publicEnv.appName}
      </footer>
    </main>
  )
}
