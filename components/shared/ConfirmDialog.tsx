"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  pendingLabel?: string
  onConfirm: () => void | Promise<void>
  variant?: "default" | "destructive"
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  pendingLabel = "Working...",
  onConfirm,
  variant = "default",
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-primary/10 shadow-panel rounded-[2.5rem]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold tracking-tight">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4 gap-2">
          <AlertDialogCancel
            disabled={pending}
            className="border-border/40 hover:bg-muted rounded-full font-bold"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            aria-busy={pending}
            onClick={async (e) => {
              e.preventDefault()
              setPending(true)
              try {
                await onConfirm()
                onOpenChange(false)
              } finally {
                setPending(false)
              }
            }}
            className={
              variant === "destructive"
                ? "hover:bg-destructive/90 bg-destructive text-destructive-foreground rounded-full font-bold transition-all active:scale-95"
                : "hover:bg-primary/90 bg-primary text-primary-foreground rounded-full font-bold transition-all active:scale-95"
            }
          >
            {pending ? (
              <>
                <Loader2 data-icon="inline-start" className="animate-spin" />
                {pendingLabel}
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
