"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type SingleSelectOption = {
  value: string
  label: string
}

type SingleSelectProps = {
  value: string
  onChange: (nextValue: string) => void
  options: SingleSelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  contentClassName?: string
}

function SingleSelect({
  value,
  onChange,
  options,
  placeholder = "Select an option",
  disabled = false,
  className,
  triggerClassName,
  contentClassName,
}: SingleSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selectedLabel = useMemo(
    () =>
      options.find((option) => option.value === value)?.label ?? placeholder,
    [options, placeholder, value]
  )

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

  const handleSelect = (nextValue: string) => {
    if (disabled) {
      return
    }

    onChange(nextValue)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "h-10 w-full justify-between rounded-[calc(var(--radius)-0.2rem)] px-3",
          !value && "text-muted-foreground",
          triggerClassName
        )}
      >
        <span className="truncate">{selectedLabel}</span>
        {open ? <ChevronUpIcon /> : <ChevronDownIcon />}
      </Button>

      {open ? (
        <div
          className={cn(
            "border-border bg-popover absolute top-full right-0 left-0 z-50 mt-2 max-h-64 overflow-y-auto rounded-[calc(var(--radius)-0.2rem)] border p-1 shadow-md",
            contentClassName
          )}
        >
          <div role="listbox" className="flex flex-col gap-1">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={value === option.value}
                onClick={() => handleSelect(option.value)}
                className={cn(
                  "hover:bg-muted rounded-md px-3 py-2 text-left text-sm transition-colors",
                  value === option.value && "bg-primary/10 text-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export { SingleSelect }
