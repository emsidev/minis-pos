"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import React, { useEffect, useMemo, useState } from "react"
import {
  Banknote,
  Building2,
  CreditCard,
  Landmark,
  Loader2,
  Minus,
  Plus,
  ShoppingBag,
  Smartphone,
  TicketPercent,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { getPromoApprovalStatus, requestPromoApproval } from "@/app/actions/pos"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { ReceiptPhotoDropzone } from "@/components/shared/ReceiptPhotoDropzone"
import { useCart } from "@/components/pos/CartContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  saveSaleLocally,
  saveSaleOnlineConfirmed,
  syncPendingPosOperations,
} from "@/lib/sync"
import type { PaymentMethod } from "@/lib/domain-types"
import { prepareReceiptPhotoDataUrl } from "@/lib/receiptPhotoClient"
import {
  buildPromoApprovalSnapshot,
  evaluatePromoSelection,
  getPromoSummary,
  serializePromoApprovalSnapshot,
  type CounterPromo,
  type PromoPricingResult,
} from "@/lib/promos"
import type { BoothSchedule } from "@/lib/shifts"
import {
  cn,
  formatCurrency,
  isCurrentBusinessShift,
  createClientId,
} from "@/lib/utils"

type OrderSidebarProps = {
  boothId?: string
  employeeId: string
  employeeRole: "employee" | "admin"
  promos: CounterPromo[]
  scheduleId?: string
  schedule?: BoothSchedule
  shiftStarted?: boolean
  mode?: "docked" | "sheet"
  onChargeComplete?: () => void
  onOptimisticMutationChange?: (active: boolean) => void
  saleBlockedMessage?: string
}

type PromoApprovalState = {
  approvalId: string | null
  status: "pending" | "approved" | "rejected" | null
  snapshotKey: string | null
}

type PaymentRow = {
  id: string
  method: PaymentMethod
  amount: string
  receiptPhotoLocal: string | null
  isPreparingReceiptPhoto?: boolean
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

function buildBasePricingResult(
  items: Array<{ id: string; quantity: number; price: number }>
): PromoPricingResult {
  const subtotal = roundCurrency(
    items.reduce((total, item) => total + item.price * item.quantity, 0)
  )

  return {
    eligible: true,
    subtotal,
    discountTotal: 0,
    total: subtotal,
    discountByProductId: {},
    pricedItems: items.map((item) => ({
      productId: item.id,
      quantity: item.quantity,
      unitPrice: roundCurrency(item.price),
      baseUnitPrice: roundCurrency(item.price),
      discountAmount: 0,
    })),
  }
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function parseAmount(value: string) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? roundCurrency(parsed) : 0
}

function getApprovalBannerText(status: PromoApprovalState["status"]) {
  switch (status) {
    case "pending":
      return "Waiting for admin approval."
    case "approved":
      return "Admin approved this promo."
    case "rejected":
      return "Admin rejected this promo."
    default:
      return "Admin approval is required for this promo."
  }
}

function getCriteriaSummary(promo: CounterPromo) {
  const parts = []

  if (promo.criteria.minCartSubtotal) {
    parts.push(`Min cart ${formatCurrency(promo.criteria.minCartSubtotal)}`)
  }
  if (promo.criteria.minQualifyingQuantity) {
    parts.push(`Min qty ${promo.criteria.minQualifyingQuantity}`)
  }
  if (promo.criteria.paymentMethods?.length) {
    parts.push(
      promo.criteria.paymentMethods
        .map((method) => method.charAt(0).toUpperCase() + method.slice(1))
        .join(", ")
    )
  }

  return parts.length > 0 ? parts.join(" • ") : "No extra criteria"
}

function makePaymentRow(
  method: PaymentMethod = "cash",
  amount = ""
): PaymentRow {
  return {
    id: createClientId(),
    method,
    amount,
    receiptPhotoLocal: null,
  }
}

export function OrderSidebar({
  boothId,
  employeeId,
  employeeRole,
  promos,
  scheduleId,
  schedule,
  shiftStarted,
  mode = "docked",
  onChargeComplete,
  onOptimisticMutationChange,
  saleBlockedMessage,
}: OrderSidebarProps) {
  const router = useRouter()
  const {
    items,
    selectedPromoId,
    setSelectedPromoId,
    subtotal,
    updateQuantity,
    clearCart,
  } = useCart()
  const [cashReceived, setCashReceived] = useState("")
  const [isSplitPayment, setIsSplitPayment] = useState(false)
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>(() => [
    makePaymentRow("cash"),
  ])
  const [isCharging, setIsCharging] = useState(false)
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false)
  const [isRequestingApproval, setIsRequestingApproval] = useState(false)
  const [isOnline, setIsOnline] = useState(
    typeof window === "undefined" ? true : window.navigator.onLine
  )
  const [promoApproval, setPromoApproval] = useState<PromoApprovalState>({
    approvalId: null,
    status: null,
    snapshotKey: null,
  })

  useEffect(() => {
    if (typeof window === "undefined") return

    const syncOnline = () => setIsOnline(window.navigator.onLine)
    syncOnline()
    window.addEventListener("online", syncOnline)
    window.addEventListener("offline", syncOnline)
    return () => {
      window.removeEventListener("online", syncOnline)
      window.removeEventListener("offline", syncOnline)
    }
  }, [])

  const summaryPaymentMethod: PaymentMethod =
    paymentRows.length === 1 ? (paymentRows[0]?.method ?? "cash") : "other"
  const availablePromos = promos
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name))
  const selectedPromo =
    availablePromos.find((promo) => promo.id === selectedPromoId) ?? null
  const promoPricing = useMemo(() => {
    if (!selectedPromo) {
      return buildBasePricingResult(items)
    }

    return evaluatePromoSelection({
      promo: selectedPromo,
      items: items.map((item) => ({
        productId: item.id,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
      })),
      businessDate: schedule?.date ?? new Date().toISOString().slice(0, 10),
      paymentMethod: summaryPaymentMethod,
    })
  }, [items, schedule?.date, selectedPromo, summaryPaymentMethod])
  const promoSnapshot =
    selectedPromo && promoPricing.eligible
      ? buildPromoApprovalSnapshot({
          promo: selectedPromo,
          items: items.map((item) => ({
            productId: item.id,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
          })),
          paymentMethod: summaryPaymentMethod,
          pricing: promoPricing,
        })
      : null
  const promoSnapshotKey = promoSnapshot
    ? serializePromoApprovalSnapshot(promoSnapshot)
    : null
  const promoNeedsApproval =
    Boolean(selectedPromo?.requiresAdminApproval) && employeeRole !== "admin"

  useEffect(() => {
    if (selectedPromoId && !selectedPromo) {
      setSelectedPromoId(null)
    }
  }, [selectedPromo, selectedPromoId, setSelectedPromoId])

  useEffect(() => {
    setPromoApproval((current) =>
      current.approvalId || current.status
        ? { approvalId: null, status: null, snapshotKey: null }
        : current
    )
  }, [items, selectedPromoId, summaryPaymentMethod])

  useEffect(() => {
    if (
      !promoApproval.approvalId ||
      promoApproval.status !== "pending" ||
      !isOnline
    ) {
      return
    }

    const interval = window.setInterval(async () => {
      const result = await getPromoApprovalStatus(promoApproval.approvalId!)
      const nextStatus = result.status

      if (!result.ok || !nextStatus) return

      setPromoApproval((current) => {
        if (current.approvalId !== result.approvalId) return current
        if (current.status === nextStatus) return current

        if (nextStatus === "approved") {
          toast.success("Promo approved. You can charge the sale now.")
        } else if (nextStatus === "rejected") {
          toast.error("Promo request was rejected.")
        }

        return { ...current, status: nextStatus }
      })
    }, 5000)

    return () => window.clearInterval(interval)
  }, [isOnline, promoApproval.approvalId, promoApproval.status])

  const activeShiftWindow =
    !schedule ||
    isCurrentBusinessShift(
      schedule.date,
      schedule.start_time,
      schedule.end_time
    )
  const hasSaleContext =
    Boolean(boothId && scheduleId && activeShiftWindow) &&
    shiftStarted !== false
  const unavailableMessage =
    saleBlockedMessage ??
    (shiftStarted === false
      ? "Start the shift before recording sales."
      : "Active shift required to complete sales.")
  const effectiveTotal = promoPricing.total
  const splitAllocations = useMemo(
    () =>
      paymentRows
        .map((line) => ({
          id: line.id,
          paymentMethod: line.method,
          amount: parseAmount(line.amount),
          receiptPhotoLocal: line.receiptPhotoLocal,
        }))
        .filter((line) => line.amount > 0),
    [paymentRows]
  )
  const checkoutPaymentRows = isSplitPayment
    ? paymentRows
    : [
        {
          ...(paymentRows[0] ?? makePaymentRow("cash")),
          amount: effectiveTotal.toFixed(2),
        },
      ]
  const singlePaymentRow = checkoutPaymentRows[0] ?? makePaymentRow("cash")
  const singlePaymentMethod = singlePaymentRow.method
  const splitTotal = roundCurrency(
    splitAllocations.reduce((total, payment) => total + payment.amount, 0)
  )
  const splitBalance = roundCurrency(effectiveTotal - splitTotal)
  const splitHasNonCash = paymentRows.some(
    (payment) => payment.method !== "cash"
  )
  const splitHasAllPositiveAmounts =
    paymentRows.length > 0 &&
    paymentRows.every((payment) => parseAmount(payment.amount) > 0)
  const splitIsBalanced = Math.abs(splitBalance) < 0.005
  const splitHasEnoughLines = paymentRows.length >= 2
  const splitHasRequiredReceipts = paymentRows.every(
    (row) => row.method === "cash" || Boolean(row.receiptPhotoLocal)
  )
  const isCash = singlePaymentMethod === "cash"
  const cashAmount = parseAmount(cashReceived)
  const singleNeedsReceipt = singlePaymentMethod !== "cash"
  const promoEligible = !selectedPromo || promoPricing.eligible
  const approvalSatisfied =
    !promoNeedsApproval || promoApproval.status === "approved"
  const canCharge =
    items.length > 0 &&
    hasSaleContext &&
    promoEligible &&
    approvalSatisfied &&
    !isCharging &&
    (isSplitPayment
      ? splitHasEnoughLines &&
        splitHasAllPositiveAmounts &&
        splitIsBalanced &&
        splitHasRequiredReceipts &&
        !paymentRows.some((row) => row.isPreparingReceiptPhoto)
      : (isCash && cashAmount >= effectiveTotal) ||
        (singleNeedsReceipt &&
          Boolean(singlePaymentRow.receiptPhotoLocal) &&
          !singlePaymentRow.isPreparingReceiptPhoto))
  const changeDue = Math.max(0, cashAmount - effectiveTotal)

  const updateSplitPayment = (
    id: string,
    field: keyof Pick<PaymentRow, "method" | "amount">,
    value: string
  ) => {
    setPaymentRows((current) =>
      current.map((line) =>
        line.id === id
          ? {
              ...line,
              [field]: value,
              ...(field === "method" && value === "cash"
                ? { receiptPhotoLocal: null }
                : {}),
            }
          : line
      )
    )
  }

  const addSplitPayment = () => {
    setPaymentRows((current) => [...current, makePaymentRow("cash")])
  }

  const removeSplitPayment = (id: string) => {
    setPaymentRows((current) =>
      current.length <= 2 ? current : current.filter((line) => line.id !== id)
    )
  }

  const resetCheckoutState = () => {
    setCashReceived("")
    setIsSplitPayment(false)
    setPaymentRows([makePaymentRow("cash")])
    setPromoApproval({ approvalId: null, status: null, snapshotKey: null })
  }

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

    if (!promoEligible) {
      toast.error(
        selectedPromo && !promoPricing.eligible
          ? promoPricing.reason
          : "This promo cannot be applied."
      )
      return
    }

    if (promoNeedsApproval && promoApproval.status !== "approved") {
      toast.error("Admin approval is still required for this promo.")
      return
    }

    if (
      isSplitPayment &&
      (!splitHasEnoughLines ||
        !splitHasAllPositiveAmounts ||
        !splitIsBalanced ||
        !splitHasRequiredReceipts)
    ) {
      toast.error(
        "Split payments must balance and include each required receipt."
      )
      return
    }

    if (
      !isSplitPayment &&
      singleNeedsReceipt &&
      !singlePaymentRow.receiptPhotoLocal
    ) {
      toast.error("Take a receipt photo before charging this non-cash payment.")
      return
    }

    if (!canCharge || !boothId || !scheduleId) return

    setIsCharging(true)
    onOptimisticMutationChange?.(true)

    try {
      const saleId = createClientId()
      const salePayload = {
        id: saleId,
        boothId,
        employeeId,
        scheduleId,
        totalAmount: effectiveTotal,
        paymentMethod: summaryPaymentMethod,
        promoId: selectedPromo?.id ?? null,
        promoName: selectedPromo?.name ?? null,
        promoType: selectedPromo?.promoType ?? null,
        promoDiscountTotal: promoPricing.discountTotal,
        promoApprovalId:
          promoNeedsApproval && promoApproval.status === "approved"
            ? promoApproval.approvalId
            : null,
        items: promoPricing.pricedItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.unitPrice,
          basePrice: item.baseUnitPrice,
          discountAmount: item.discountAmount,
        })),
        payments: checkoutPaymentRows.map((row) => ({
          id: row.id,
          paymentMethod: row.method,
          amount: Number.parseFloat(row.amount),
          receiptPhotoLocal:
            row.method === "cash" ? null : row.receiptPhotoLocal,
        })),
      }

      if (isOnline) {
        await saveSaleOnlineConfirmed(salePayload)
      } else {
        await saveSaleLocally(salePayload)
      }

      clearCart()
      resetCheckoutState()
      toast.success("Sale recorded!")
      onChargeComplete?.()

      if (isOnline) {
        router.refresh()
      } else {
        syncPendingPosOperations().catch((error) => {
          console.warn("Background sync failed; will retry later.", error)
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
      onOptimisticMutationChange?.(false)
    }
  }

  const handleClearCart = () => {
    clearCart()
    resetCheckoutState()
    toast.info("Cart cleared")
  }

  const handlePaymentPhotoUpload = async (
    rowId: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file) return

    try {
      setPaymentRows((rows) =>
        rows.map((row) =>
          row.id === rowId ? { ...row, isPreparingReceiptPhoto: true } : row
        )
      )

      const receiptPhotoLocal = await prepareReceiptPhotoDataUrl(file)

      setPaymentRows((rows) =>
        rows.map((row) =>
          row.id === rowId
            ? { ...row, receiptPhotoLocal, isPreparingReceiptPhoto: false }
            : row
        )
      )
    } catch (error) {
      setPaymentRows((rows) =>
        rows.map((row) =>
          row.id === rowId ? { ...row, isPreparingReceiptPhoto: false } : row
        )
      )

      toast.error(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Unable to prepare the receipt photo."
      )
    }
  }

  const clearPaymentPhoto = (rowId: string) => {
    setPaymentRows((rows) =>
      rows.map((row) =>
        row.id === rowId ? { ...row, receiptPhotoLocal: null } : row
      )
    )
  }

  const handleRequestApproval = async () => {
    if (!scheduleId || !selectedPromo || !promoNeedsApproval) return

    if (!promoPricing.eligible) {
      toast.error(promoPricing.reason)
      return
    }

    if (!isOnline) {
      toast.error("Reconnect before requesting admin approval.")
      return
    }

    setIsRequestingApproval(true)

    const result = await requestPromoApproval({
      scheduleId,
      paymentMethod: summaryPaymentMethod,
      promoId: selectedPromo.id,
      items: items.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
        baseUnitPrice: item.price,
      })),
    })

    setIsRequestingApproval(false)

    if (!result.ok) {
      toast.error(result.error ?? "Unable to request promo approval.")
      return
    }

    setPromoApproval({
      approvalId: result.approvalId ?? null,
      status: result.status ?? "pending",
      snapshotKey: promoSnapshotKey,
    })
    toast.success(result.message ?? "Promo request sent for approval.")
  }

  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        mode === "docked"
          ? "app-panel h-[calc(100svh-7rem)]"
          : "h-[calc(100svh-5rem)] max-h-[calc(100svh-5rem)]"
      )}
    >
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 py-16 text-center">
            <div className="bg-primary/8 text-primary/40 flex h-16 w-16 items-center justify-center rounded-full">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <p className="text-muted-foreground text-sm font-medium">
              Cart is empty
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="hover:bg-primary/[0.03] flex items-center gap-3 rounded-2xl p-2.5 transition-colors"
              >
                <div className="bg-surface-container relative h-12 w-12 shrink-0 overflow-hidden rounded-xl">
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
                  <p className="text-foreground truncate text-sm font-semibold">
                    {item.name}
                  </p>
                  <p className="text-primary text-xs font-medium">
                    {formatCurrency(item.price * item.quantity)}
                  </p>
                </div>

                <div className="border-border/50 bg-background flex items-center gap-1 rounded-full border p-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="hover:bg-primary/10 text-muted-foreground hover:text-primary flex h-6 w-6 items-center justify-center rounded-full transition-colors"
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
                    className="hover:bg-primary/10 text-muted-foreground hover:text-primary flex h-6 w-6 items-center justify-center rounded-full transition-colors"
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
                  className="text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive flex h-7 w-7 items-center justify-center rounded-full transition-colors"
                  disabled={isCharging}
                  onClick={() => updateQuantity(item.id, 0)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}

            <div className="border-border/60 space-y-3 rounded-2xl border px-3 py-3">
              <div className="flex items-center gap-2">
                <TicketPercent className="text-primary h-4 w-4" />
                <p className="text-foreground text-sm font-semibold">Promo</p>
              </div>

              <Select
                value={selectedPromoId ?? "none"}
                onValueChange={(value) => {
                  setSelectedPromoId(value === "none" ? null : (value ?? null))
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select promo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" label="No promo">
                    No promo
                  </SelectItem>
                  {availablePromos.map((promo) => (
                    <SelectItem
                      key={promo.id}
                      value={promo.id}
                      label={promo.name}
                    >
                      <span className="flex flex-col items-start">
                        <span>{promo.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {getPromoSummary(promo)}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedPromo ? (
                <div className="bg-background/80 space-y-2 rounded-xl border px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-foreground text-sm font-medium">
                        {selectedPromo.name}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {getPromoSummary(selectedPromo)}
                      </p>
                    </div>
                    {selectedPromo.requiresAdminApproval ? (
                      <span className="text-muted-foreground rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase">
                        Approval
                      </span>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {getCriteriaSummary(selectedPromo)}
                  </p>

                  {!promoPricing.eligible ? (
                    <div className="bg-warning/8 text-warning-foreground rounded-xl px-3 py-2 text-xs font-medium">
                      {promoPricing.reason}
                    </div>
                  ) : promoPricing.discountTotal > 0 ? (
                    <div className="bg-primary/6 text-primary rounded-xl px-3 py-2 text-xs font-medium">
                      Savings {formatCurrency(promoPricing.discountTotal)}
                    </div>
                  ) : null}

                  {promoNeedsApproval ? (
                    <div className="space-y-2">
                      <div className="bg-muted/50 rounded-xl px-3 py-2 text-xs font-medium">
                        {getApprovalBannerText(promoApproval.status)}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        disabled={
                          isRequestingApproval ||
                          !promoPricing.eligible ||
                          !isOnline ||
                          !hasSaleContext ||
                          promoApproval.status === "pending"
                        }
                        onClick={() => void handleRequestApproval()}
                      >
                        {isRequestingApproval ? (
                          <Loader2
                            data-icon="inline-start"
                            className="animate-spin"
                          />
                        ) : null}
                        {promoApproval.status === "approved"
                          ? "Approved"
                          : promoApproval.status === "pending"
                            ? "Approval Pending"
                            : promoApproval.status === "rejected"
                              ? "Request Approval Again"
                              : "Request Approval"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={!isSplitPayment ? "default" : "outline"}
                className="rounded-xl"
                disabled={isCharging}
                onClick={() => {
                  setIsSplitPayment(false)
                  setPaymentRows((current) => [
                    {
                      ...(current[0] ?? makePaymentRow("cash")),
                      amount: "",
                    },
                  ])
                }}
              >
                Single payment
              </Button>
              <Button
                type="button"
                variant={isSplitPayment ? "default" : "outline"}
                className="rounded-xl"
                disabled={isCharging}
                onClick={() => {
                  setIsSplitPayment(true)
                  setPaymentRows((current) =>
                    current.length >= 2
                      ? current
                      : [
                          {
                            ...(current[0] ?? makePaymentRow("cash")),
                          },
                          makePaymentRow("gcash"),
                        ]
                  )
                }}
              >
                Split payment
              </Button>
            </div>

            {!isSplitPayment ? (
              <div className="grid grid-cols-3 gap-1.5">
                {paymentOptions.map((option) => {
                  const Icon = option.icon
                  const selected = singlePaymentMethod === option.value
                  return (
                    <Button
                      key={option.value}
                      type="button"
                      variant={selected ? "default" : "ghost"}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[10px] font-bold tracking-wider uppercase transition-all",
                        selected
                          ? "shadow-primary/20 bg-primary text-primary-foreground shadow-md"
                          : "bg-muted/50 hover:bg-primary/5 text-muted-foreground hover:text-primary"
                      )}
                      disabled={isCharging}
                      onClick={() =>
                        updateSplitPayment(
                          singlePaymentRow.id,
                          "method",
                          option.value
                        )
                      }
                    >
                      <Icon className="h-4 w-4" />
                      {option.label}
                    </Button>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-2 rounded-2xl border px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-foreground text-sm font-semibold">
                    Split allocations
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isCharging}
                    onClick={addSplitPayment}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
                {paymentRows.map((line) => (
                  <div
                    key={line.id}
                    className="space-y-3 rounded-xl border p-3"
                  >
                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_8rem_auto]">
                      <Select
                        value={line.method}
                        onValueChange={(value) =>
                          updateSplitPayment(
                            line.id,
                            "method",
                            value as PaymentMethod
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Method" />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentOptions.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                              label={option.label}
                            >
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        placeholder="Amount"
                        value={line.amount}
                        disabled={isCharging}
                        onChange={(event) =>
                          updateSplitPayment(
                            line.id,
                            "amount",
                            event.target.value
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="rounded-xl"
                        disabled={isCharging || paymentRows.length <= 2}
                        onClick={() => removeSplitPayment(line.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {line.method !== "cash" ? (
                      <ReceiptPhotoDropzone
                        id={line.id}
                        receiptPhotoLocal={line.receiptPhotoLocal}
                        isPreparing={line.isPreparingReceiptPhoto}
                        disabled={isCharging}
                        label="Take receipt photo"
                        onFileSelected={(event) =>
                          void handlePaymentPhotoUpload(line.id, event)
                        }
                        onClear={() => clearPaymentPhoto(line.id)}
                      />
                    ) : null}
                  </div>
                ))}
                <div
                  className={cn(
                    "flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold",
                    splitIsBalanced
                      ? "bg-success/8 text-success"
                      : "bg-muted/50 text-muted-foreground"
                  )}
                >
                  <span>{splitIsBalanced ? "Balanced" : "Remaining"}</span>
                  <span>{formatCurrency(Math.abs(splitBalance))}</span>
                </div>
                {!splitHasRequiredReceipts && splitHasNonCash ? (
                  <p className="text-destructive text-xs font-medium">
                    Each non-cash payment row needs its own receipt photo.
                  </p>
                ) : null}
              </div>
            )}

            {!isSplitPayment && isCash ? (
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    id="cash-received"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={cashReceived}
                    onChange={(event) => setCashReceived(event.target.value)}
                    placeholder="Cash received"
                    className="border-border/60 h-12 rounded-xl pr-14 text-lg font-bold"
                    disabled={isCharging}
                  />
                  <span className="text-muted-foreground/50 absolute top-1/2 right-3 -translate-y-1/2 text-xs font-medium">
                    PHP
                  </span>
                </div>
                {cashAmount > 0 ? (
                  <div
                    className={cn(
                      "flex items-center justify-between rounded-xl px-3 py-2.5",
                      cashAmount >= effectiveTotal && effectiveTotal > 0
                        ? "bg-success/8 text-success"
                        : "bg-muted/50 text-foreground"
                    )}
                  >
                    <span className="text-xs font-medium">Change</span>
                    <span className="text-lg font-black tracking-tight">
                      {formatCurrency(changeDue)}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : singleNeedsReceipt ? (
              <div>
                <ReceiptPhotoDropzone
                  id={singlePaymentRow.id}
                  receiptPhotoLocal={singlePaymentRow.receiptPhotoLocal}
                  isPreparing={singlePaymentRow.isPreparingReceiptPhoto}
                  disabled={isCharging}
                  label="Take receipt photo"
                  onFileSelected={(event) =>
                    void handlePaymentPhotoUpload(singlePaymentRow.id, event)
                  }
                  onClear={() => clearPaymentPhoto(singlePaymentRow.id)}
                />
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="border-border/60 shrink-0 space-y-4 border-t px-4 py-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
        {!hasSaleContext ? (
          <div className="bg-warning/8 text-warning-foreground rounded-xl px-3 py-2.5 text-xs font-medium">
            {unavailableMessage}
          </div>
        ) : null}

        <div className="space-y-2 rounded-2xl border px-3 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-medium">Subtotal</span>
            <span className="text-foreground font-semibold">
              {formatCurrency(subtotal)}
            </span>
          </div>
          {promoPricing.discountTotal > 0 ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground font-medium">
                Promo discount
              </span>
              <span className="text-primary font-semibold">
                -{formatCurrency(promoPricing.discountTotal)}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm font-medium">
              Total
            </span>
            <span className="text-primary text-2xl font-black tracking-tight">
              {formatCurrency(effectiveTotal)}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-border/60 hover:bg-destructive/10 hover:border-destructive/20 hover:text-destructive h-12 w-12 shrink-0 rounded-xl"
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
            onClick={() => void handleCharge()}
          >
            {isCharging ? (
              <>
                <Loader2 data-icon="inline-start" className="animate-spin" />
                Processing...
              </>
            ) : hasSaleContext ? (
              `Charge ${formatCurrency(effectiveTotal)}`
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
