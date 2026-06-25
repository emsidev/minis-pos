"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import { ExternalLink, Loader2, Pencil, Receipt, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import {
  getReceiptSignedUrl,
  replaceReceiptPhotoForSale,
} from "@/app/actions/receipts"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { PaymentMethod } from "@/lib/domain-types"
import { prepareReceiptPhotoDataUrl } from "@/lib/receiptPhotoClient"
import type { SaleReceiptSyncState } from "@/lib/shifts"
import { cn, formatCurrency } from "@/lib/utils"

const SIGNED_URL_CACHE_TTL_MS = 4 * 60 * 1000

const signedReceiptUrlCache = new Map<
  string,
  { fetchedAt: number; signedUrl: string }
>()

type ReceiptPhotoPreviewProps = {
  saleId: string
  paymentMethod: PaymentMethod
  receiptPhotoPath: string | null
  receiptPhotoLocal?: string | null
  syncState?: SaleReceiptSyncState | null
  canEditReceipt?: boolean
  amount?: number
  createdAt?: string
  boothName?: string
  employeeName?: string
  shiftLabel?: string
  fallback?: ReactNode
  thumbnailClassName?: string
  onReplaceLocalReceipt?: (receiptPhotoDataUrl: string) => Promise<void>
}

function formatReceiptDateTime(value?: string) {
  if (!value) {
    return "Time unavailable"
  }

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value))
}

function isReceiptSignedUrlFresh(receiptPath: string) {
  const cached = signedReceiptUrlCache.get(receiptPath)

  return Boolean(
    cached && Date.now() - cached.fetchedAt < SIGNED_URL_CACHE_TTL_MS
  )
}

export function ReceiptPhotoPreview({
  saleId,
  paymentMethod,
  receiptPhotoPath,
  receiptPhotoLocal = null,
  syncState,
  canEditReceipt = false,
  amount,
  createdAt,
  boothName,
  employeeName,
  shiftLabel,
  fallback = null,
  thumbnailClassName,
  onReplaceLocalReceipt,
}: ReceiptPhotoPreviewProps) {
  const router = useRouter()
  const fileInputId = useId()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isOnline, setIsOnline] = useState(
    typeof window === "undefined" ? true : window.navigator.onLine
  )
  const [currentReceiptPath, setCurrentReceiptPath] = useState(receiptPhotoPath)
  const [currentReceiptLocal, setCurrentReceiptLocal] =
    useState(receiptPhotoLocal)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isReplacing, setIsReplacing] = useState(false)
  const [openInNewTabPending, setOpenInNewTabPending] = useState(false)

  useEffect(() => {
    setCurrentReceiptPath(receiptPhotoPath)
  }, [receiptPhotoPath])

  useEffect(() => {
    setCurrentReceiptLocal(receiptPhotoLocal)
  }, [receiptPhotoLocal])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const hasReceiptPreview = Boolean(currentReceiptLocal || currentReceiptPath)
  const canReplaceLocally =
    canEditReceipt &&
    Boolean(onReplaceLocalReceipt) &&
    Boolean(syncState) &&
    syncState !== "synced"
  const canReplaceRemotely =
    canEditReceipt &&
    !canReplaceLocally &&
    isOnline &&
    Boolean(currentReceiptPath)
  const canReplaceReceipt = canReplaceLocally || canReplaceRemotely
  const previewSource = currentReceiptLocal ?? signedUrl

  const saleDetailLines = useMemo(
    () =>
      [
        boothName,
        employeeName,
        shiftLabel,
        amount !== undefined ? formatCurrency(amount) : null,
      ].filter((value): value is string => Boolean(value)),
    [amount, boothName, employeeName, shiftLabel]
  )

  const ensureSignedUrl = useCallback(
    async (forceRefresh = false) => {
      if (!currentReceiptPath || currentReceiptLocal) {
        return null
      }

      const cached = signedReceiptUrlCache.get(currentReceiptPath)
      if (
        !forceRefresh &&
        cached &&
        isReceiptSignedUrlFresh(currentReceiptPath)
      ) {
        setSignedUrl(cached.signedUrl)
        setLoadError(null)
        return cached.signedUrl
      }

      setIsLoadingPreview(true)
      setLoadError(null)

      const result = await getReceiptSignedUrl(currentReceiptPath)
      setIsLoadingPreview(false)

      if (!result.ok || !result.signedUrl) {
        const errorMessage =
          result.error ?? "Unable to load this receipt photo."
        setLoadError(errorMessage)
        return null
      }

      signedReceiptUrlCache.set(currentReceiptPath, {
        fetchedAt: Date.now(),
        signedUrl: result.signedUrl,
      })
      setSignedUrl(result.signedUrl)
      return result.signedUrl
    },
    [currentReceiptLocal, currentReceiptPath]
  )

  useEffect(() => {
    if (!currentReceiptPath || currentReceiptLocal) {
      return
    }

    void ensureSignedUrl()
  }, [currentReceiptLocal, currentReceiptPath, ensureSignedUrl])

  const openReceiptInNewTab = async () => {
    if (!hasReceiptPreview) {
      return
    }

    let nextSource = currentReceiptLocal ?? signedUrl

    if (!nextSource && currentReceiptPath) {
      setOpenInNewTabPending(true)
      nextSource = await ensureSignedUrl(true)
      setOpenInNewTabPending(false)
    }

    if (!nextSource) {
      toast.error(loadError ?? "Unable to load this receipt photo.")
      return
    }

    window.open(nextSource, "_blank", "noopener,noreferrer")
  }

  const handleReplaceReceipt = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file) {
      return
    }

    try {
      setIsReplacing(true)
      const receiptPhotoDataUrl = await prepareReceiptPhotoDataUrl(file)

      if (canReplaceLocally && onReplaceLocalReceipt) {
        await onReplaceLocalReceipt(receiptPhotoDataUrl)
        setCurrentReceiptLocal(receiptPhotoDataUrl)
        setLoadError(null)
        toast.success("Receipt photo updated.")
        return
      }

      if (!canReplaceRemotely) {
        throw new Error("Reconnect before replacing this receipt photo.")
      }

      const result = await replaceReceiptPhotoForSale(
        saleId,
        receiptPhotoDataUrl
      )

      if (!result.ok || !result.receiptPhotoPath) {
        throw new Error(result.error ?? "Unable to update this receipt photo.")
      }

      signedReceiptUrlCache.delete(currentReceiptPath ?? "")
      signedReceiptUrlCache.delete(result.receiptPhotoPath)
      setCurrentReceiptPath(result.receiptPhotoPath)
      setCurrentReceiptLocal(receiptPhotoDataUrl)
      setSignedUrl(null)
      setLoadError(null)
      router.refresh()
      toast.success("Receipt photo updated.")
    } catch (error) {
      toast.error(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Unable to update this receipt photo."
      )
    } finally {
      setIsReplacing(false)
    }
  }

  if (paymentMethod === "cash" || !hasReceiptPreview) {
    return fallback
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        setIsOpen(nextOpen)

        if (nextOpen && currentReceiptPath && !currentReceiptLocal) {
          void ensureSignedUrl(!isReceiptSignedUrlFresh(currentReceiptPath))
        }
      }}
    >
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "group h-auto rounded-[1.4rem] p-0 hover:bg-transparent",
              thumbnailClassName
            )}
            onClick={(event) => {
              event.stopPropagation()
            }}
          />
        }
      >
        <div className="border-border/70 bg-muted/40 relative h-14 w-14 overflow-hidden rounded-[1.15rem] border shadow-sm transition-transform group-hover:scale-[1.02]">
          {previewSource ? (
            <Image
              src={previewSource}
              alt={`Receipt photo for sale ${saleId.slice(0, 8)}`}
              fill
              sizes="56px"
              unoptimized
              className="object-cover"
            />
          ) : isLoadingPreview ? (
            <div className="text-muted-foreground flex h-full w-full items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <div className="text-muted-foreground flex h-full w-full items-center justify-center">
              <Receipt className="h-4 w-4" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
        </div>
      </DialogTrigger>

      <DialogContent className="w-[min(94vw,52rem)] overflow-hidden p-0">
        <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="bg-muted/20 flex min-h-[20rem] items-center justify-center p-4 sm:p-6">
            <div className="border-border/70 bg-background relative aspect-[3/4] w-full max-w-[30rem] overflow-hidden rounded-[calc(var(--radius)+0.25rem)] border shadow-sm">
              {previewSource ? (
                <Image
                  src={previewSource}
                  alt={`Receipt photo for sale ${saleId.slice(0, 8)}`}
                  fill
                  sizes="(max-width: 768px) 90vw, 30rem"
                  unoptimized
                  className="object-contain"
                />
              ) : isLoadingPreview ? (
                <div className="text-muted-foreground flex h-full w-full items-center justify-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading receipt photo...
                </div>
              ) : (
                <div className="text-muted-foreground flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center text-sm">
                  <Receipt className="h-5 w-5" />
                  {loadError ?? "Unable to load this receipt photo."}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-5 p-5 sm:p-6">
            <div className="space-y-2">
              <DialogTitle>Receipt photo</DialogTitle>
              <DialogDescription>
                Review the saved proof of payment for this sale.
              </DialogDescription>
            </div>

            <div className="border-primary/10 bg-primary/5 space-y-2 rounded-[calc(var(--radius)+0.1rem)] border px-4 py-3">
              <p className="text-muted-foreground text-[0.68rem] font-semibold tracking-[0.2em] uppercase">
                Sale
              </p>
              <p className="text-foreground font-mono text-sm font-semibold">
                {saleId.slice(0, 8)}
              </p>
              <p className="text-muted-foreground text-sm">
                {formatReceiptDateTime(createdAt)}
              </p>
              {saleDetailLines.length > 0 ? (
                <div className="text-muted-foreground space-y-1 text-sm">
                  {saleDetailLines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              ) : null}
            </div>

            {!isOnline && !canReplaceLocally ? (
              <p className="text-muted-foreground text-sm">
                Reconnect before replacing this synced receipt photo.
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={
                  openInNewTabPending ||
                  (!currentReceiptLocal && !currentReceiptPath)
                }
                onClick={() => void openReceiptInNewTab()}
              >
                {openInNewTabPending ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <ExternalLink data-icon="inline-start" />
                )}
                Open In New Tab
              </Button>

              {canReplaceReceipt ? (
                <>
                  <Button
                    type="button"
                    disabled={isReplacing}
                    onClick={() => {
                      fileInputRef.current?.click()
                    }}
                  >
                    {isReplacing ? (
                      <Loader2
                        data-icon="inline-start"
                        className="animate-spin"
                      />
                    ) : canReplaceLocally ? (
                      <RefreshCw data-icon="inline-start" />
                    ) : (
                      <Pencil data-icon="inline-start" />
                    )}
                    Replace Receipt Photo
                  </Button>
                  <Input
                    ref={fileInputRef}
                    id={fileInputId}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    disabled={isReplacing}
                    onChange={(event) => void handleReplaceReceipt(event)}
                  />
                </>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
