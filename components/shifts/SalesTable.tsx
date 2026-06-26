"use client"

import { useMemo, useState, useTransition } from "react"
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { submitSaleChange } from "@/app/actions/shifts"
import { ReceiptPhotoPreview } from "@/components/shared/ReceiptPhotoPreview"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getSaleItems } from "@/app/actions/shifts"
import { cacheServerSaleItems, getCachedSaleItems } from "@/lib/offlineData"
import { replaceLocalSaleReceiptPhoto } from "@/lib/sync"
import type { PaymentMethod } from "@/lib/domain-types"
import type { Product, SaleItemWithProduct, SaleWithJoins } from "@/lib/shifts"
import {
  cn,
  formatCurrency,
  getProductDisplayName,
  createClientId,
} from "@/lib/utils"

type SaleActionMode = "none" | "direct" | "request"

type EditableSaleLine = {
  rowId: string
  productId: string
  quantity: string
  unitPrice: string
}

type EditableProduct = {
  id: string
  name: string
  price: string | number
}

type SaleRowProps = {
  sale: SaleWithJoins
  products: Product[]
  allowOfflineCache: boolean
  canEditReceipts: boolean
  saleActionMode: SaleActionMode
  pendingSaleChange: boolean
  onSalesChanged?: () => void
}

const PAYMENT_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "maribank", label: "Maribank" },
  { value: "unionbank", label: "UnionBank" },
  { value: "other", label: "Other" },
]

function normalizePaymentMethod(
  value: string | null | undefined
): PaymentMethod {
  return PAYMENT_OPTIONS.some((option) => option.value === value)
    ? (value as PaymentMethod)
    : "cash"
}

function formatAmountInput(value: number) {
  return value.toFixed(2)
}

function formatSaleTime(value?: string) {
  if (!value) {
    return "Time unavailable"
  }

  return new Date(value).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  })
}

function seedEditableLines(items: SaleItemWithProduct[]) {
  return items.map((item) => ({
    rowId: item.id,
    productId: item.product_id ?? "",
    quantity: String(item.quantity),
    unitPrice: formatAmountInput(Number(item.unit_price)),
  }))
}

function buildEditableProducts(
  products: Product[],
  items: SaleItemWithProduct[]
): EditableProduct[] {
  const productMap = new Map<string, EditableProduct>()

  for (const product of products) {
    productMap.set(product.id, {
      id: product.id,
      name: product.name,
      price: product.price,
    })
  }

  for (const item of items) {
    if (!item.product_id || productMap.has(item.product_id)) {
      continue
    }

    productMap.set(item.product_id, {
      id: item.product_id,
      name: getProductDisplayName(item.products),
      price: item.unit_price,
    })
  }

  return Array.from(productMap.values()).sort((left, right) =>
    left.name.localeCompare(right.name)
  )
}

function parseEditableLines(lines: EditableSaleLine[]) {
  const normalized = lines.map((line) => {
    const quantity = Number.parseInt(line.quantity, 10)
    const unitPrice = Number.parseFloat(line.unitPrice)

    return {
      productId: line.productId,
      quantity,
      unitPrice,
    }
  })

  if (normalized.some((line) => !line.productId)) {
    return { error: "Choose a product for every row." as const }
  }

  if (
    normalized.some(
      (line) =>
        !Number.isInteger(line.quantity) ||
        line.quantity <= 0 ||
        !Number.isFinite(line.unitPrice) ||
        line.unitPrice < 0
    )
  ) {
    return {
      error: "Use whole quantities and valid unit prices." as const,
    }
  }

  if (
    new Set(normalized.map((line) => line.productId)).size !== normalized.length
  ) {
    return { error: "Each product can appear only once." as const }
  }

  return { data: normalized }
}

function getHasReceipt(sale: SaleWithJoins) {
  return getDisplayPayments(sale).some(
    (payment) =>
      payment.paymentMethod !== "cash" &&
      Boolean(payment.receiptPhotoPath || payment.receiptPhotoLocal)
  )
}

function getDisplayPayments(sale: SaleWithJoins) {
  if (sale.sale_payments && sale.sale_payments.length > 0) {
    return sale.sale_payments.map((payment) => ({
      id: payment.id,
      paymentMethod: normalizePaymentMethod(payment.payment_method),
      amount: Number(payment.amount),
      receiptPhotoPath: payment.receipt_photo_path,
      receiptPhotoLocal: null,
      createdAt: payment.created_at,
      isFallback: false,
    }))
  }

  return [
    {
      id: sale.id,
      paymentMethod: normalizePaymentMethod(sale.payment_method),
      amount: Number(sale.total_amount),
      receiptPhotoPath: sale.receipt_photo_path,
      receiptPhotoLocal: sale.receipt_photo_local ?? null,
      createdAt: sale.created_at ?? undefined,
      isFallback: true,
    },
  ]
}

function SaleRow({
  sale,
  products,
  allowOfflineCache,
  canEditReceipts,
  saleActionMode,
  pendingSaleChange,
  onSalesChanged,
}: SaleRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [items, setItems] = useState<SaleItemWithProduct[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editLines, setEditLines] = useState<EditableSaleLine[]>([])
  const [editReason, setEditReason] = useState("")
  const [deleteReason, setDeleteReason] = useState("")
  const salePaymentMethod = normalizePaymentMethod(sale.payment_method)
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>(salePaymentMethod)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitPending, setSubmitPending] = useState(false)

  const editableProducts = useMemo(
    () => buildEditableProducts(products, items),
    [items, products]
  )
  const displayPayments = useMemo(() => getDisplayPayments(sale), [sale])
  const hasReceipt = getHasReceipt(sale)
  const canManageSale = saleActionMode !== "none" && !pendingSaleChange
  const actionVerb = saleActionMode === "request" ? "Request" : ""
  const editTotal = useMemo(() => {
    const parsed = parseEditableLines(editLines)
    if ("error" in parsed) {
      return 0
    }

    return parsed.data.reduce(
      (total, line) => total + line.quantity * line.unitPrice,
      0
    )
  }, [editLines])

  const loadSaleItems = async (openAfterLoad = false) => {
    if (items.length > 0) {
      if (openAfterLoad) {
        setEditLines(seedEditableLines(items))
        setPaymentMethod(salePaymentMethod)
        setSubmitError(null)
        setEditReason("")
        setEditOpen(true)
      }
      return items
    }

    setLoadError(null)

    return await new Promise<SaleItemWithProduct[]>((resolve) => {
      startTransition(async () => {
        if (allowOfflineCache) {
          const cachedItems = await getCachedSaleItems(sale.id)

          if (cachedItems.length > 0 || !window.navigator.onLine) {
            setItems(cachedItems)
            if (cachedItems.length === 0 && !window.navigator.onLine) {
              setLoadError("Sale items are not available offline yet.")
            }
            if (openAfterLoad) {
              setEditLines(seedEditableLines(cachedItems))
              setPaymentMethod(salePaymentMethod)
              setSubmitError(null)
              setEditReason("")
              setEditOpen(true)
            }
            if (!isExpanded) {
              setIsExpanded(true)
            }
            resolve(cachedItems)
            return
          }
        } else if (!window.navigator.onLine) {
          setLoadError("Reconnect to load sale items for this shift preview.")
          if (!isExpanded) {
            setIsExpanded(true)
          }
          resolve([])
          return
        }

        try {
          const data = await getSaleItems(sale.id)
          if (allowOfflineCache) {
            await cacheServerSaleItems(data)
          }
          setItems(data)
          if (openAfterLoad) {
            setEditLines(seedEditableLines(data))
            setPaymentMethod(salePaymentMethod)
            setSubmitError(null)
            setEditReason("")
            setEditOpen(true)
          }
          if (!isExpanded) {
            setIsExpanded(true)
          }
          resolve(data)
        } catch {
          setLoadError("Unable to load sale items.")
          toast.error("Unable to load sale items.")
          if (!isExpanded) {
            setIsExpanded(true)
          }
          resolve([])
        }
      })
    })
  }

  const toggleExpand = async () => {
    if (!isExpanded && items.length === 0) {
      await loadSaleItems(false)
      setIsExpanded(true)
      return
    }

    setIsExpanded(!isExpanded)
  }

  const handleReplaceLocalReceipt = async (receiptPhotoDataUrl: string) => {
    try {
      await replaceLocalSaleReceiptPhoto(sale.id, receiptPhotoDataUrl)
    } catch (error) {
      throw new Error(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Unable to update this receipt photo."
      )
    }
  }

  const openEditDialog = async () => {
    const loadedItems = await loadSaleItems(true)

    if (loadedItems.length === 0) {
      setSubmitError("Sale items are required before this sale can be edited.")
    }
  }

  const addLine = () => {
    const fallbackProduct = editableProducts[0]

    setEditLines((current) => [
      ...current,
      {
        rowId: createClientId(),
        productId: fallbackProduct?.id ?? "",
        quantity: "1",
        unitPrice: fallbackProduct
          ? formatAmountInput(Number(fallbackProduct.price))
          : "0.00",
      },
    ])
  }

  const updateLine = (
    rowId: string,
    field: keyof EditableSaleLine,
    value: string
  ) => {
    setEditLines((current) =>
      current.map((line) =>
        line.rowId === rowId ? { ...line, [field]: value } : line
      )
    )
  }

  const removeLine = (rowId: string) => {
    setEditLines((current) => current.filter((line) => line.rowId !== rowId))
  }

  const handleSubmitEdit = async () => {
    if (!window.navigator.onLine) {
      setSubmitError("Reconnect before saving sale changes.")
      return
    }

    const parsed = parseEditableLines(editLines)
    if (!("data" in parsed)) {
      setSubmitError(parsed.error)
      return
    }

    if (paymentMethod !== "cash" && !hasReceipt) {
      setSubmitError(
        "Switching to non-cash needs a receipt photo already attached to the sale."
      )
      return
    }

    setSubmitPending(true)
    setSubmitError(null)
    const result = await submitSaleChange({
      saleId: sale.id,
      actionType: "edit_sale",
      saleUpdatedAt: sale.updated_at,
      reason: editReason,
      paymentMethod,
      receiptPhotoPath: sale.receipt_photo_path ?? undefined,
      items: parsed.data,
    })
    setSubmitPending(false)

    if (!result.ok) {
      setSubmitError(result.error ?? "Unable to save this sale change.")
      return
    }

    setEditOpen(false)
    toast.success(result.message)
    onSalesChanged?.()
  }

  const handleDelete = async () => {
    if (!window.navigator.onLine) {
      setSubmitError("Reconnect before deleting a sale.")
      return
    }

    setSubmitPending(true)
    setSubmitError(null)
    const result = await submitSaleChange({
      saleId: sale.id,
      actionType: "delete_sale",
      saleUpdatedAt: sale.updated_at,
      reason: deleteReason,
    })
    setSubmitPending(false)

    if (!result.ok) {
      setSubmitError(result.error ?? "Unable to delete this sale.")
      return
    }

    setDeleteOpen(false)
    toast.success(result.message)
    onSalesChanged?.()
  }

  return (
    <>
      <TableRow
        className="hover:bg-surface-container-low/50 cursor-pointer transition-colors"
        onClick={toggleExpand}
      >
        <TableCell className="w-10 p-0 pl-4">
          {isExpanded ? (
            <ChevronDown className="text-muted-foreground h-4 w-4" />
          ) : (
            <ChevronRight className="text-muted-foreground h-4 w-4" />
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-full">
              <Receipt className="h-4 w-4" />
            </div>
            <div>
              <p className="text-foreground text-sm font-semibold">
                {formatSaleTime(sale.created_at ?? undefined)}
              </p>
              <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-[0.65rem] tracking-wider uppercase">
                <span>ID: {sale.id.slice(0, 8)}</span>
                {pendingSaleChange ? (
                  <span className="text-primary">Pending approval</span>
                ) : null}
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1.5">
            {displayPayments.map((payment) => (
              <Badge
                key={payment.id}
                variant="outline"
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[0.62rem] font-semibold tracking-wider uppercase",
                  payment.paymentMethod === "cash"
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-secondary/20 bg-secondary/10 text-secondary"
                )}
              >
                {payment.paymentMethod} {formatCurrency(payment.amount)}
              </Badge>
            ))}
          </div>
        </TableCell>
        <TableCell>
          {displayPayments.some((payment) => !payment.isFallback) ? (
            <div className="flex flex-wrap gap-2">
              {displayPayments.map((payment) =>
                payment.paymentMethod === "cash" ? (
                  <span
                    key={payment.id}
                    className="text-muted-foreground text-xs font-medium"
                  >
                    Cash only
                  </span>
                ) : (
                  <ReceiptPhotoPreview
                    key={payment.id}
                    saleId={sale.id}
                    paymentMethod={payment.paymentMethod}
                    receiptPhotoPath={payment.receiptPhotoPath}
                    canEditReceipt={false}
                    createdAt={payment.createdAt}
                    boothName={sale.booths?.name ?? undefined}
                    employeeName={sale.employees?.name ?? undefined}
                    amount={payment.amount}
                    fallback={
                      <span className="text-muted-foreground text-xs">
                        Missing
                      </span>
                    }
                  />
                )
              )}
            </div>
          ) : (
            <ReceiptPhotoPreview
              saleId={sale.id}
              paymentMethod={salePaymentMethod}
              receiptPhotoPath={sale.receipt_photo_path}
              receiptPhotoLocal={sale.receipt_photo_local ?? null}
              syncState={sale.sync_state ?? null}
              canEditReceipt={canEditReceipts}
              createdAt={sale.created_at ?? undefined}
              boothName={sale.booths?.name ?? undefined}
              employeeName={sale.employees?.name ?? undefined}
              amount={Number(sale.total_amount)}
              onReplaceLocalReceipt={
                sale.sync_state && sale.sync_state !== "synced"
                  ? handleReplaceLocalReceipt
                  : undefined
              }
              fallback={
                <span className="text-muted-foreground text-xs">
                  {salePaymentMethod === "cash" ? "Cash sale" : "Missing"}
                </span>
              }
            />
          )}
        </TableCell>
        <TableCell className="w-[10rem] min-w-[10rem] text-right">
          <div className="grid grid-cols-[4.75rem_minmax(5.25rem,auto)] items-center justify-end gap-2">
            <div className="app-row-actions justify-end">
              {canManageSale ? (
                <>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    className="app-row-action-button"
                    onClick={(event) => {
                      event.stopPropagation()
                      void openEditDialog()
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="sr-only">
                      {actionVerb ? `${actionVerb} edit` : "Edit"} sale
                    </span>
                  </Button>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    className="app-row-action-button text-destructive"
                    onClick={(event) => {
                      event.stopPropagation()
                      setSubmitError(null)
                      setDeleteReason("")
                      setDeleteOpen(true)
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only">
                      {actionVerb ? `${actionVerb} delete` : "Delete"} sale
                    </span>
                  </Button>
                </>
              ) : null}
            </div>
            <span className="app-tabular-amount text-foreground font-bold">
              {formatCurrency(Number(sale.total_amount))}
            </span>
          </div>
        </TableCell>
      </TableRow>
      {isExpanded ? (
        <TableRow className="bg-surface-container-low/30 hover:bg-surface-container-low/30">
          <TableCell colSpan={5} className="p-0">
            <div className="space-y-3 px-4 py-4 sm:px-14">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-muted-foreground text-[0.62rem] font-bold tracking-[0.2em] uppercase">
                  Sale Items
                </h4>
                {pendingSaleChange ? (
                  <Badge variant="secondary" className="rounded-full">
                    Waiting for approval
                  </Badge>
                ) : null}
              </div>
              {isPending ? (
                <div className="text-muted-foreground flex animate-pulse items-center gap-2 py-2 text-xs">
                  <div className="bg-primary/40 h-2 w-2 rounded-full" />
                  Loading items...
                </div>
              ) : loadError ? (
                <p className="text-muted-foreground py-2 text-xs">
                  {loadError}
                </p>
              ) : items.length === 0 ? (
                <p className="text-muted-foreground py-2 text-xs">
                  No items found for this sale.
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-foreground font-medium">
                          {item.quantity}x
                        </span>
                        <span className="text-muted-foreground">
                          {getProductDisplayName(item.products)}
                        </span>
                      </div>
                      <span className="text-muted-foreground">
                        {formatCurrency(Number(item.subtotal))}
                      </span>
                    </div>
                  ))}
                  <div className="bg-border/50 my-2 h-px" />
                  <div className="flex items-center justify-between text-xs font-bold tracking-wider uppercase">
                    <span>Total</span>
                    <span className="text-primary">
                      {formatCurrency(Number(sale.total_amount))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      ) : null}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl overflow-hidden p-0">
          <div className="max-h-[calc(100svh-1rem)] space-y-5 overflow-y-auto p-4 sm:p-6">
            <div>
              <DialogTitle>
                {saleActionMode === "request"
                  ? "Request sale edit"
                  : "Edit sale"}
              </DialogTitle>
              <DialogDescription className="mt-1">
                Update the recorded items and payment method for sale{" "}
                {sale.id.slice(0, 8)}.
              </DialogDescription>
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
              <div>
                <label className="text-muted-foreground mb-2 block text-xs font-semibold tracking-[0.18em] uppercase">
                  Payment method
                </label>
                <Select
                  value={paymentMethod}
                  onValueChange={(value) =>
                    setPaymentMethod(value as PaymentMethod)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_OPTIONS.map((option) => (
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
                {!hasReceipt ? (
                  <p className="text-muted-foreground mt-2 text-xs">
                    Non-cash changes need an existing receipt photo on this
                    sale.
                  </p>
                ) : null}
              </div>
              <div>
                <label className="text-muted-foreground mb-2 block text-xs font-semibold tracking-[0.18em] uppercase">
                  Total
                </label>
                <div className="border-border/60 bg-muted/30 text-foreground flex h-11 items-center rounded-[calc(var(--radius)-0.25rem)] border px-3.5 text-sm font-semibold">
                  {formatCurrency(editTotal)}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
                  Sale items
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addLine}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add item
                </Button>
              </div>

              <div className="space-y-3">
                {editLines.map((line) => (
                  <div
                    key={line.rowId}
                    className="border-border/60 grid gap-2 rounded-[var(--radius)] border p-3 sm:gap-3 md:grid-cols-[minmax(0,1.4fr)_7rem_8rem_auto]"
                  >
                    <Select
                      value={line.productId}
                      onValueChange={(value) =>
                        updateLine(line.rowId, "productId", value ?? "")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose product" />
                      </SelectTrigger>
                      <SelectContent>
                        {editableProducts.map((product) => (
                          <SelectItem
                            key={product.id}
                            value={product.id}
                            label={product.name}
                          >
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={line.quantity}
                      onChange={(event) =>
                        updateLine(line.rowId, "quantity", event.target.value)
                      }
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(event) =>
                        updateLine(line.rowId, "unitPrice", event.target.value)
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="app-row-action-button justify-self-end"
                      onClick={() => removeLine(line.rowId)}
                      disabled={editLines.length === 1}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-muted-foreground mb-2 block text-xs font-semibold tracking-[0.18em] uppercase">
                Reason
              </label>
              <textarea
                value={editReason}
                onChange={(event) => setEditReason(event.target.value)}
                rows={3}
                className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-[calc(var(--radius)-0.25rem)] border px-3.5 py-3 text-sm outline-none focus-visible:ring-3"
                placeholder="Optional note for the audit log"
              />
            </div>

            {submitError ? (
              <p className="text-destructive text-sm">{submitError}</p>
            ) : null}

            <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setEditOpen(false)}
                disabled={submitPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={handleSubmitEdit}
                disabled={submitPending}
              >
                {submitPending
                  ? "Saving..."
                  : saleActionMode === "request"
                    ? "Send approval request"
                    : "Save changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="default">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {saleActionMode === "request"
                ? "Request sale deletion"
                : "Delete sale"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {saleActionMode === "request"
                ? "This sale will stay in place until an admin approves the deletion."
                : "This will remove the sale from revenue totals and restore its stock."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <label className="text-muted-foreground block text-xs font-semibold tracking-[0.18em] uppercase">
              Reason
            </label>
            <textarea
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.target.value)}
              rows={3}
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-[calc(var(--radius)-0.25rem)] border px-3.5 py-3 text-sm outline-none focus-visible:ring-3"
              placeholder="Optional note for the audit log"
            />
            {submitError ? (
              <p className="text-destructive text-sm">{submitError}</p>
            ) : null}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={submitPending}
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
            >
              {submitPending
                ? "Saving..."
                : saleActionMode === "request"
                  ? "Send approval request"
                  : "Delete sale"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

type SalesTableProps = {
  sales: SaleWithJoins[]
  products?: Product[]
  allowOfflineCache?: boolean
  canEditReceipts?: boolean
  saleActionMode?: SaleActionMode
  pendingSaleChangeSaleIds?: string[]
  onSalesChanged?: () => void
}

export function SalesTable({
  sales,
  products = [],
  allowOfflineCache = true,
  canEditReceipts = false,
  saleActionMode = "none",
  pendingSaleChangeSaleIds = [],
  onSalesChanged,
}: SalesTableProps) {
  if (sales.length === 0) {
    return (
      <div className="app-panel-muted flex min-h-[14rem] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <Receipt className="text-primary/35 h-10 w-10" />
        <h3 className="text-foreground text-lg font-semibold">
          No sales recorded
        </h3>
        <p className="text-muted-foreground max-w-[200px] text-sm">
          Transactions will appear here once they are completed.
        </p>
      </div>
    )
  }

  return (
    <div className="border-border/50 max-w-full overflow-hidden rounded-[var(--radius)] border">
      <Table className="min-w-[44rem]">
        <TableHeader className="bg-surface-container-low">
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead className="text-[0.62rem] tracking-[0.2em] uppercase">
              Transaction
            </TableHead>
            <TableHead className="text-[0.62rem] tracking-[0.2em] uppercase">
              Payment
            </TableHead>
            <TableHead className="text-[0.62rem] tracking-[0.2em] uppercase">
              Receipt
            </TableHead>
            <TableHead className="text-right text-[0.62rem] tracking-[0.2em] uppercase">
              Amount
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.map((sale) => (
            <SaleRow
              key={sale.id}
              sale={sale}
              products={products}
              allowOfflineCache={allowOfflineCache}
              canEditReceipts={canEditReceipts}
              saleActionMode={saleActionMode}
              pendingSaleChange={pendingSaleChangeSaleIds.includes(sale.id)}
              onSalesChanged={onSalesChanged}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
