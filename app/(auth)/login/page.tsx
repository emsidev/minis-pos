import { redirect } from "next/navigation"

import { requestMagicLinkAction } from "@/app/actions/auth"
import { AppWordmark } from "@/components/shared/AppWordmark"
import { SignOutButton } from "@/components/shared/SignOutButton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getCurrentSessionContext, getHomeRouteForRole } from "@/lib/auth"
import { isSupabaseConfigured } from "@/lib/env"

type LoginPageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

export const dynamic = "force-dynamic"

function readQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function formatErrorMessage(error: string | undefined) {
  if (!error) {
    return null
  }

  if (error === "config") {
    return "Add your Supabase URL and anon key to .env.local before using magic-link sign in."
  }

  if (error === "inactive") {
    return "Your employee account is inactive. Ask an admin to reactivate it before signing in."
  }

  if (error === "profile-missing") {
    return "Your employee profile has not been created yet. Open the latest magic link again after the SQL schema is installed."
  }

  try {
    return decodeURIComponent(error)
  } catch {
    return error
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const email = readQueryValue(searchParams?.email)
  const error = formatErrorMessage(readQueryValue(searchParams?.error))
  const sent = readQueryValue(searchParams?.sent) === "1"
  const supabaseReady = isSupabaseConfigured
  const sessionContext = supabaseReady ? await getCurrentSessionContext() : null

  if (sessionContext?.employee?.is_active) {
    redirect(getHomeRouteForRole(sessionContext.employee.role))
  }

  const profileMissing = Boolean(sessionContext && !sessionContext.employee)
  const inactiveAccount = Boolean(sessionContext?.employee && !sessionContext.employee.is_active)

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-6 sm:py-16">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[2rem] border border-border bg-card/95 shadow-[0_24px_70px_-36px_rgba(26,26,26,0.45)]">
          <CardHeader className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Milestone 1</Badge>
              <Badge variant="outline">Magic link authentication</Badge>
            </div>
            <AppWordmark />
            <div className="flex flex-col gap-2">
              <CardTitle className="font-heading text-3xl">
                Sign in for your booth or dashboard
              </CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Admins and employees use the same email magic link. Once you confirm the link,
                the app checks your employee profile and sends you to the correct view.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {error ? (
              <div className="rounded-[1.5rem] border border-border bg-secondary px-4 py-3 text-sm text-foreground">
                {error}
              </div>
            ) : null}
            {sent ? (
              <div className="rounded-[1.5rem] border border-border bg-accent px-4 py-3 text-sm text-accent-foreground">
                Magic link sent{email ? ` to ${email}` : ""}. Open the email on this device and
                finish the sign-in flow.
              </div>
            ) : null}
            {!supabaseReady ? (
              <div className="rounded-[1.5rem] border border-border bg-secondary px-4 py-4 text-sm leading-6 text-muted-foreground">
                The app scaffold is ready, but Supabase is not configured yet. Add real values to
                `.env.local`, run the SQL in `supabase/schema.sql`, and create the `receipts`
                storage bucket before testing sign-in.
              </div>
            ) : null}
            {inactiveAccount ? (
              <div className="flex flex-col gap-4 rounded-[1.5rem] border border-border bg-secondary px-4 py-4">
                <div className="flex flex-col gap-2">
                  <h2 className="font-heading text-xl">Account inactive</h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Your employee record exists, but it is currently disabled. An admin can restore
                    access from the employees table once Milestone 7 is implemented.
                  </p>
                </div>
                <SignOutButton />
              </div>
            ) : profileMissing ? (
              <div className="flex flex-col gap-4 rounded-[1.5rem] border border-border bg-secondary px-4 py-4">
                <div className="flex flex-col gap-2">
                  <h2 className="font-heading text-xl">Profile still missing</h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Your auth session is active, but the `employees` row has not been created yet.
                    Make sure the SQL policies are installed, then open the latest magic link again.
                  </p>
                </div>
                <SignOutButton />
              </div>
            ) : (
              <form action={requestMagicLinkAction} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    defaultValue={email ?? ""}
                    placeholder="you@minispastries.com"
                    required
                  />
                </div>
                <Button type="submit" size="lg" disabled={!supabaseReady}>
                  Send magic link
                </Button>
              </form>
            )}
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-2 text-sm leading-6 text-muted-foreground">
            <p>The first sign-in creates an employee record automatically with the default role `employee`.</p>
            <p>To make your first account an admin, change its `role` to `admin` in Supabase after the first login.</p>
          </CardFooter>
        </Card>

        <Card className="rounded-[2rem] border border-border bg-card/90 shadow-[0_18px_54px_-38px_rgba(26,26,26,0.4)]">
          <CardHeader className="flex flex-col gap-3">
            <Badge variant="secondary">Milestone 1 checklist</Badge>
            <CardTitle className="font-heading text-2xl">What this build includes</CardTitle>
            <CardDescription className="text-sm leading-6 text-muted-foreground">
              The foundation is wired for role-aware auth, protected routes, and separate admin and
              employee shells. A few manual Supabase steps are still needed before live testing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-6 text-muted-foreground">
              <li>Run the full SQL file in `supabase/schema.sql` to create tables, helper functions, and RLS policies.</li>
              <li>Create the `receipts` storage bucket with authenticated access only.</li>
              <li>Update `.env.local` with your real Supabase project URL and anon key.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
