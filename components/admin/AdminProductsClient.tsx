"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import {
  CalendarRange,
  Edit,
  Ellipsis,
  Eye,
  EyeOff,
  Loader2,
  Plus,
} from "lucide-react"
import { toast } from "sonner"

import {
  toggleProductAvailability,
  togglePromoActive,
  type ProductFormInput,
} from "@/app/actions/adminProducts"
import { buildOptimisticProductRecord } from "@/lib/adminOptimistic"
import { ProductFormSheet } from "@/components/admin/ProductFormSheet"
import { PromoFormSheet } from "@/components/admin/PromoFormSheet"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AdminProductRecord } from "@/lib/adminProducts"
import { getPromoSummary, type CounterPromo } from "@/lib/promos"
import { formatCurrency } from "@/lib/utils"

type AdminProductsClientProps = {
  products: AdminProductRecord[]
  promos: CounterPromo[]
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

function sortPromos(rows: CounterPromo[]) {
  return rows.slice().sort((left, right) => {
    if (left.isActive !== right.isActive) {
      return left.isActive ? -1 : 1
    }

    return (
      right.startsOn.localeCompare(left.startsOn) ||
      left.name.localeCompare(right.name)
    )
  })
}

function formatPromoType(promoType: CounterPromo["promoType"]) {
  switch (promoType) {
    case "percent_off":
      return "Percent Off"
    case "fixed_amount_off":
      return "Fixed Amount Off"
    case "special_price":
      return "Special Price"
    case "buy_x_get_y":
      return "Buy X Get Y"
    case "bundle_price":
      return "Bundle Price"
    case "free_item":
      return "Free Item"
  }
}

function getPromoProductsSummary(promo: CounterPromo) {
  const qualifyingNames = promo.products
    .filter((product) => product.role === "qualifying")
    .map((product) => product.productName ?? "Product")
  const rewardNames = promo.products
    .filter((product) => product.role === "reward")
    .map((product) => product.productName ?? "Product")

  const parts = []
  if (qualifyingNames.length > 0) {
    parts.push(`Qualifies: ${qualifyingNames.join(", ")}`)
  }
  if (rewardNames.length > 0) {
    parts.push(`Reward: ${rewardNames.join(", ")}`)
  }

  return parts.join(" • ")
}

function getPromoCriteriaSummary(promo: CounterPromo) {
  const parts = []

  if (promo.criteria.minCartSubtotal) {
    parts.push(`Min cart ${formatCurrency(promo.criteria.minCartSubtotal)}`)
  }
  if (promo.criteria.minQualifyingQuantity) {
    parts.push(`Min qty ${promo.criteria.minQualifyingQuantity}`)
  }
  if (promo.criteria.paymentMethods?.length) {
    parts.push(
      promo.criteria.paymentMethods
        .map((method) => method.charAt(0).toUpperCase() + method.slice(1))
        .join(", ")
    )
  }

  return parts.length > 0 ? parts.join(" • ") : "No extra criteria"
}

export function AdminProductsClient({
  products,
  promos,
}: AdminProductsClientProps) {
  const [activeTab, setActiveTab] = useState("catalog")
  const [displayProducts, setDisplayProducts] = useState(sortProducts(products))
  const [displayPromos, setDisplayPromos] = useState(sortPromos(promos))
  const [editingProduct, setEditingProduct] =
    useState<AdminProductRecord | null>(null)
  const [editingPromo, setEditingPromo] = useState<CounterPromo | null>(null)
  const [productFormOpen, setProductFormOpen] = useState(false)
  const [promoFormOpen, setPromoFormOpen] = useState(false)
  const [pendingProductId, setPendingProductId] = useState<string | null>(null)
  const [pendingPromoId, setPendingPromoId] = useState<string | null>(null)
  const optimisticProductIdRef = useRef<string | null>(null)

  useEffect(() => {
    setDisplayProducts(sortProducts(products))
  }, [products])

  useEffect(() => {
    setDisplayPromos(sortPromos(promos))
  }, [promos])

  const openCreateProduct = () => {
    setEditingProduct(null)
    setProductFormOpen(true)
  }

  const openEditProduct = (product: AdminProductRecord) => {
    setEditingProduct(product)
    setProductFormOpen(true)
  }

  const openCreatePromo = () => {
    setEditingPromo(null)
    setPromoFormOpen(true)
  }

  const openEditPromo = (promo: CounterPromo) => {
    setEditingPromo(promo)
    setPromoFormOpen(true)
  }

  const handleOptimisticSave = useCallback(
    (input: ProductFormInput) => {
      const previousProducts = displayProducts
      const optimisticId =
        input.id ?? `optimistic-product-${crypto.randomUUID()}`

      optimisticProductIdRef.current = input.id ? null : optimisticId

      const optimisticProduct = buildOptimisticProductRecord(
        input,
        optimisticId,
        editingProduct
      )

      setDisplayProducts((current) =>
        sortProducts([
          optimisticProduct,
          ...current.filter(
            (entry) =>
              entry.id !== optimisticProduct.id &&
              entry.id !== editingProduct?.id
          ),
        ])
      )

      return () => {
        optimisticProductIdRef.current = null
        setDisplayProducts(previousProducts)
      }
    },
    [displayProducts, editingProduct]
  )

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

  const handlePromoToggle = useCallback(
    async (promoId: string, isActive: boolean) => {
      const previousPromos = displayPromos
      setPendingPromoId(promoId)
      setDisplayPromos((current) =>
        sortPromos(
          current.map((promo) =>
            promo.id === promoId ? { ...promo, isActive } : promo
          )
        )
      )

      const result = await togglePromoActive(promoId, isActive)
      setPendingPromoId(null)

      if (!result.ok) {
        setDisplayPromos(previousPromos)
        toast.error(result.error ?? "Unable to update promo availability.")
        return
      }

      if (result.promo) {
        setDisplayPromos((current) =>
          sortPromos(
            current.map((promo) =>
              promo.id === result.promo?.id ? result.promo : promo
            )
          )
        )
      }

      toast.success(result.message)
    },
    [displayPromos]
  )

  const productColumns = useMemo<ColumnDef<AdminProductRecord>[]>(
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
                  <DropdownMenuItem onClick={() => openEditProduct(product)}>
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

  const promoColumns = useMemo<ColumnDef<CounterPromo>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Promo" />
        ),
        cell: ({ row }) => (
          <div className="flex min-w-[14rem] flex-col gap-1">
            <span className="text-foreground font-medium">
              {row.original.name}
            </span>
            <span className="text-muted-foreground text-sm">
              {formatPromoType(row.original.promoType)} •{" "}
              {getPromoSummary(row.original)}
            </span>
          </div>
        ),
      },
      {
        id: "schedule",
        accessorFn: (row) => `${row.startsOn} ${row.endsOn}`,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date Range" />
        ),
        cell: ({ row }) => (
          <div className="text-sm">
            <p className="text-foreground font-medium">
              {row.original.startsOn}
            </p>
            <p className="text-muted-foreground">to {row.original.endsOn}</p>
          </div>
        ),
      },
      {
        id: "products",
        accessorFn: (row) => getPromoProductsSummary(row),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Products" />
        ),
        cell: ({ row }) => (
          <p className="text-muted-foreground max-w-[24rem] text-sm">
            {getPromoProductsSummary(row.original)}
          </p>
        ),
      },
      {
        id: "criteria",
        accessorFn: (row) => getPromoCriteriaSummary(row),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Criteria" />
        ),
        cell: ({ row }) => (
          <div className="flex min-w-[12rem] flex-col gap-1">
            <span className="text-muted-foreground text-sm">
              {getPromoCriteriaSummary(row.original)}
            </span>
            {row.original.requiresAdminApproval ? (
              <Badge variant="outline" className="w-fit">
                Needs approval
              </Badge>
            ) : (
              <Badge variant="secondary" className="w-fit">
                Direct apply
              </Badge>
            )}
          </div>
        ),
      },
      {
        id: "status",
        accessorFn: (row) => (row.isActive ? "active" : "inactive"),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "default" : "outline"}>
            {row.original.isActive ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const promo = row.original
          const pending = pendingPromoId === promo.id

          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon-sm" />}
                >
                  <Ellipsis />
                  <span className="sr-only">Open promo actions</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEditPromo(promo)}>
                    <Edit data-icon="inline-start" />
                    Edit Promo
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={pending}
                    onClick={() => handlePromoToggle(promo.id, !promo.isActive)}
                  >
                    {pending ? (
                      <Loader2
                        data-icon="inline-start"
                        className="animate-spin"
                      />
                    ) : promo.isActive ? (
                      <EyeOff data-icon="inline-start" />
                    ) : (
                      <Eye data-icon="inline-start" />
                    )}
                    {promo.isActive ? "Disable Promo" : "Enable Promo"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [handlePromoToggle, pendingPromoId]
  )

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value ?? "catalog")}
      className="app-page flex flex-col gap-6"
    >
      <header className="app-screen-header">
        <div className="app-screen-copy gap-4">
          <div>
            <h1 className="app-screen-title">Product Management</h1>
            <p className="app-screen-description">
              Manage the Counter catalog and the promos employees can apply in
              cart.
            </p>
          </div>
          <TabsList>
            <TabsTrigger value="catalog">Catalog</TabsTrigger>
            <TabsTrigger value="promos">Promos</TabsTrigger>
          </TabsList>
        </div>

        <Button
          type="button"
          size="lg"
          onClick={
            activeTab === "catalog" ? openCreateProduct : openCreatePromo
          }
        >
          <Plus data-icon="inline-start" />
          {activeTab === "catalog" ? "Add Product" : "Add Promo"}
        </Button>
      </header>

      <TabsContent value="catalog">
        <Card>
          <CardHeader>
            <CardTitle>Catalog</CardTitle>
            <CardDescription>
              Search by product name or category.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={productColumns}
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
      </TabsContent>

      <TabsContent value="promos">
        <Card>
          <CardHeader>
            <CardTitle>Promos</CardTitle>
            <CardDescription>
              Configure discounts, bundles, and free-item mechanics for Counter.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={promoColumns}
              data={displayPromos}
              searchPlaceholder="Search promos"
              getSearchText={(row) =>
                [
                  row.name,
                  row.promoType,
                  getPromoSummary(row),
                  getPromoProductsSummary(row),
                  getPromoCriteriaSummary(row),
                  row.requiresAdminApproval ? "requires approval" : "direct",
                  row.isActive ? "active" : "inactive",
                  row.startsOn,
                  row.endsOn,
                ].join(" ")
              }
              emptyMessage="No promos match the current search."
              initialSorting={[
                { id: "status", desc: false },
                { id: "schedule", desc: true },
              ]}
              toolbarContent={
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <CalendarRange className="h-4 w-4" />
                  Active promos appear in Counter immediately.
                </div>
              }
            />
          </CardContent>
        </Card>
      </TabsContent>

      <ProductFormSheet
        open={productFormOpen}
        onOpenChange={setProductFormOpen}
        product={editingProduct}
        onOptimisticSave={handleOptimisticSave}
        onSaved={(product) => {
          const optimisticId = optimisticProductIdRef.current
          optimisticProductIdRef.current = null
          setProductFormOpen(false)
          setDisplayProducts((current) =>
            sortProducts([
              product,
              ...current.filter(
                (entry) => entry.id !== product.id && entry.id !== optimisticId
              ),
            ])
          )
        }}
      />

      <PromoFormSheet
        open={promoFormOpen}
        onOpenChange={setPromoFormOpen}
        promo={editingPromo}
        products={products}
        onSaved={(promo) => {
          setPromoFormOpen(false)
          setDisplayPromos((current) =>
            sortPromos([
              promo,
              ...current.filter((entry) => entry.id !== promo.id),
            ])
          )
        }}
      />
    </Tabs>
  )
}
