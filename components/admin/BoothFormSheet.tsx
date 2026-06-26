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
import {
  extractOptimisticRollback,
  type OptimisticMutationHandler,
} from "@/lib/optimistic"

type BoothFormSheetProps = {
  booth: Booth | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (booth: Booth) => void
  onOptimisticSave?: OptimisticMutationHandler<BoothFormInput>
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
    latitude:
      booth.location_lat === null ? "" : String(booth.location_lat),
    longitude:
      booth.location_lng === null ? "" : String(booth.location_lng),
  }
}

export function BoothFormSheet({
  booth,
  open,
  onOpenChange,
  onSaved,
  onOptimisticSave,
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
    const rollback = extractOptimisticRollback(onOptimisticSave?.(form))
    setPending(true)

    const result = booth ? await updateBooth(form) : await createBooth(form)
    setPending(false)

    if (!result.ok) {
      rollback?.()
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
        className="app-sheet-content max-w-lg"
      >
        <div className="app-sheet-header">
          <SheetTitle>{booth ? "Edit Booth" : "Add Booth"}</SheetTitle>
          <SheetDescription>
            Keep booth details and the Maps destination available to scheduled
            employees.
          </SheetDescription>
        </div>
        <div className="app-sheet-body">
          <form
            id="booth-form"
            className="app-sheet-form"
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
        <footer className="app-sheet-footer">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="booth-form"
            className="w-full sm:w-auto"
            disabled={pending}
          >
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
