import Link from "next/link"
import { ArrowLeft, HelpCircle, Mail, ShieldAlert } from "lucide-react"

import { requestPasswordResetAction } from "@/app/actions/auth"
import { AuthSubmitButton } from "@/components/shared/AuthSubmitButton"
import { LoginFeedback } from "@/components/shared/LoginFeedback"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatAuthMessage, readQueryValue } from "@/lib/authMessages"
import {
  isMagicLinkAuthEnabled,
  isSupabaseConfigured,
  publicEnv,
} from "@/lib/env"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { cn } from "@/lib/utils"

type ForgotPasswordPageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const magicLinksEnabled = isMagicLinkAuthEnabled()
  const supabaseReady = isSupabaseConfigured
  const emailQuery = readQueryValue(searchParams?.email)
  const sent = !magicLinksEnabled && readQueryValue(searchParams?.sent) === "1"
  const error = formatAuthMessage(readQueryValue(searchParams?.error), {
    config:
      "Add your Supabase URL and anon key to .env.local before requesting a password reset.",
    "password-auth-disabled":
      "Password sign-in is not enabled for this POS setup.",
    "recovery-expired":
      "That reset link is no longer valid. Request a new one to continue.",
  })

  let sessionEmail: string | null = null

  if (supabaseReady) {
    const supabase = createServerSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    sessionEmail = session?.user.email?.trim() ?? null
  }

  const email = emailQuery ?? sessionEmail ?? ""
  const sentMessage = email
    ? `If an account exists for ${email}, check your inbox for the reset link.`
    : "If an account exists for that email, check your inbox for the reset link."

  return (
    <main className="selection:bg-primary/30 relative flex min-h-screen flex-col overflow-hidden bg-background selection:text-primary-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="bg-primary/20 absolute -left-24 -top-24 h-96 w-96 rounded-full blur-3xl"></div>
        <div className="bg-secondary/20 absolute bottom-1/4 right-0 h-64 w-64 rounded-full blur-2xl"></div>
        <div className="bg-primary/10 absolute left-1/4 top-1/2 h-32 w-32 rounded-full blur-xl"></div>
      </div>

      <div className="z-10 flex flex-grow items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <div className="mb-10 text-center">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-primary">
              {publicEnv.appName}
            </h2>
            <div className="mt-2 flex items-center justify-center gap-3">
              <span className="bg-primary/20 h-1 w-4 rounded-full"></span>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">
                Professional POS
              </span>
              <span className="bg-primary/20 h-1 w-4 rounded-full"></span>
            </div>
          </div>

          <div className="border-primary/5 relative rounded-[2.5rem] border bg-card p-10 shadow-candy md:p-12">
            <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
              <div className="rounded-full bg-primary p-4 shadow-candy ring-8 ring-background">
                <Mail className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>

            <div className="mb-10 mt-2 text-center">
              <h1 className="mb-3 font-heading text-4xl font-bold text-foreground">
                Reset your password
              </h1>
              <p className="text-lg font-medium text-muted-foreground">
                Send a recovery email to reset or set your password.
              </p>
            </div>

            <div className="space-y-6">
              <LoginFeedback
                error={error}
                sent={sent}
                email={email || null}
                sentMessage={sentMessage}
              />

              {!supabaseReady && (
                <div className="border-warning/10 bg-warning/5 rounded-2xl border px-4 py-3 text-sm text-warning">
                  Supabase is not configured yet. Set up your .env.local files.
                </div>
              )}

              <div className="border-primary/10 bg-primary/5 rounded-2xl border px-4 py-3 text-sm text-foreground">
                This page requires an internet connection to send the recovery
                email.
              </div>

              {sent && (
                <div className="border-success/10 bg-success/5 rounded-2xl border px-4 py-3 text-sm text-success">
                  {sentMessage}
                </div>
              )}

              {magicLinksEnabled ? (
                <div className="bg-muted/50 flex flex-col gap-4 rounded-2xl p-6 text-center">
                  <div className="bg-primary/10 mx-auto rounded-full p-3 text-primary">
                    <ShieldAlert className="h-6 w-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-heading text-xl font-bold">
                      Password login is off
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      This POS is currently using email magic links instead of
                      passwords.
                    </p>
                  </div>
                  <Link
                    href="/login"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "lg" }),
                      "h-11 rounded-full px-6 font-semibold"
                    )}
                  >
                    Back to Login
                  </Link>
                </div>
              ) : (
                <form action={requestPasswordResetAction} className="space-y-6">
                  <div className="space-y-2">
                    <Label
                      htmlFor="email"
                      className="ml-4 text-xs font-bold uppercase tracking-widest text-muted-foreground"
                    >
                      Work Email
                    </Label>
                    <div className="group relative">
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        defaultValue={email}
                        placeholder="name@minispastries.com"
                        required
                        disabled={!supabaseReady}
                        className="bg-muted/30 h-14 rounded-full border-transparent px-8 text-lg font-medium transition-all focus:border-primary focus:ring-0"
                      />
                    </div>
                  </div>

                  <AuthSubmitButton
                    disabled={!supabaseReady}
                    icon="mail"
                    label="Send Recovery Email"
                    pendingLabel="Sending Recovery Email..."
                  />
                </form>
              )}
            </div>

            <div className="border-border/50 mt-8 border-t pt-8 text-center">
              <Link
                href="/login"
                className="hover:text-primary/80 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </Link>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4 px-4 sm:justify-between">
            <div className="flex items-center gap-2 rounded-full bg-card px-5 py-2.5 text-muted-foreground shadow-candy">
              <HelpCircle className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-tighter">
                Help Center
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-success/10 flex items-center gap-2 rounded-full px-5 py-2.5 text-success">
                <span className="h-2 w-2 animate-pulse rounded-full bg-success"></span>
                <span className="text-xs font-bold uppercase tracking-tighter">
                  Systems Synced
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="flex h-20 items-center justify-center">
        <p className="text-muted-foreground/40 text-[10px] uppercase tracking-[0.3em]">
          Copyright {new Date().getFullYear()} {publicEnv.appName} POS System
        </p>
      </footer>
    </main>
  )
}
