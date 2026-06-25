import Link from "next/link"
import { ArrowLeft, Mail } from "lucide-react"

import { requestPasswordResetAction } from "@/app/actions/auth"
import { AuthSubmitButton } from "@/components/shared/AuthSubmitButton"
import { LoginFeedback } from "@/components/shared/LoginFeedback"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatAuthMessage, readQueryValue } from "@/lib/authMessages"
import { isSupabaseConfigured, publicEnv } from "@/lib/env"
import { createServerSupabaseClient } from "@/lib/supabase-server"

type ForgotPasswordPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const resolvedSearchParams = await searchParams
  const supabaseReady = isSupabaseConfigured
  const emailQuery = readQueryValue(resolvedSearchParams?.email)
  const sent = readQueryValue(resolvedSearchParams?.sent) === "1"
  const error = formatAuthMessage(readQueryValue(resolvedSearchParams?.error), {
    config:
      "Add your Supabase URL and anon key to .env.local before requesting a password reset.",
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
    <main className="auth-shell">
      <div className="auth-shell__body">
        <div className="auth-shell__frame">
          <div className="auth-brand">
            <h2 className="auth-brand-mark">{publicEnv.appName}</h2>
            <p className="auth-brand-caption">Recovery</p>
          </div>

          <section className="auth-panel">
            <div className="auth-panel-header">
              <div className="bg-primary/10 text-primary mx-auto flex size-14 items-center justify-center rounded-full">
                <Mail className="h-6 w-6" />
              </div>
              <div>
                <h1 className="auth-panel-title">Reset your password</h1>
                <p className="auth-panel-copy">Send a recovery email.</p>
              </div>
            </div>

            <div className="space-y-6">
              <LoginFeedback
                error={error}
                sent={sent}
                email={email || null}
                sentMessage={sentMessage}
              />

              {!supabaseReady ? (
                <div className="border-warning/10 bg-warning/5 text-warning rounded-2xl border px-4 py-3 text-sm">
                  Supabase is not configured yet. Set up your .env.local files.
                </div>
              ) : null}

              <div className="border-primary/10 bg-primary/5 text-foreground rounded-2xl border px-4 py-3 text-sm">
                Internet is required to send the email.
              </div>

              <form action={requestPasswordResetAction} className="space-y-6">
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
                    defaultValue={email}
                    placeholder="name@minispastries.com"
                    required
                    disabled={!supabaseReady}
                    className="bg-muted/30 border-transparent px-4 text-base"
                  />
                </div>

                <AuthSubmitButton
                  disabled={!supabaseReady}
                  icon="mail"
                  label="Send Recovery Email"
                  pendingLabel="Sending Recovery Email..."
                />
              </form>
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
