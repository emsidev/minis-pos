"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close {...props} />
}

const DialogOverlay = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof DialogPrimitive.Backdrop>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Backdrop
    ref={ref}
    className={cn(
      "bg-foreground/30 fixed inset-0 z-50 backdrop-blur-sm",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = "DialogOverlay"

const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof DialogPrimitive.Popup> & {
    hideClose?: boolean
  }
>(({ className, children, hideClose = false, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Popup
      ref={ref}
      className={cn(
        "bg-card text-card-foreground border-border fixed top-1/2 left-1/2 z-50 w-[min(92vw,44rem)] -translate-x-1/2 -translate-y-1/2 rounded-[calc(var(--radius)+0.35rem)] border shadow-[0_36px_80px_-32px_rgba(61,26,49,0.5)]",
        className
      )}
      {...props}
    >
      {!hideClose ? (
        <DialogClose
          aria-label="Close dialog"
          className="border-border/80 bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground absolute top-4 right-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors"
        >
          <X className="h-4 w-4" />
        </DialogClose>
      ) : null}
      {children}
    </DialogPrimitive.Popup>
  </DialogPortal>
))
DialogContent.displayName = "DialogContent"

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentProps<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-foreground text-lg font-semibold", className)}
    {...props}
  />
))
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentProps<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-muted-foreground text-sm", className)}
    {...props}
  />
))
DialogDescription.displayName = "DialogDescription"

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
