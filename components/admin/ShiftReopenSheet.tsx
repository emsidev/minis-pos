"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Loader2, RotateCcw } from "lucide-react"
import { toast } from "sonner"

import { reopenShift } from "@/app/actions/shiftCloseout"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"

type ShiftReopenSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  boothId: string
  boothName: string
  scheduleId: string
  shiftLabel: string
  onSaved: () => void
}

export function ShiftReopenSheet({
  open,
  onOpenChange,
  boothId,
  boothName,
  scheduleId,
  shiftLabel,
  onSaved,
}: ShiftReopenSheetProps) {
  const [reason, setReason] = useState("")
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (open) {
      setReason("")
    }
  }, [open])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPending(true)

    const result = await reopenShift({
      scheduleId,
      boothId,
      reason,
    })
    setPending(false)

    if (!result.ok) {
      toast.error(result.error ?? "Unable to reopen this shift.")
      return
    }

    toast.success(result.message)
    onOpenChange(false)
    onSaved()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full max-w-lg flex-col p-0"
      >
        <div className="shrink-0 border-b border-border px-6 pb-5 pt-6">
          <SheetTitle>Reopen Shift</SheetTitle>
          <SheetDescription>
            Reopen {boothName} on {shiftLabel}. This keeps the previous closeout
            audit and starts a new close cycle.
          </SheetDescription>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <form
            id="shift-reopen-form"
            className="flex flex-col gap-6 p-6"
            onSubmit={handleSubmit}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="reopen-reason">
                  Reason for reopening
                </FieldLabel>
                <Input
                  id="reopen-reason"
                  required
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Cash count was entered incorrectly."
                />
                <FieldDescription>
                  This reason is saved to the closeout audit history.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </div>
        <footer className="flex shrink-0 justify-end gap-2 border-t border-border p-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="shift-reopen-form"
            disabled={pending || reason.trim().length === 0}
          >
            {pending ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <RotateCcw data-icon="inline-start" />
            )}
            Reopen Shift
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  )
}
