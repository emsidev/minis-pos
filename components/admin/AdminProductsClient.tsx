"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Edit, Ellipsis, Eye, EyeOff, Loader2, Plus } from "lucide-react"
import { toast } from "sonner"

import { toggleProductAvailability } from "@/app/actions/adminProducts"
import { ProductFormSheet } from "@/components/admin/ProductFormSheet"
import { DataTable } from "@/components/shared/DataTable"
import { DataTableColumnHeader } from "@/components/shared/DataTableColumnHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { AdminProductRecord } from "@/lib/adminProducts"
import { formatCurrency } from "@/lib/utils"

type AdminProductsClientProps = {
  products: AdminProductRecord[]
}

function sortProducts(rows: AdminProductRecord[]) {
  return rows
    .slice()
    .sort((left, right) =>
      `${left.category ?? ""} ${left.name}`.localeCompare(
        `${right.category ?? ""} ${right.name}`
      )
    )
}

export function AdminProductsClient({ products }: AdminProductsClientProps) {
  const [displayProducts, setDisplayProducts] = useState(products)
  const [editingProduct, setEditingProduct] =
    useState<AdminProductRecord | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [pendingProductId, setPendingProductId] = useState<string | null>(null)

  useEffect(() => {
    setDisplayProducts(products)
  }, [products])

  const openCreate = () => {
    setEditingProduct(null)
    setFormOpen(true)
  }

  const openEdit = (product: AdminProductRecord) => {
    setEditingProduct(product)
    setFormOpen(true)
  }

  const handleAvailabilityToggle = useCallback(
    async (productId: string, isAvailable: boolean) => {
      const previousProducts = displayProducts
      setPendingProductId(productId)
      setDisplayProducts((current) =>
        current.map((product) =>
          product.id === productId
            ? { ...product, is_available: isAvailable }
            : product
        )
      )

      const result = await toggleProductAvailability(productId, isAvailable)
      setPendingProductId(null)

      if (!result.ok) {
        setDisplayProducts(previousProducts)
        toast.error(result.error ?? "Unable to update product availability.")
        return
      }

      toast.success(result.message)
    },
    [displayProducts]
  )

  const columns = useMemo<ColumnDef<AdminProductRecord>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Product" />
        ),
        cell: ({ row }) => (
          <div className="flex min-w-[12rem] flex-col gap-0.5">
            <span className="text-foreground font-medium">
              {row.original.name}
            </span>
            <span className="text-muted-foreground text-sm">
              {row.original.category ?? "Uncategorized"}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "category",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Category" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {row.original.category ?? "Uncategorized"}
          </span>
        ),
      },
      {
        accessorKey: "price",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Price" align="right" />
        ),
        cell: ({ row }) => (
          <div className="text-foreground text-right font-semibold">
            {formatCurrency(Number(row.original.price))}
          </div>
        ),
      },
      {
        id: "availability",
        accessorFn: (row) =>
          row.is_available === false ? "hidden" : "available",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Availability" />
        ),
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.is_available === false ? "outline" : "default"
            }
          >
            {row.original.is_available === false ? "Hidden" : "Available"}
          </Badge>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const product = row.original
          const pending = pendingProductId === product.id
          const isAvailable = product.is_available !== false

          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon-sm" />}
                >
                  <Ellipsis />
                  <span className="sr-only">Open product actions</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(product)}>
                    <Edit data-icon="inline-start" />
                    Edit Product
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={pending}
                    onClick={() =>
                      handleAvailabilityToggle(product.id, !isAvailable)
                    }
                  >
                    {pending ? (
                      <Loader2
                        data-icon="inline-start"
                        className="animate-spin"
                      />
                    ) : isAvailable ? (
                      <EyeOff data-icon="inline-start" />
                    ) : (
                      <Eye data-icon="inline-start" />
                    )}
                    {isAvailable ? "Hide Product" : "Show Product"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [handleAvailabilityToggle, pendingProductId]
  )

  return (
    <div className="app-page flex flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="app-kicker">Admin Workspace</p>
          <h1 className="text-3xl font-semibold">Product Management</h1>
          <p className="app-caption">
            Keep the sellable catalog ready for Counter and booth stock setup.
          </p>
        </div>
        <Button type="button" size="lg" onClick={openCreate}>
          <Plus data-icon="inline-start" />
          Add Product
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Catalog</CardTitle>
          <CardDescription>Search by product name or category.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={displayProducts}
            searchPlaceholder="Search products"
            getSearchText={(row) =>
              [
                row.name,
                row.category ?? "Uncategorized",
                row.is_available === false ? "hidden" : "available",
                row.price,
              ].join(" ")
            }
            emptyMessage="No products match the current search."
            initialSorting={[
              { id: "category", desc: false },
              { id: "name", desc: false },
            ]}
          />
        </CardContent>
      </Card>

      <ProductFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editingProduct}
        onSaved={(product) => {
          setFormOpen(false)
          setDisplayProducts((current) =>
            sortProducts([
              product,
              ...current.filter((entry) => entry.id !== product.id),
            ])
          )
        }}
      />
    </div>
  )
}
