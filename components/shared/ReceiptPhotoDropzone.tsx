"use client"

import Image from "next/image"
import { useId, useRef } from "react"
import { Camera, Loader2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type ReceiptPhotoDropzoneProps = {
  id: string
  receiptPhotoLocal: string | null
  isPreparing?: boolean
  disabled?: boolean
  label?: string
  onFileSelected: (event: React.ChangeEvent<HTMLInputElement>) => void
  onClear?: () => void
}

export function ReceiptPhotoDropzone({
  id,
  receiptPhotoLocal,
  isPreparing = false,
  disabled = false,
  label = "Take receipt photo",
  onFileSelected,
  onClear,
}: ReceiptPhotoDropzoneProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const hasPhoto = Boolean(receiptPhotoLocal)

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "h-auto w-full justify-start rounded-xl border-2 border-dashed px-4 py-4 text-left",
          hasPhoto
            ? "border-success/30 bg-success/5 hover:bg-success/10"
            : "border-primary/20 bg-primary/[0.02] hover:border-primary/40 hover:bg-primary/5"
        )}
        disabled={disabled || isPreparing}
        onClick={() => {
          inputRef.current?.click()
        }}
      >
        {hasPhoto ? (
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 overflow-hidden rounded-lg">
              <Image
                src={receiptPhotoLocal!}
                alt="Receipt"
                fill
                sizes="48px"
                unoptimized
                className="object-cover"
              />
            </div>
            <div className="space-y-1">
              <p className="text-success text-sm font-semibold">
                Photo attached - tap to retake
              </p>
            </div>
          </div>
        ) : isPreparing ? (
          <div className="text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-semibold">Preparing photo...</span>
          </div>
        ) : (
          <div className="text-muted-foreground flex items-center gap-3">
            <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full">
              <Camera className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-foreground text-sm font-semibold">{label}</p>
            </div>
          </div>
        )}
      </Button>

      {hasPhoto && onClear ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled || isPreparing}
            onClick={onClear}
          >
            <X data-icon="inline-start" />
            Clear
          </Button>
        </div>
      ) : null}

      <Input
        ref={inputRef}
        id={`${inputId}-${id}`}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={disabled || isPreparing}
        onChange={onFileSelected}
      />
    </div>
  )
}
