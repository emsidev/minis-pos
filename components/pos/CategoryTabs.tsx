"use client"

import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

type CategoryTabsProps = {
  categories: string[]
  activeCategory: string
  isPending?: boolean
  onCategoryChange: (category: string) => void
}

export function CategoryTabs({
  categories,
  activeCategory,
  isPending = false,
  onCategoryChange,
}: CategoryTabsProps) {
  return (
    <div className="app-panel-muted overflow-hidden p-2">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex min-h-11 items-center gap-2 pr-2">
          {categories.map((category) => {
            const isActive = activeCategory === category

            return (
              <Button
                key={category}
                type="button"
                variant={isActive ? "default" : "outline"}
                onClick={() => onCategoryChange(category)}
                className={cn(
                  "min-h-11 rounded-full px-4 text-xs font-semibold uppercase tracking-[0.16em]",
                  !isActive &&
                    "border-border/70 bg-background/80 text-muted-foreground hover:text-foreground"
                )}
              >
                {category}
              </Button>
            )
          })}

          {isPending ? (
            <span className="inline-flex h-11 items-center px-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </span>
          ) : null}
        </div>
        <ScrollBar orientation="horizontal" className="hidden" />
      </ScrollArea>
    </div>
  )
}
