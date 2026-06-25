"use client"

import { KeyRound, Loader2, LogIn, Mail } from "lucide-react"
import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const submitButtonIcons = {
  keyRound: KeyRound,
  logIn: LogIn,
  mail: Mail,
} as const

type AuthSubmitButtonProps = {
  disabled?: boolean
  icon: keyof typeof submitButtonIcons
  label: string
  pendingLabel: string
  className?: string
  iconClassName?: string
}

export function AuthSubmitButton({
  disabled = false,
  icon,
  label,
  pendingLabel,
  className,
  iconClassName,
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
      className={cn(
        "group bg-primary shadow-candy flex h-14 w-full items-center justify-center gap-2 rounded-full text-lg font-bold transition-all hover:brightness-110 active:scale-[0.98] disabled:active:scale-100",
        className
      )}
    >
      {pending ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{pendingLabel}</span>
        </>
      ) : (
        <>
          <span>{label}</span>
          <Icon
            className={cn(
              "h-5 w-5 transition-transform group-hover:translate-x-1",
              iconClassName
            )}
          />
        </>
      )}
    </Button>
  )
}
