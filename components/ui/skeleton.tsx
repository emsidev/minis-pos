"use client"

import type { HTMLAttributes } from "react"

import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "bg-primary/10 animate-pulse rounded-[calc(var(--radius)-0.25rem)]",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
