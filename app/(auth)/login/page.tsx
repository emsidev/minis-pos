import Link from "next/link"
import { redirect } from "next/navigation"
import { Cookie, HelpCircle } from "lucide-react"

import {
  requestMagicLinkAction,
  signInWithPasswordAction,
} from "@/app/actions/auth"
import { LoginFeedback } from "@/components/shared/LoginFeedback"
import { MagicLinkSubmitButton } from "@/components/shared/MagicLinkSubmitButton"
import { PasswordLoginSubmitButton } from "@/components/shared/PasswordLoginSubmitButton"
import { SignOutButton } from "@/components/shared/SignOutButton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getCurrentSessionContext, getHomeRouteForRole } from "@/lib/auth"
import { formatAuthMessage, readQueryValue } from "@/lib/authMessages"
import {
  isMagicLinkAuthEnabled,
  isSupabaseConfigured,
  publicEnv,
} from "@/lib/env"

type LoginPageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const magicLinksEnabled = isMagicLinkAuthEnabled()
  const email = readQueryValue(searchParams?.email)
  const error = formatAuthMessage(readQueryValue(searchParams?.error), {
    config:
      "Add your Supabase URL and anon key to .env.local before signing in.",
    inactive:
      "Your employee account is inactive. Ask an admin to reactivate it.",
    "profile-missing": "Your employee profile has not been created yet.",
    "password-auth-disabled":
      "Password sign-in is not enabled for this POS setup.",
  })
  const sent = magicLinksEnabled && readQueryValue(searchParams?.sent) === "1"
  const passwordReset =
    !magicLinksEnabled && readQueryValue(searchParams?.passwordReset) === "1"
  const supabaseReady = isSupabaseConfigured
  const sessionContext = supabaseReady ? await getCurrentSessionContext() : null

  if (sessionContext?.employee?.is_active) {
    redirect(getHomeRouteForRole(sessionContext.employee.role))
  }

  const profileMissing = Boolean(sessionContext && !sessionContext.employee)
  const inactiveAccount = Boolean(
    sessionContext?.employee && !sessionContext.employee.is_active
  )

  return (
    <main className="selection:bg-primary/30 relative flex min-h-screen flex-col overflow-hidden bg-background selection:text-primary-foreground">
      {/* Playful Background Decorative Elements */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="bg-primary/20 absolute -left-24 -top-24 h-96 w-96 rounded-full blur-3xl"></div>
        <div className="bg-secondary/20 absolute bottom-1/4 right-0 h-64 w-64 rounded-full blur-2xl"></div>
        <div className="bg-primary/10 absolute left-1/4 top-1/2 h-32 w-32 rounded-full blur-xl"></div>
      </div>

      <div className="z-10 flex flex-grow items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {/* Branding Anchor */}
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

          {/* Login Card */}
          <div className="border-primary/5 relative rounded-[2.5rem] border bg-card p-10 shadow-candy md:p-12">
            {/* Top Detail Icon */}
            <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
              <div className="rounded-full bg-primary p-4 shadow-candy ring-8 ring-background">
                <Cookie className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>

            <div className="mb-10 mt-2 text-center">
              <h1 className="mb-3 font-heading text-4xl font-bold text-foreground">
                Welcome back
              </h1>
              <p className="text-lg font-medium text-muted-foreground">
                {magicLinksEnabled
                  ? "Enter your email for a magic link"
                  : "Enter your email and password"}
              </p>
            </div>

            <div className="space-y-6">
              <LoginFeedback
                error={error}
                sent={sent}
                email={email}
                successMessage={
                  passwordReset
                    ? "Password updated. Sign in with your new password."
                    : null
                }
              />
              {!supabaseReady && (
                <div className="border-warning/10 bg-warning/5 rounded-2xl border px-4 py-3 text-sm text-warning">
                  Supabase is not configured yet. Set up your .env.local files.
                </div>
              )}

              {inactiveAccount || profileMissing ? (
                <div className="bg-muted/50 flex flex-col gap-4 rounded-2xl p-6 text-center">
                  <h3 className="font-heading text-xl font-bold">
                    {inactiveAccount ? "Account Inactive" : "Profile Missing"}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {inactiveAccount
                      ? "Your employee record is disabled. Contact an admin to restore access."
                      : "Auth session active, but employee profile not found. Contact an admin."}
                  </p>
                  <SignOutButton className="mt-2" buttonClassName="w-full" />
                </div>
              ) : (
                <form
                  action={
                    magicLinksEnabled
                      ? requestMagicLinkAction
                      : signInWithPasswordAction
                  }
                  className="space-y-6"
                >
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
                        defaultValue={email ?? ""}
                        placeholder="name@minispastries.com"
                        required
                        disabled={!supabaseReady}
                        className="bg-muted/30 h-14 rounded-full border-transparent px-8 text-lg font-medium transition-all focus:border-primary focus:ring-0"
                      />
                    </div>
                  </div>

                  {!magicLinksEnabled && (
                    <div className="space-y-2">
                      <Label
                        htmlFor="password"
                        className="ml-4 text-xs font-bold uppercase tracking-widest text-muted-foreground"
                      >
                        Password
                      </Label>
                      <div className="group relative">
                        <Input
                          id="password"
                          name="password"
                          type="password"
                          autoComplete="current-password"
                          required
                          disabled={!supabaseReady}
                          className="bg-muted/30 h-14 rounded-full border-transparent px-8 text-lg font-medium transition-all focus:border-primary focus:ring-0"
                        />
                      </div>
                    </div>
                  )}

                  {magicLinksEnabled ? (
                    <MagicLinkSubmitButton
                      disabled={!supabaseReady}
                      sent={sent}
                    />
                  ) : (
                    <>
                      <PasswordLoginSubmitButton disabled={!supabaseReady} />
                      <div className="text-center">
                        <Link
                          href="/forgot-password"
                          className="hover:text-primary/80 text-sm font-semibold text-primary transition-colors hover:underline"
                        >
                          Forgot or need to set your password?
                        </Link>
                      </div>
                    </>
                  )}
                </form>
              )}
            </div>

            <div className="border-border/50 mt-8 border-t pt-8 text-center">
              <p className="text-sm font-medium text-muted-foreground">
                New to the POS?{" "}
                <span className="font-bold text-primary">Contact an admin</span>
              </p>
            </div>
          </div>

          {/* Footer Connectivity Status */}
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

      {/* Bottom Attribution */}
      <footer className="flex h-20 items-center justify-center">
        <p className="text-muted-foreground/40 text-[10px] uppercase tracking-[0.3em]">
          © {new Date().getFullYear()} {publicEnv.appName} POS System
        </p>
      </footer>
    </main>
  )
}
