"use client"

import { Loader2, LogIn } from "lucide-react"
import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"

type PasswordLoginSubmitButtonProps = {
  disabled?: boolean
}

export function PasswordLoginSubmitButton({
  disabled = false,
}: PasswordLoginSubmitButtonProps) {
  const { pending } = useFormStatus()
  const isDisabled = disabled || pending

  return (
    <Button
      type="submit"
      size="lg"
      disabled={isDisabled}
      aria-busy={pending}
      className="group bg-primary shadow-candy flex h-14 w-full items-center justify-center gap-2 rounded-full text-lg font-bold transition-all hover:brightness-110 active:scale-[0.98] disabled:active:scale-100"
    >
      {pending ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Signing In...</span>
        </>
      ) : (
        <>
          <span>Sign In</span>
          <LogIn className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </>
      )}
    </Button>
  )
}
