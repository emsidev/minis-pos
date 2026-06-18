import type { Product } from "@/lib/shifts"

export type SellableProduct = Omit<
  Pick<
    Product,
    "id" | "name" | "price" | "category" | "image_url" | "is_available"
  >,
  "price"
> & {
  price: string | number
  stock?: number
  quantity?: number
}

export type CartItem = {
  id: string
  name: string
  price: number
  category: string
  image_url: string | null
  quantity: number
  stock?: number
}
