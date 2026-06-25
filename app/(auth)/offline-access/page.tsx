import Link from "next/link"
import { WifiOff, ShieldAlert, RefreshCcw } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { publicEnv } from "@/lib/env"
import { cn } from "@/lib/utils"

type OfflineAccessPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function readQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function getReasonContent(reason: string | undefined) {
  if (reason === "admin-online-required") {
    return {
      title: "Admin access needs internet",
      description: "Reconnect to verify this admin session.",
      hint: "Then refresh or go back.",
      icon: ShieldAlert,
    }
  }

  return {
    title: "Offline setup not ready",
    description: "This device still needs a first online sync.",
    hint: "Reconnect once to finish offline setup.",
    icon: WifiOff,
  }
}

export default async function OfflineAccessPage({
  searchParams,
}: OfflineAccessPageProps) {
  const resolvedSearchParams = await searchParams
  const reason = readQueryValue(resolvedSearchParams?.reason)
  const content = getReasonContent(reason)
  const Icon = content.icon

  return (
    <main className="auth-shell">
      <div className="auth-shell__body">
        <div className="auth-shell__frame">
          <div className="auth-brand">
            <h2 className="auth-brand-mark">{publicEnv.appName}</h2>
            <p className="auth-brand-caption">Offline</p>
          </div>

          <section className="auth-panel">
            <div className="auth-panel-header">
              <div className="bg-primary/10 text-primary mx-auto flex size-14 items-center justify-center rounded-full">
                <Icon className="h-7 w-7" />
              </div>
              <div>
                <h1 className="auth-panel-title">{content.title}</h1>
                <p className="auth-panel-copy">{content.description}</p>
                <p className="text-muted-foreground mt-2 text-sm font-medium">
                  {content.hint}
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/offline-access"
                className={cn(
                  buttonVariants({ variant: "default", size: "lg" }),
                  "flex-1 rounded-full px-6 font-semibold"
                )}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Try Again
              </Link>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "flex-1 rounded-full px-6 font-semibold"
                )}
              >
                Go to Login
              </Link>
            </div>
          </section>
        </div>
      </div>

      <footer className="auth-footer">{publicEnv.appName}</footer>
    </main>
  )
}
