"use client"

import React, { createContext, useContext, useMemo, useState } from "react"
import { toast } from "sonner"

import type { CartItem, SellableProduct } from "@/components/pos/types"

type CartContextType = {
  items: CartItem[]
  addItem: (product: SellableProduct) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  subtotal: number
  total: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

function normalizeCartItem(product: SellableProduct): CartItem {
  return {
    id: product.id,
    name: product.name,
    price: Number(product.price),
    category: product.category ?? "Artisanal",
    image_url: product.image_url,
    quantity: 1,
    stock: product.stock,
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])

  const addItem = (product: SellableProduct) => {
    if (
      product.is_available === false ||
      (product.stock !== undefined && product.stock <= 0)
    ) {
      toast.error(`${product.name} is out of stock`)
      return
    }

    setItems((prev) => {
      const existing = prev.find((item) => item.id === product.id)
      const maxStock = product.stock ?? Number.POSITIVE_INFINITY

      if (existing) {
        if (existing.quantity >= maxStock) {
          toast.warning(`Maximum stock reached for ${product.name}`)
          return prev
        }

        return prev.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: Math.min(item.quantity + 1, maxStock),
                stock: product.stock,
              }
            : item
        )
      }

      toast.success(`${product.name} added to cart`)
      return [...prev, normalizeCartItem(product)]
    })
  }

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== productId))
  }

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId)
      return
    }

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== productId) {
          return item
        }

        const maxStock = item.stock ?? Number.POSITIVE_INFINITY
        if (quantity > maxStock) {
          toast.warning(`Only ${maxStock} units of ${item.name} available`)
          return { ...item, quantity: maxStock }
        }
        return { ...item, quantity: quantity }
      })
    )
  }

  const clearCart = () => setItems([])

  const subtotal = useMemo(
    () => items.reduce((acc, item) => acc + item.price * item.quantity, 0),
    [items]
  )

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        subtotal,
        total: subtotal,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)

  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider")
  }

  return context
}
