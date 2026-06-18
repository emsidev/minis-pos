"use client"

import type { Column } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type DataTableColumnHeaderProps<TData, TValue> = {
  column: Column<TData, TValue>
  title: string
  align?: "left" | "right"
  className?: string
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  align = "left",
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return (
      <div className={cn(align === "right" && "text-right", className)}>
        {title}
      </div>
    )
  }

  const sorted = column.getIsSorted()

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "hover:bg-muted/80 h-8 px-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground",
        align === "right" && "ml-auto",
        className
      )}
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {title}
      {sorted === "desc" ? (
        <ArrowDown data-icon="inline-end" />
      ) : sorted === "asc" ? (
        <ArrowUp data-icon="inline-end" />
      ) : (
        <ArrowUpDown data-icon="inline-end" />
      )}
    </Button>
  )
}
