"use client"

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"
import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  toolbarContent?: ReactNode
  searchPlaceholder?: string
  emptyMessage?: string
  initialSorting?: SortingState
  initialVisibility?: VisibilityState
  pageSize?: number
  showSearch?: boolean
  showColumnVisibility?: boolean
  enablePagination?: boolean
  isLoading?: boolean
  loadingRowCount?: number
  getSearchText?: (row: TData) => string
}

function getSearchableText(value: unknown): string {
  if (value === null || value === undefined) {
    return ""
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.map((entry) => getSearchableText(entry)).join(" ")
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map((entry) => getSearchableText(entry))
      .join(" ")
  }

  return ""
}

function getColumnLabel(columnId: string) {
  return columnId
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function renderSkeletonCell(columnId: string, cellIndex: number) {
  if (columnId === "select") {
    return <Skeleton className="h-4 w-4 rounded-sm" />
  }

  if (columnId === "actions") {
    return (
      <div className="flex justify-end">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    )
  }

  if (cellIndex === 0) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-40 max-w-full" />
        <Skeleton className="h-3 w-24 max-w-full" />
      </div>
    )
  }

  const widths = ["w-24", "w-32", "w-20", "w-28", "w-36"]

  return (
    <Skeleton
      className={`h-4 max-w-full ${widths[cellIndex % widths.length]}`}
    />
  )
}

export function DataTable<TData, TValue>({
  columns,
  data,
  toolbarContent,
  searchPlaceholder = "Search records",
  emptyMessage = "No matching records found.",
  initialSorting = [],
  initialVisibility = {},
  pageSize = 10,
  showSearch = true,
  showColumnVisibility = true,
  enablePagination = true,
  isLoading = false,
  loadingRowCount = pageSize,
  getSearchText,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [columnVisibility, setColumnVisibility] =
    useState<VisibilityState>(initialVisibility)
  const [globalFilter, setGlobalFilter] = useState("")
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  })
  const deferredGlobalFilter = useDeferredValue(globalFilter)
  const searchTextCache = useMemo(() => {
    const nextCache = new WeakMap<object, string>()

    for (const row of data) {
      if (typeof row === "object" && row !== null) {
        nextCache.set(
          row,
          (getSearchText ? getSearchText(row) : getSearchableText(row))
            .toLowerCase()
            .trim()
        )
      }
    }

    return nextCache
  }, [data, getSearchText])

  const getCachedSearchText = (row: TData) => {
    if (typeof row === "object" && row !== null) {
      const cached = searchTextCache.get(row)
      if (cached !== undefined) {
        return cached
      }

      return (getSearchText ? getSearchText(row) : getSearchableText(row))
        .toLowerCase()
        .trim()
    }

    return (getSearchText ? getSearchText(row) : getSearchableText(row))
      .toLowerCase()
      .trim()
  }

  useEffect(() => {
    setPagination((current) =>
      current.pageSize === pageSize
        ? { ...current, pageIndex: 0 }
        : { pageIndex: 0, pageSize }
    )
  }, [data, deferredGlobalFilter, pageSize, sorting])

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      globalFilter: deferredGlobalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = String(filterValue).trim().toLowerCase()
      if (!search) {
        return true
      }

      return getCachedSearchText(row.original).includes(search)
    },
  })

  const hideableColumns = table
    .getAllColumns()
    .filter((column) => column.getCanHide())

  const visibleColumns = table.getVisibleLeafColumns()
  const visibleColumnCount = visibleColumns.length || 1
  const showToolbar =
    showSearch || showColumnVisibility || Boolean(toolbarContent)
  const filteredRowCount = table.getFilteredRowModel().rows.length
  const showPagination =
    !isLoading && enablePagination && table.getPageCount() > 1 && filteredRowCount > 0

  return (
    <div className="min-w-0 flex flex-col gap-4">
      {showToolbar ? (
        <div className="app-panel-muted flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {showSearch ? (
              <Input
                type="search"
                value={globalFilter}
                onChange={(event) => setGlobalFilter(event.target.value)}
                placeholder={searchPlaceholder}
                className="bg-background/90 w-full sm:max-w-sm"
              />
            ) : null}
            {toolbarContent}
          </div>

          {showColumnVisibility && hideableColumns.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                  />
                }
              >
                <SlidersHorizontal data-icon="inline-start" />
                Columns
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {hideableColumns.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(checked) =>
                      column.toggleVisibility(Boolean(checked))
                    }
                  >
                    {getColumnLabel(column.id)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      ) : null}

      <div className="border-border/70 bg-card overflow-hidden rounded-[calc(var(--radius)+0.15rem)] border">
        <Table>
          <TableHeader className="bg-muted/40">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: loadingRowCount }).map((_, rowIndex) => (
                <TableRow key={`skeleton-${rowIndex}`}>
                  {visibleColumns.map((column, cellIndex) => (
                    <TableCell key={column.id}>
                      {renderSkeletonCell(column.id, cellIndex)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={visibleColumnCount}
                  className="text-muted-foreground h-32 text-center text-sm"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-muted-foreground bg-muted/25 flex flex-col gap-3 rounded-[calc(var(--radius)-0.25rem)] px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        {isLoading ? (
          <Skeleton className="h-4 w-20" />
        ) : (
          <p>
            {filteredRowCount} result
            {filteredRowCount === 1 ? "" : "s"}
          </p>
        )}

        {showPagination ? (
          <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
            <span className="text-muted-foreground text-xs tracking-[0.18em] uppercase">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeft />
              <span className="sr-only">Previous page</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              <ChevronRight />
              <span className="sr-only">Next page</span>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
