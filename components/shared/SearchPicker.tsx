"use client"

import { useMemo, useState } from "react"
import { X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FieldDescription } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type SearchPickerOption = {
  value: string
  label: string
  description?: string
}

const LARGE_LIST_THRESHOLD = 20
const MAX_VISIBLE_RESULTS = 50

type SearchPickerBaseProps = {
  options: SearchPickerOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
}

type SearchPickerSingleProps = SearchPickerBaseProps & {
  mode: "single"
  value: string
  onChange: (value: string) => void
}

type SearchPickerMultipleProps = SearchPickerBaseProps & {
  mode: "multiple"
  value: string[]
  onChange: (value: string[]) => void
}

export type SearchPickerProps =
  | SearchPickerSingleProps
  | SearchPickerMultipleProps

function normalizeQuery(query: string) {
  return query.trim().toLowerCase()
}

function matchesQuery(option: SearchPickerOption, query: string) {
  if (!query) {
    return true
  }

  return (
    option.label.toLowerCase().includes(query) ||
    (option.description?.toLowerCase().includes(query) ?? false)
  )
}

export function SearchPicker(props: SearchPickerProps) {
  const {
    options,
    placeholder = "None selected",
    searchPlaceholder = "Search…",
    emptyMessage = "No matches found.",
    disabled = false,
    className,
  } = props
  const [query, setQuery] = useState("")
  const normalizedQuery = normalizeQuery(query)
  const isLargeList = options.length > LARGE_LIST_THRESHOLD
  const requiresSearch = isLargeList && normalizedQuery.length === 0

  const optionByValue = useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options]
  )

  const selectedOptions = useMemo(() => {
    if (props.mode === "single") {
      const selected = optionByValue.get(props.value)
      return selected ? [selected] : []
    }

    return props.value
      .map((value) => optionByValue.get(value))
      .filter((option): option is SearchPickerOption => option !== undefined)
  }, [optionByValue, props])

  const visibleOptions = useMemo(() => {
    if (requiresSearch) {
      return []
    }

    const selectedValues = new Set(
      props.mode === "multiple" ? props.value : [props.value].filter(Boolean)
    )

    return options
      .filter((option) => matchesQuery(option, normalizedQuery))
      .filter((option) =>
        props.mode === "multiple" ? !selectedValues.has(option.value) : true
      )
      .slice(0, MAX_VISIBLE_RESULTS)
  }, [normalizedQuery, options, props, requiresSearch])

  const removeSelected = (value: string) => {
    if (props.mode !== "multiple" || disabled) {
      return
    }

    props.onChange(props.value.filter((id) => id !== value))
  }

  const toggleOption = (value: string) => {
    if (disabled) {
      return
    }

    if (props.mode === "single") {
      props.onChange(value)
      setQuery("")
      return
    }

    if (props.value.includes(value)) {
      props.onChange(props.value.filter((id) => id !== value))
      return
    }

    props.onChange([...props.value, value])
  }

  const selectedLabel =
    props.mode === "single"
      ? (selectedOptions[0]?.label ?? placeholder)
      : selectedOptions.length === 0
        ? placeholder
        : `${selectedOptions.length} selected`

  return (
    <div
      className={cn(
        "border-border flex flex-col gap-2 rounded-[calc(var(--radius)-0.25rem)] border p-3",
        disabled && "pointer-events-none opacity-50",
        className
      )}
    >
      {props.mode === "single" ? (
        <p className="text-foreground text-sm font-medium">{selectedLabel}</p>
      ) : selectedOptions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedOptions.map((option) => (
            <Badge
              key={option.value}
              variant="secondary"
              className="gap-1 pr-1"
            >
              {option.label}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="hover:bg-background/80 h-5 w-5 rounded-full p-0"
                aria-label={`Remove ${option.label}`}
                onClick={() => removeSelected(option.value)}
              >
                <X className="size-3" />
              </Button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">{placeholder}</p>
      )}

      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={searchPlaceholder}
        disabled={disabled}
        aria-label={searchPlaceholder}
      />

      {requiresSearch ? (
        <FieldDescription>
          {options.length} items — type to search and narrow the list.
        </FieldDescription>
      ) : null}

      {visibleOptions.length > 0 ? (
        <ul
          className="border-border/80 max-h-48 overflow-y-auto overscroll-contain rounded-md border"
          role="listbox"
          aria-label="Search results"
        >
          {visibleOptions.map((option) => {
            const isSelected =
              props.mode === "single"
                ? props.value === option.value
                : props.value.includes(option.value)

            return (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    "hover:bg-muted flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm transition-colors",
                    isSelected && "bg-primary/10 text-foreground"
                  )}
                  onClick={() => toggleOption(option.value)}
                >
                  <span className="font-medium">{option.label}</span>
                  {option.description ? (
                    <span className="text-muted-foreground text-xs">
                      {option.description}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : requiresSearch ? null : (
        <FieldDescription>{emptyMessage}</FieldDescription>
      )}
    </div>
  )
}
