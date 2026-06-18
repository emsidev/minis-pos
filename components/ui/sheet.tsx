"use client"

import * as React from "react"
import { Dialog } from "@base-ui/react/dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const sheetContentVariants = {
  left: "inset-y-0 left-0 h-full w-[86vw] max-w-sm rounded-r-[calc(var(--radius)+0.25rem)] border-r",
  right:
    "inset-y-0 right-0 h-full w-[86vw] max-w-sm rounded-l-[calc(var(--radius)+0.25rem)] border-l",
  top: "inset-x-0 top-0 rounded-b-[calc(var(--radius)+0.25rem)] border-b",
  bottom:
    "inset-x-0 bottom-0 max-h-[85svh] rounded-t-[calc(var(--radius)+0.35rem)] border-t",
} as const

type SheetSide = keyof typeof sheetContentVariants

function Sheet({ ...props }: React.ComponentProps<typeof Dialog.Root>) {
  return <Dialog.Root {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof Dialog.Trigger>) {
  return <Dialog.Trigger {...props} />
}

function SheetClose({ ...props }: React.ComponentProps<typeof Dialog.Close>) {
  return <Dialog.Close {...props} />
}

function SheetPortal({ ...props }: React.ComponentProps<typeof Dialog.Portal>) {
  return <Dialog.Portal {...props} />
}

const SheetOverlay = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof Dialog.Backdrop>
>(({ className, ...props }, ref) => (
  <Dialog.Backdrop
    ref={ref}
    className={cn(
      "bg-foreground/20 fixed inset-0 z-50 backdrop-blur-sm",
      className
    )}
    {...props}
  />
))
SheetOverlay.displayName = "SheetOverlay"

const SheetContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof Dialog.Popup> & {
    side?: SheetSide
    hideClose?: boolean
  }
>(
  (
    { className, children, side = "right", hideClose = false, ...props },
    ref
  ) => (
    <SheetPortal>
      <SheetOverlay />
      <Dialog.Popup
        ref={ref}
        className={cn(
          "fixed z-50 flex flex-col overflow-hidden border-border bg-card text-card-foreground shadow-[0_24px_60px_-24px_rgba(61,26,49,0.45)]",
          sheetContentVariants[side],
          className
        )}
        {...props}
      >
        {!hideClose ? (
          <SheetClose
            aria-label="Close panel"
            className="border-border/80 bg-background/80 absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </SheetClose>
        ) : null}
        {children}
      </Dialog.Popup>
    </SheetPortal>
  )
)
SheetContent.displayName = "SheetContent"

const SheetTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentProps<typeof Dialog.Title>
>(({ className, ...props }, ref) => (
  <Dialog.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold tracking-tight text-foreground",
      className
    )}
    {...props}
  />
))
SheetTitle.displayName = "SheetTitle"

const SheetDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentProps<typeof Dialog.Description>
>(({ className, ...props }, ref) => (
  <Dialog.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
SheetDescription.displayName = "SheetDescription"

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
}
