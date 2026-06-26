"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Loader2, Wallet, WifiOff } from "lucide-react"
import { toast } from "sonner"

import { requestShiftCashDeduction } from "@/app/actions/shifts"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { SharedBoothSchedule } from "@/lib/shifts"

type CashDeductionSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule: SharedBoothSchedule
  onSaved: () => void
}

export function CashDeductionSheet({
  open,
  onOpenChange,
  schedule,
  onSaved,
}: CashDeductionSheetProps) {
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [pending, setPending] = useState(false)
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    if (!open) {
      setAmount("")
      setReason("")
    }
  }, [open])

  useEffect(() => {
    const syncOfflineState = () => {
      setIsOffline(!window.navigator.onLine)
    }

    syncOfflineState()
    window.addEventListener("online", syncOfflineState)
    window.addEventListener("offline", syncOfflineState)

    return () => {
      window.removeEventListener("online", syncOfflineState)
      window.removeEventListener("offline", syncOfflineState)
    }
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isOffline) {
      toast.error("Reconnect before sending a cash deduction request.")
      return
    }

    const parsedAmount = Number(amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid expense amount.")
      return
    }

    setPending(true)
    const result = await requestShiftCashDeduction({
      scheduleId: schedule.id,
      amount: parsedAmount,
      reason,
    })
    setPending(false)

    if (!result.ok) {
      toast.error(result.error ?? "Unable to request this cash deduction.")
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
        className="app-sheet-content max-w-xl"
      >
        <div className="app-sheet-header">
          <SheetTitle>Cash Deduction Request</SheetTitle>
          <SheetDescription>
            Send a shift expense deduction for admin approval before it affects
            closeout cash.
          </SheetDescription>
        </div>

        <div className="app-sheet-body">
          <form
            id="cash-deduction-form"
            className="app-sheet-form"
            onSubmit={handleSubmit}
          >
            {isOffline ? (
              <div className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm">
                <WifiOff className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">Approval requests need a connection.</p>
                  <p>Reconnect so this deduction can be sent to admins.</p>
                </div>
              </div>
            ) : null}

            <div className="border-border bg-card rounded-2xl border px-4 py-3">
              <p className="text-muted-foreground text-xs tracking-[0.18em] uppercase">
                Shift
              </p>
              <p className="text-foreground mt-1 text-sm font-medium">
                {schedule.date} / {schedule.start_time.slice(0, 5)} -{" "}
                {schedule.end_time.slice(0, 5)}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {schedule.booths.name}
              </p>
            </div>

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="cash-deduction-amount">
                  Expense amount
                </FieldLabel>
                <Input
                  id="cash-deduction-amount"
                  required
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                />
                <FieldDescription>
                  This reduces expected drawer cash after admin approval.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="cash-deduction-reason">
                  Reason
                </FieldLabel>
                <textarea
                  id="cash-deduction-reason"
                  required
                  rows={4}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-[calc(var(--radius)-0.25rem)] border px-3.5 py-3 text-sm outline-none focus-visible:ring-3"
                  placeholder="Lunch, water, supplies, or another shift expense"
                />
              </Field>
            </FieldGroup>
          </form>
        </div>

        <footer className="app-sheet-footer">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="cash-deduction-form"
            className="w-full sm:w-auto"
            disabled={pending || isOffline}
          >
            {pending ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Wallet data-icon="inline-start" />
            )}
            Send Request
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  )
}
