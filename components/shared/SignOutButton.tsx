"use client"

import { useState, useRef } from "react"
import { signOutAction } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"

type SignOutButtonProps = {
  className?: string
  buttonClassName?: string
}

export function SignOutButton({
  className,
  buttonClassName,
}: SignOutButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const handleConfirm = () => formRef.current?.requestSubmit()

  return (
    <>
      <form ref={formRef} action={signOutAction} className={cn(className)}>
        <Button
          type="button"
          variant="outline"
          className={cn("rounded-full", buttonClassName)}
          onClick={() => setIsOpen(true)}
        >
          Sign out
        </Button>
      </form>

      <ConfirmDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Sign Out?"
        description="Are you sure you want to sign out of the POS system?"
        confirmLabel="Sign Out"
        cancelLabel="Stay Logged In"
        variant="destructive"
        onConfirm={handleConfirm}
      />
    </>
  )
}
