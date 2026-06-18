"use client"

import { useEffect } from "react"
import { toast } from "sonner"

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
  useEffect(() => {
    if (error) {
      toast.error(error, {
        duration: 5000,
      })
    }
  }, [error])

  useEffect(() => {
    if (sent) {
      toast.success(
        sentMessage ??
          `Magic link sent${email ? ` to ${email}` : ""}. Check your inbox.`,
        {
          duration: 8000,
        }
      )
    }
  }, [email, sent, sentMessage])

  useEffect(() => {
    if (successMessage) {
      toast.success(successMessage, {
        duration: 6000,
      })
    }
  }, [successMessage])

  return null
}
