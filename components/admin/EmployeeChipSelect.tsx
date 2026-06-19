"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type EmployeeChipSelectOption = {
  value: string
  label: string
  description?: string
}

type EmployeeChipSelectBaseProps = {
  options: EmployeeChipSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
}

type EmployeeChipSelectProps =
  | (EmployeeChipSelectBaseProps & {
      mode: "single"
      value: string
      onChange: (value: string) => void
    })
  | (EmployeeChipSelectBaseProps & {
      mode?: "multiple"
      value: string[]
      onChange: (value: string[]) => void
    })

export function EmployeeChipSelect(props: EmployeeChipSelectProps) {
  const {
    options,
    placeholder = "Select employees",
    searchPlaceholder = "Search employees",
    emptyMessage = "No employees found.",
    disabled = false,
    className,
  } = props
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const rootRef = useRef<HTMLDivElement>(null)

  const selectedOptions = useMemo(() => {
    if (props.mode === "single") {
      const selectedOption = options.find(
        (option) => option.value === props.value
      )
      return selectedOption ? [selectedOption] : []
    }

    const selectedValues = new Set(props.value)
    return options.filter((option) => selectedValues.has(option.value))
  }, [options, props.mode, props.value])

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) {
      return options
    }

    return options.filter((option) => {
      const labelMatch = option.label.toLowerCase().includes(normalized)
      const descriptionMatch =
        option.description?.toLowerCase().includes(normalized) ?? false
      return labelMatch || descriptionMatch
    })
  }, [options, query])

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [open])

  const selectOption = (optionValue: string) => {
    if (disabled) {
      return
    }

    if (props.mode === "single") {
      props.onChange(optionValue)
      setOpen(false)
      setQuery("")
      return
    }

    if (props.value.includes(optionValue)) {
      props.onChange(props.value.filter((id) => id !== optionValue))
      return
    }

    props.onChange([...props.value, optionValue])
  }

  return (
    <div ref={rootRef} className={cn("w-full", className)}>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "h-auto min-h-11 w-full justify-between rounded-[calc(var(--radius)-0.25rem)] px-3 py-2",
          selectedOptions.length === 0 && "text-muted-foreground"
        )}
      >
        {selectedOptions.length === 0 ? (
          <span className="line-clamp-1 text-left">{placeholder}</span>
        ) : (
          <div className="flex flex-1 flex-wrap gap-1.5">
            {selectedOptions.slice(0, 3).map((option) => (
              <Badge key={option.value} variant="secondary">
                {option.label}
              </Badge>
            ))}
            {selectedOptions.length > 3 ? (
              <Badge variant="outline">+{selectedOptions.length - 3}</Badge>
            ) : null}
          </div>
        )}
        {open ? <ChevronUpIcon /> : <ChevronDownIcon />}
      </Button>

      {open ? (
        <div className="border-border bg-popover mt-2 rounded-[calc(var(--radius)-0.25rem)] border p-2 shadow-sm">
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            disabled={disabled}
            className="h-10"
          />
          <div
            role="listbox"
            aria-multiselectable={props.mode !== "single"}
            className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto"
          >
            {filteredOptions.map((option) => {
              const selected =
                props.mode === "single"
                  ? props.value === option.value
                  : props.value.includes(option.value)

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => selectOption(option.value)}
                  className={cn(
                    "hover:bg-muted flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                    selected && "bg-primary/10"
                  )}
                >
                  <Checkbox
                    checked={selected}
                    aria-label={option.label}
                    className="mt-0.5"
                  />
                  <span className="flex flex-col">
                    <span className="text-foreground font-medium">
                      {option.label}
                    </span>
                    {option.description ? (
                      <span className="text-muted-foreground text-xs">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                </button>
              )
            })}
            {filteredOptions.length === 0 ? (
              <p className="text-muted-foreground px-2 py-2 text-sm">
                {emptyMessage}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
