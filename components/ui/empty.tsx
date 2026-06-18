import * as React from "react"

import { cn } from "@/lib/utils"

function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "app-panel animate-in fade-in flex flex-col items-center justify-center gap-6 px-6 py-12 text-center duration-500 sm:px-10 sm:py-16",
        className
      )}
      {...props}
    />
  )
}

function EmptyImage({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-image"
      className={cn(
        "bg-primary/10 animate-in zoom-in-75 flex h-20 w-20 items-center justify-center rounded-full text-primary shadow-[0_8px_16px_-6px_rgba(224,64,160,0.4)] duration-700",
        className
      )}
      {...props}
    />
  )
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="empty-title"
      className={cn(
        "font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl",
        className
      )}
      {...props}
    />
  )
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="empty-description"
      className={cn(
        "app-caption mx-auto max-w-sm text-base leading-relaxed",
        className
      )}
      {...props}
    />
  )
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn("mt-2", className)}
      {...props}
    />
  )
}

function EmptyFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-footer"
      className={cn("flex items-center justify-center gap-3", className)}
      {...props}
    />
  )
}

export {
  Empty,
  EmptyImage,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyFooter,
}
