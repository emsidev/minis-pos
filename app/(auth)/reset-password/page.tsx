import Link from "next/link"
import { cookies } from "next/headers"
import { ArrowLeft, KeyRound, RefreshCcw, ShieldAlert } from "lucide-react"

import { updatePasswordAction } from "@/app/actions/auth"
import { AuthSubmitButton } from "@/components/shared/AuthSubmitButton"
import { LoginFeedback } from "@/components/shared/LoginFeedback"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatAuthMessage, readQueryValue } from "@/lib/authMessages"
import { isSupabaseConfigured, publicEnv } from "@/lib/env"
import { hasPasswordRecoveryCookie } from "@/lib/passwordRecovery"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { cn } from "@/lib/utils"

type ResetPasswordPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const resolvedSearchParams = await searchParams
  const supabaseReady = isSupabaseConfigured
  const error = formatAuthMessage(readQueryValue(resolvedSearchParams?.error), {
    config:
      "Add your Supabase URL and anon key to .env.local before resetting a password.",
    "recovery-expired":
      "That reset link is no longer valid. Request a new one to continue.",
  })

  const cookieStore = await cookies()
  const hasRecoveryMarker = hasPasswordRecoveryCookie(cookieStore)
  let recoveryEmail: string | null = null

  if (supabaseReady && hasRecoveryMarker) {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    recoveryEmail = user?.email?.trim() ?? null
  }

  const canResetPassword = supabaseReady && hasRecoveryMarker && !!recoveryEmail

  return (
    <main className="auth-shell">
      <div className="auth-shell__body">
        <div className="auth-shell__frame">
          <div className="auth-brand">
            <h2 className="auth-brand-mark">{publicEnv.appName}</h2>
            <p className="auth-brand-caption">Reset</p>
          </div>

          <section className="auth-panel">
            <div className="auth-panel-header">
              <div className="bg-primary/10 text-primary mx-auto flex size-14 items-center justify-center rounded-full">
                <KeyRound className="h-6 w-6" />
              </div>
              <div>
                <h1 className="auth-panel-title">Choose a new password</h1>
                <p className="auth-panel-copy">
                  Finish resetting your account.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <LoginFeedback error={error} />

              {!supabaseReady ? (
                <div className="border-warning/10 bg-warning/5 text-warning rounded-2xl border px-4 py-3 text-sm">
                  Supabase is not configured yet. Set up your .env.local files.
                </div>
              ) : null}

              {canResetPassword ? (
                <>
                  <div className="border-primary/10 bg-primary/5 text-foreground rounded-2xl border px-4 py-3 text-sm">
                    Resetting{" "}
                    <span className="font-semibold">{recoveryEmail}</span>
                  </div>

                  <form action={updatePasswordAction} className="space-y-6">
                    <div className="space-y-2">
                      <Label
                        htmlFor="password"
                        className="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase"
                      >
                        New Password
                      </Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        required
                        className="bg-muted/30 border-transparent px-4 text-base"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="confirmPassword"
                        className="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase"
                      >
                        Confirm Password
                      </Label>
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        required
                        className="bg-muted/30 border-transparent px-4 text-base"
                      />
                    </div>

                    <AuthSubmitButton
                      icon="keyRound"
                      label="Update Password"
                      pendingLabel="Updating Password..."
                    />
                  </form>
                </>
              ) : (
                <div className="bg-muted/50 flex flex-col gap-4 rounded-[calc(var(--radius)-0.1rem)] p-6 text-center">
                  <div className="bg-primary/10 text-primary mx-auto rounded-full p-3">
                    <ShieldAlert className="h-6 w-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold">
                      Reset link expired
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Request a new email to continue.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Link
                      href="/forgot-password"
                      className={cn(
                        buttonVariants({ variant: "default", size: "lg" }),
                        "flex-1 rounded-full px-6 font-semibold"
                      )}
                    >
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      Request New Link
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
                </div>
              )}
            </div>

            <div className="border-border/50 mt-8 border-t pt-8 text-center">
              <Link
                href="/login"
                className="text-primary hover:text-primary/80 inline-flex items-center gap-2 text-sm font-semibold transition-colors hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </Link>
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
