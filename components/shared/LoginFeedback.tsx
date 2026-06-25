interface LoginFeedbackProps {
  error?: string | null
  sent?: boolean
  email?: string | null
  sentMessage?: string
  successMessage?: string | null
}

export function LoginFeedback({
  error,
  sent,
  email,
  sentMessage,
  successMessage,
}: LoginFeedbackProps) {
  const sentLabel =
    sent &&
    (sentMessage ?? `Check ${email ?? "your inbox"} for the reset link.`)

  if (!error && !sentLabel && !successMessage) {
    return null
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="border-destructive/15 bg-destructive/5 text-destructive rounded-2xl border px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}
      {sentLabel ? (
        <div className="border-success/10 bg-success/5 text-success rounded-2xl border px-4 py-3 text-sm">
          {sentLabel}
        </div>
      ) : null}
      {successMessage ? (
        <div className="border-success/10 bg-success/5 text-success rounded-2xl border px-4 py-3 text-sm">
          {successMessage}
        </div>
      ) : null}
    </div>
  )
}
