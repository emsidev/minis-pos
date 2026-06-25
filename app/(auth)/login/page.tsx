import Link from "next/link"
import { redirect } from "next/navigation"
import { Cookie } from "lucide-react"

import {
  signInWithGoogleAction,
  signInWithPasswordAction,
} from "@/app/actions/auth"
import { AuthSubmitButton } from "@/components/shared/AuthSubmitButton"
import { LoginFeedback } from "@/components/shared/LoginFeedback"
import { SignOutButton } from "@/components/shared/SignOutButton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { getHomeRouteForRole } from "@/lib/auth.shared"
import { getCurrentSessionContext } from "@/lib/auth.server"
import { formatAuthMessage, readQueryValue } from "@/lib/authMessages"
import { isEmployeePendingApproval } from "@/lib/employeeApproval"
import { isSupabaseConfigured, publicEnv } from "@/lib/env"

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams
  const email = readQueryValue(resolvedSearchParams?.email)
  const error = formatAuthMessage(readQueryValue(resolvedSearchParams?.error), {
    config:
      "Add your Supabase URL and anon key to .env.local before signing in.",
    inactive:
      "Your employee account is inactive. Ask an admin to reactivate it.",
    "approval-pending":
      "Your account is waiting for admin approval. Please try again after an admin approves it.",
    "profile-missing": "Your employee profile has not been created yet.",
  })
  const passwordReset =
    readQueryValue(resolvedSearchParams?.passwordReset) === "1"
  const supabaseReady = isSupabaseConfigured
  const sessionContext = supabaseReady ? await getCurrentSessionContext() : null

  if (
    sessionContext?.employee?.is_active &&
    !isEmployeePendingApproval(sessionContext.employee)
  ) {
    redirect(getHomeRouteForRole(sessionContext.employee.role))
  }

  const profileMissing = Boolean(sessionContext && !sessionContext.employee)
  const pendingApproval = isEmployeePendingApproval(sessionContext?.employee)
  const inactiveAccount = Boolean(
    sessionContext?.employee &&
    !pendingApproval &&
    !sessionContext.employee.is_active
  )

  return (
    <main className="auth-shell">
      <div className="auth-shell__body">
        <div className="auth-shell__frame">
          <div className="auth-brand">
            <h2 className="auth-brand-mark">{publicEnv.appName}</h2>
            <p className="auth-brand-caption">POS</p>
          </div>

          <section className="auth-panel">
            <div className="auth-panel-header">
              <div className="bg-primary/10 text-primary mx-auto flex size-14 items-center justify-center rounded-full">
                <Cookie className="h-6 w-6" />
              </div>
              <div>
                <h1 className="auth-panel-title">Sign in</h1>
                <p className="auth-panel-copy">
                  Use your work email and password.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <LoginFeedback
                error={error}
                successMessage={
                  passwordReset
                    ? "Password updated. Sign in with your new password."
                    : null
                }
              />

              {!supabaseReady ? (
                <div className="border-warning/10 bg-warning/5 text-warning rounded-2xl border px-4 py-3 text-sm">
                  Supabase is not configured yet. Set up your .env.local files.
                </div>
              ) : null}

              {inactiveAccount || profileMissing || pendingApproval ? (
                <div className="bg-muted/50 flex flex-col gap-4 rounded-[calc(var(--radius)-0.1rem)] p-6 text-center">
                  <h3 className="text-xl font-semibold">
                    {pendingApproval
                      ? "Pending Admin Approval"
                      : inactiveAccount
                        ? "Account Inactive"
                        : "Profile Missing"}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {pendingApproval
                      ? "Your employee record has been created and is waiting for an admin to approve it."
                      : inactiveAccount
                        ? "Your employee record is disabled. Contact an admin to restore access."
                        : "Auth session active, but employee profile not found. Contact an admin."}
                  </p>
                  <SignOutButton className="mt-2" buttonClassName="w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  <form action={signInWithPasswordAction} className="space-y-6">
                    <div className="space-y-2">
                      <Label
                        htmlFor="email"
                        className="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase"
                      >
                        Work Email
                      </Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        defaultValue={email ?? ""}
                        placeholder="name@minispastries.com"
                        required
                        disabled={!supabaseReady}
                        className="bg-muted/30 border-transparent px-4 text-base"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="password"
                        className="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase"
                      >
                        Password
                      </Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        disabled={!supabaseReady}
                        className="bg-muted/30 border-transparent px-4 text-base"
                      />
                    </div>

                    <AuthSubmitButton
                      disabled={!supabaseReady}
                      icon="logIn"
                      label="Sign In"
                      pendingLabel="Signing In..."
                    />

                    <div className="text-center">
                      <Link
                        href="/forgot-password"
                        className="text-primary hover:text-primary/80 text-sm font-semibold transition-colors hover:underline"
                      >
                        Forgot or need to set your password?
                      </Link>
                    </div>
                  </form>

                  <div className="flex items-center gap-3">
                    <div className="bg-border h-px flex-1"></div>
                    <span className="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase">
                      Or
                    </span>
                    <div className="bg-border h-px flex-1"></div>
                  </div>

                  <form action={signInWithGoogleAction}>
                    <Button
                      type="submit"
                      size="lg"
                      disabled={!supabaseReady}
                      variant="outline"
                      className="flex w-full items-center justify-center gap-2 rounded-full text-base font-semibold"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-5 w-5"
                      >
                        <path
                          fill="#EA4335"
                          d="M12 10.2v3.9h5.4c-.2 1.3-1.7 3.9-5.4 3.9-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.8 0 3 .8 3.7 1.5l2.5-2.4C16.7 3.6 14.6 2.7 12 2.7A9.3 9.3 0 0 0 2.7 12 9.3 9.3 0 0 0 12 21.3c5.4 0 9-3.8 9-9.1 0-.6-.1-1.1-.2-1.6H12Z"
                        />
                        <path
                          fill="#34A853"
                          d="M2.7 7.5 5.9 9.8A5.9 5.9 0 0 1 12 6c1.8 0 3 .8 3.7 1.5l2.5-2.4C16.7 3.6 14.6 2.7 12 2.7c-3.6 0-6.8 2-8.4 4.8Z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M2.7 16.5A9.2 9.2 0 0 1 2.2 12c0-1.6.4-3.1 1-4.5l3.2 2.3A5.9 5.9 0 0 0 6.1 12c0 .8.2 1.5.4 2.2l-3.8 2.3Z"
                        />
                        <path
                          fill="#4285F4"
                          d="M12 21.3c2.5 0 4.7-.8 6.2-2.3l-3-2.4c-.8.6-1.8 1-3.2 1a5.9 5.9 0 0 1-5.6-4.1l-3.7 2.8A9.3 9.3 0 0 0 12 21.3Z"
                        />
                      </svg>
                      Continue with Google
                    </Button>
                  </form>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <footer className="auth-footer">
        Copyright {new Date().getFullYear()} {publicEnv.appName}
      </footer>
    </main>
  )
}
