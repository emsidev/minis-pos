"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import React, { useId, useState } from "react"
import {
  Banknote,
  Building2,
  Camera,
  CreditCard,
  Landmark,
  Loader2,
  Minus,
  Plus,
  ShoppingBag,
  Smartphone,
  Trash2,
} from "lucide-react"

import {
  saveSaleLocally,
  saveSaleOnlineConfirmed,
  syncPendingPosOperations,
} from "@/lib/sync"
import { useCart } from "@/components/pos/CartContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn, formatCurrency, isCurrentBusinessShift } from "@/lib/utils"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import type { BoothSchedule } from "@/lib/shifts"

type PaymentMethod =
  | "cash"
  | "gcash"
  | "maya"
  | "maribank"
  | "unionbank"
  | "other"

type OrderSidebarProps = {
  boothId?: string
  employeeId: string
  scheduleId?: string
  schedule?: BoothSchedule
  mode?: "docked" | "sheet"
  onChargeComplete?: () => void
  saleBlockedMessage?: string
}

const paymentOptions: Array<{
  value: PaymentMethod
  label: string
  icon: React.ElementType
}> = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "gcash", label: "GCash", icon: Smartphone },
  { value: "maya", label: "Maya", icon: CreditCard },
  { value: "maribank", label: "Maribank", icon: Building2 },
  { value: "unionbank", label: "UnionBank", icon: Landmark },
  { value: "other", label: "Other", icon: CreditCard },
]

export function OrderSidebar({
  boothId,
  employeeId,
  scheduleId,
  schedule,
  mode = "docked",
  onChargeComplete,
  saleBlockedMessage,
}: OrderSidebarProps) {
  const router = useRouter()
  const { items, updateQuantity, total, clearCart } = useCart()
  const receiptInputId = useId()
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash")
  const [cashReceived, setCashReceived] = useState("")
  const [receiptPhoto, setReceiptPhoto] = useState<string | null>(null)
  const [isCharging, setIsCharging] = useState(false)
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false)

  const isCash = paymentMethod === "cash"
  const activeShiftWindow =
    !schedule ||
    isCurrentBusinessShift(
      schedule.date,
      schedule.start_time,
      schedule.end_time
    )
  const hasSaleContext = Boolean(boothId && scheduleId && activeShiftWindow)
  const unavailableMessage =
    saleBlockedMessage ?? "Active shift required to complete sales."
  const cashAmount = Number.parseFloat(cashReceived) || 0
  const canCharge =
    items.length > 0 &&
    hasSaleContext &&
    !isCharging &&
    ((isCash && cashAmount >= total) || (!isCash && Boolean(receiptPhoto)))

  const changeDue = Math.max(0, cashAmount - total)

  const handleCharge = async () => {
    if (
      schedule &&
      !isCurrentBusinessShift(
        schedule.date,
        schedule.start_time,
        schedule.end_time
      )
    ) {
      toast.error("Sales can be recorded only while this shift is active.")
      return
    }

    if (!canCharge || !boothId || !scheduleId) {
      return
    }

    setIsCharging(true)

    try {
      const saleId = crypto.randomUUID()
      const salePayload = {
        id: saleId,
        boothId,
        employeeId,
        scheduleId,
        totalAmount: total,
        paymentMethod,
        items: items.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
          price: item.price,
        })),
        receiptPhotoLocal: receiptPhoto ?? undefined,
      }

      if (window.navigator.onLine) {
        await saveSaleOnlineConfirmed(salePayload)
      } else {
        // Offline POS stays Dexie-first and queues sync for reconnect.
        await saveSaleLocally(salePayload)
      }

      clearCart()
      setReceiptPhoto(null)
      setCashReceived("")
      setPaymentMethod("cash")
      toast.success("Sale recorded!")
      onChargeComplete?.()

      if (window.navigator.onLine) {
        router.refresh()
      } else {
        syncPendingPosOperations().catch((err) => {
          console.warn("Background sync failed; will retry later.", err)
        })
      }
    } catch (error) {
      console.error("Charge failed:", error)
      toast.error(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Unexpected error. Please retry."
      )
    } finally {
      setIsCharging(false)
    }
  }

  const handleClearCart = () => {
    clearCart()
    toast.info("Cart cleared")
  }

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => {
      setReceiptPhoto(typeof reader.result === "string" ? reader.result : null)
    }
    reader.readAsDataURL(file)
  }

  return (
    <aside
      className={cn(
        "flex flex-col overflow-hidden",
        mode === "docked"
          ? "app-panel h-[calc(100svh-7rem)]"
          : "h-[85svh] max-h-[85svh]"
      )}
    >
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 py-16 text-center">
            <div className="bg-primary/8 text-primary/40 flex h-16 w-16 items-center justify-center rounded-full">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              Cart is empty
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 p-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="hover:bg-primary/[0.03] flex items-center gap-3 rounded-2xl p-2.5 transition-colors"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-surface-container">
                  {item.image_url ? (
                    <Image
                      src={item.image_url}
                      alt={item.name}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="text-primary/25 flex h-full w-full items-center justify-center">
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {item.name}
                  </p>
                  <p className="text-xs font-medium text-primary">
                    {formatCurrency(item.price * item.quantity)}
                  </p>
                </div>

                <div className="border-border/50 flex items-center gap-1 rounded-full border bg-background p-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="hover:bg-primary/10 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary"
                    disabled={isCharging}
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="min-w-[1.25rem] text-center text-xs font-bold">
                    {item.quantity}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="hover:bg-primary/10 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary"
                    disabled={isCharging}
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground/40 hover:bg-destructive/10 flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:text-destructive"
                  disabled={isCharging}
                  onClick={() => updateQuantity(item.id, 0)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-border/60 shrink-0 space-y-4 border-t px-4 py-4">
        {!hasSaleContext && (
          <div className="bg-warning/8 rounded-xl px-3 py-2.5 text-xs font-medium text-warning-foreground">
            {unavailableMessage}
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            Total
          </span>
          <span className="text-2xl font-black tracking-tight text-primary">
            {formatCurrency(total)}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {paymentOptions.map((option) => {
            const Icon = option.icon
            const selected = paymentMethod === option.value
            return (
              <Button
                key={option.value}
                type="button"
                variant={selected ? "default" : "ghost"}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-all",
                  selected
                    ? "shadow-primary/20 bg-primary text-primary-foreground shadow-md"
                    : "bg-muted/50 hover:bg-primary/5 text-muted-foreground hover:text-primary"
                )}
                disabled={isCharging}
                onClick={() => setPaymentMethod(option.value)}
              >
                <Icon className="h-4 w-4" />
                {option.label}
              </Button>
            )
          })}
        </div>

        {isCash && (
          <div className="space-y-2">
            <div className="relative">
              <Input
                id="cash-received"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder="Cash received"
                className="border-border/60 h-12 rounded-xl pr-14 text-lg font-bold"
                disabled={isCharging}
              />
              <span className="text-muted-foreground/50 absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium">
                PHP
              </span>
            </div>
            {cashAmount > 0 && (
              <div
                className={cn(
                  "flex items-center justify-between rounded-xl px-3 py-2.5",
                  cashAmount >= total && total > 0
                    ? "bg-success/8 text-success"
                    : "bg-muted/50 text-foreground"
                )}
              >
                <span className="text-xs font-medium">Change</span>
                <span className="text-lg font-black tracking-tight">
                  {formatCurrency(changeDue)}
                </span>
              </div>
            )}
          </div>
        )}

        {!isCash && (
          <div>
            <label
              htmlFor={receiptInputId}
              className={cn(
                "flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-4 text-center transition-all",
                receiptPhoto
                  ? "border-success/30 bg-success/5"
                  : "border-primary/20 bg-primary/[0.02] hover:border-primary/40 hover:bg-primary/5"
              )}
            >
              {receiptPhoto ? (
                <div className="flex items-center gap-2">
                  <div className="relative h-10 w-10 overflow-hidden rounded-lg">
                    <Image
                      src={receiptPhoto}
                      alt="Receipt"
                      fill
                      sizes="40px"
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                  <span className="text-xs font-bold text-success">
                    Photo attached - tap to change
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Camera className="h-5 w-5" />
                  <span className="text-xs font-bold">Take receipt photo</span>
                </div>
              )}
            </label>
            <Input
              id={receiptInputId}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              disabled={isCharging}
              onChange={handlePhotoUpload}
            />
          </div>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-border/60 hover:bg-destructive/10 hover:border-destructive/20 h-12 w-12 shrink-0 rounded-xl hover:text-destructive"
            onClick={() => setIsConfirmClearOpen(true)}
            disabled={items.length === 0 || isCharging}
          >
            <Trash2 className="h-4.5 w-4.5" />
          </Button>
          <Button
            type="button"
            size="lg"
            className={cn(
              "h-12 flex-1 rounded-xl text-base font-bold transition-all active:scale-[0.98]",
              canCharge
                ? "hover:bg-primary/90 shadow-primary/25 bg-primary shadow-lg"
                : "bg-muted text-muted-foreground"
            )}
            disabled={!canCharge}
            aria-busy={isCharging}
            onClick={handleCharge}
          >
            {isCharging ? (
              <>
                <Loader2 data-icon="inline-start" className="animate-spin" />
                Processing...
              </>
            ) : hasSaleContext ? (
              `Charge ${formatCurrency(total)}`
            ) : saleBlockedMessage ? (
              "POS operator only"
            ) : (
              "No active shift"
            )}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={isConfirmClearOpen}
        onOpenChange={setIsConfirmClearOpen}
        title="Clear Cart?"
        description="Are you sure you want to remove all items from the cart? This action cannot be undone."
        confirmLabel="Clear All"
        cancelLabel="Keep Items"
        variant="destructive"
        onConfirm={handleClearCart}
      />
    </aside>
  )
}
