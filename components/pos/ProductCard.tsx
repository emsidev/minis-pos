"use client"

import Image from "next/image"
import { Croissant, Plus } from "lucide-react"

import { useCart } from "@/components/pos/CartContext"
import type { SellableProduct } from "@/components/pos/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn, formatCurrency } from "@/lib/utils"

type ProductCardProps = {
  product: SellableProduct
  featured?: boolean
}

export function ProductCard({ product, featured = false }: ProductCardProps) {
  const { addItem } = useCart()
  const remainingStock = product.stock ?? 0
  const disabled = product.is_available === false || remainingStock <= 0

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={disabled}
      onClick={() => addItem(product)}
      className={cn(
        "app-panel group flex h-full min-h-[13.5rem] flex-col items-stretch justify-start gap-4 whitespace-normal p-4 text-left transition-transform duration-200 hover:-translate-y-0.5 hover:bg-card disabled:cursor-not-allowed disabled:opacity-55 sm:p-5",
        featured ? "bg-primary-container/70" : "bg-card/95"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "border-border/70 relative h-16 w-16 overflow-hidden rounded-[calc(var(--radius)-0.2rem)] border sm:h-[4.5rem] sm:w-[4.5rem]",
            featured ? "bg-white/70" : "bg-surface-container"
          )}
        >
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              sizes="(min-width: 1280px) 140px, (min-width: 768px) 160px, 30vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="text-primary/55 flex h-full w-full items-center justify-center">
              <Croissant className="h-7 w-7" />
            </div>
          )}
        </div>

        <Badge
          variant={disabled ? "outline" : "secondary"}
          className={cn(
            "rounded-full px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.18em]",
            disabled
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "bg-primary/10 text-primary"
          )}
        >
          {disabled ? "Out" : `${remainingStock} left`}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-4">
        <div className="space-y-1">
          <p className="app-kicker">{product.category ?? "Artisanal"}</p>
          <h3 className="line-clamp-2 text-base font-semibold leading-6 text-foreground sm:text-lg">
            {product.name}
          </h3>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xl font-semibold tracking-tight text-primary sm:text-2xl">
              {formatCurrency(Number(product.price))}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex h-11 w-11 items-center justify-center rounded-full border text-primary transition-colors",
              disabled
                ? "bg-muted/60 border-border text-muted-foreground"
                : "border-primary/15 bg-primary/8 group-hover:bg-primary group-hover:text-primary-foreground"
            )}
          >
            <Plus className="h-[18px] w-[18px]" />
          </span>
        </div>
      </div>
    </Button>
  )
}
