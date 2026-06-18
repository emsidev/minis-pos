"use client"

import { useMemo } from "react"

import {
  SingleSelect,
  type SingleSelectOption,
} from "@/components/ui/single-select"

type TimeSelectProps = {
  value: string
  onChange: (nextValue: string) => void
  disabled?: boolean
  placeholder?: string
  stepMinutes?: 15 | 30 | 60
}

function buildTimeOptions(stepMinutes: number) {
  const values: string[] = []
  const totalMinutes = 24 * 60

  for (let minutes = 0; minutes < totalMinutes; minutes += stepMinutes) {
    const hourValue = String(Math.floor(minutes / 60)).padStart(2, "0")
    const minuteValue = String(minutes % 60).padStart(2, "0")
    values.push(`${hourValue}:${minuteValue}`)
  }

  return values
}

function TimeSelect({
  value,
  onChange,
  disabled = false,
  placeholder = "Select time",
  stepMinutes = 30,
}: TimeSelectProps) {
  const options = useMemo<SingleSelectOption[]>(
    () =>
      buildTimeOptions(stepMinutes).map((option) => ({
        value: option,
        label: option,
      })),
    [stepMinutes]
  )

  return (
    <SingleSelect
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      disabled={disabled}
    />
  )
}

export { TimeSelect }
