"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  createBooth,
  updateBooth,
  type BoothFormInput,
} from "@/app/actions/adminBooths"
import { BoothLocationPicker } from "@/components/admin/BoothLocationPicker"
import type { Booth } from "@/lib/shifts"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"

type BoothFormSheetProps = {
  booth: Booth | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (booth: Booth) => void
}

const blankBoothForm: BoothFormInput = {
  name: "",
  locationText: "",
  googleMapsUrl: "",
  latitude: "",
  longitude: "",
}

function boothToForm(booth: Booth | null): BoothFormInput {
  if (!booth) {
    return blankBoothForm
  }

  return {
    id: booth.id,
    name: booth.name,
    locationText: booth.location_text ?? "",
    googleMapsUrl: booth.google_maps_url ?? "",
    latitude: booth.location_lat ?? "",
    longitude: booth.location_lng ?? "",
  }
}

export function BoothFormSheet({
  booth,
  open,
  onOpenChange,
  onSaved,
}: BoothFormSheetProps) {
  const [form, setForm] = useState<BoothFormInput>(() => boothToForm(booth))
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(boothToForm(booth))
    }
  }, [booth, open])

  const setValue = (field: keyof BoothFormInput, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const setLocationFromMap = (value: {
    googleMapsUrl: string
    latitude: string
    locationText: string
    longitude: string
  }) => {
    setForm((current) => ({
      ...current,
      googleMapsUrl: value.googleMapsUrl,
      latitude: value.latitude,
      locationText: value.locationText,
      longitude: value.longitude,
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPending(true)

    const result = booth ? await updateBooth(form) : await createBooth(form)
    setPending(false)

    if (!result.ok) {
      toast.error(result.error ?? "Unable to save booth.")
      return
    }

    toast.success(result.message)
    onOpenChange(false)
    if (result.booth) {
      onSaved(result.booth)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full max-w-lg flex-col p-0"
      >
        <div className="border-border shrink-0 border-b px-6 pt-6 pb-5">
          <SheetTitle>{booth ? "Edit Booth" : "Add Booth"}</SheetTitle>
          <SheetDescription>
            Keep booth details and the Maps destination available to scheduled
            employees.
          </SheetDescription>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <form
            id="booth-form"
            className="flex flex-col gap-6 p-6"
            onSubmit={handleSubmit}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="booth-name">Booth name</FieldLabel>
                <Input
                  id="booth-name"
                  required
                  value={form.name}
                  onChange={(event) => setValue("name", event.target.value)}
                  placeholder="Mini's Pastries - Main Hall"
                />
              </Field>
              <Field>
                <BoothLocationPicker
                  key={`${booth?.id ?? "new"}-${open ? "open" : "closed"}`}
                  boothName={form.name}
                  disabled={pending}
                  googleMapsUrl={form.googleMapsUrl}
                  latitude={form.latitude}
                  locationText={form.locationText}
                  longitude={form.longitude}
                  onPlaceSelected={setLocationFromMap}
                />
              </Field>
            </FieldGroup>
          </form>
        </div>
        <footer className="border-border flex shrink-0 justify-end gap-2 border-t p-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form="booth-form" disabled={pending}>
            {pending ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : null}
            {booth ? "Save Booth" : "Create Booth"}
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  )
}
