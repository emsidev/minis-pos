"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

import type { CartItem, SellableProduct } from "@/components/pos/types"

type CartContextType = {
  items: CartItem[]
  selectedPromoId: string | null
  setSelectedPromoId: (promoId: string | null) => void
  addItem: (product: SellableProduct) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  syncProductStock: (products: SellableProduct[]) => void
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
  const [selectedPromoId, setSelectedPromoId] = useState<string | null>(null)

  const addItem = (product: SellableProduct) => {
    if (
      product.is_available === false ||
      (product.stock !== undefined && product.stock <= 0)
    ) {
      return
    }

    setItems((prev) => {
      const existing = prev.find((item) => item.id === product.id)
      const maxStock = product.stock ?? Number.POSITIVE_INFINITY

      if (existing) {
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
          return { ...item, quantity: maxStock }
        }
        return { ...item, quantity: quantity }
      })
    )
  }

  const syncProductStock = useCallback((products: SellableProduct[]) => {
    const stockByProductId = new Map(
      products.map((product) => [product.id, product])
    )

    setItems((prev) => {
      let changed = false
      const next = prev.flatMap((item) => {
        const product = stockByProductId.get(item.id)
        if (!product) {
          return [item]
        }

        const maxStock = product.stock ?? Number.POSITIVE_INFINITY
        const nextQuantity = Math.min(item.quantity, maxStock)
        const nextStock = product.stock

        if (nextQuantity <= 0) {
          changed = true
          return []
        }

        if (item.quantity !== nextQuantity || item.stock !== nextStock) {
          changed = true
          return [{ ...item, quantity: nextQuantity, stock: nextStock }]
        }

        return [item]
      })

      return changed ? next : prev
    })
  }, [])

  const clearCart = () => {
    setItems([])
    setSelectedPromoId(null)
  }

  const subtotal = useMemo(
    () => items.reduce((acc, item) => acc + item.price * item.quantity, 0),
    [items]
  )

  return (
    <CartContext.Provider
      value={{
        items,
        selectedPromoId,
        setSelectedPromoId,
        addItem,
        removeItem,
        updateQuantity,
        syncProductStock,
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
