"use client"

import { KeyRound, Loader2, Mail } from "lucide-react"
import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"

const submitButtonIcons = {
  keyRound: KeyRound,
  mail: Mail,
} as const

type AuthSubmitButtonProps = {
  disabled?: boolean
  icon: keyof typeof submitButtonIcons
  label: string
  pendingLabel: string
}

export function AuthSubmitButton({
  disabled = false,
  icon,
  label,
  pendingLabel,
}: AuthSubmitButtonProps) {
  const { pending } = useFormStatus()
  const isDisabled = disabled || pending
  const Icon = submitButtonIcons[icon]

  return (
    <Button
      type="submit"
      size="lg"
      disabled={isDisabled}
      aria-busy={pending}
      className="group flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-lg font-bold shadow-candy transition-all hover:brightness-110 active:scale-[0.98] disabled:active:scale-100"
    >
      {pending ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{pendingLabel}</span>
        </>
      ) : (
        <>
          <span>{label}</span>
          <Icon className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </>
      )}
    </Button>
  )
}
