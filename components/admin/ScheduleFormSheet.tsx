"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  saveBoothSchedule,
  type ScheduleFormInput,
} from "@/app/actions/adminBooths"
import { EmployeeChipSelect } from "@/components/admin/EmployeeChipSelect"
import type { AdminEmployeeOption, AdminSchedule } from "@/lib/adminBooths"
import type { Booth } from "@/lib/shifts"
import { getBusinessDate, hasBusinessShiftStarted } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  DateRangePicker,
  type DateRangePickerValue,
} from "@/components/ui/date-range-picker"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { TimeSelect } from "@/components/ui/time-select"

type ScheduleFormSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule: AdminSchedule | null
  initialBoothId: string
  boothLocked?: boolean
  booths: Booth[]
  employees: AdminEmployeeOption[]
  onSaved: () => void
}

export function ScheduleFormSheet({
  open,
  onOpenChange,
  schedule,
  initialBoothId,
  boothLocked = false,
  booths,
  employees,
  onSaved,
}: ScheduleFormSheetProps) {
  const businessDate = getBusinessDate()
  const [boothId, setBoothId] = useState(initialBoothId)
  const [employeeIds, setEmployeeIds] = useState<string[]>([])
  const [operatorEmployeeId, setOperatorEmployeeId] = useState("")
  const [date, setDate] = useState(businessDate)
  const [dateRange, setDateRange] = useState<DateRangePickerValue>({
    startDate: businessDate,
    endDate: businessDate,
  })
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("17:00")
  const [pending, setPending] = useState(false)

  const isEditing = Boolean(schedule?.id)
  const startedShiftLocked = schedule
    ? hasBusinessShiftStarted(schedule.date, schedule.start_time)
    : false

  const lockedBoothName =
    booths.find((booth) => booth.id === boothId)?.name ?? "Unknown booth"

  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => ({
        value: employee.id,
        label: employee.name,
        description: employee.email,
      })),
    [employees]
  )
  const boothOptions = useMemo(
    () =>
      booths.map((booth) => ({
        value: booth.id,
        label: booth.name,
        description: booth.location_text ?? undefined,
      })),
    [booths]
  )

  const operatorOptions = useMemo(
    () =>
      employees
        .filter((employee) => employeeIds.includes(employee.id))
        .map((employee) => ({
          value: employee.id,
          label: employee.name,
          description: employee.email,
        })),
    [employeeIds, employees]
  )

  useEffect(() => {
    if (!open) {
      return
    }

    const initialDate = schedule?.date ?? getBusinessDate()

    setBoothId(schedule?.booth_id ?? initialBoothId)
    setEmployeeIds(
      schedule?.booth_schedule_assignments.map(
        (assignment) => assignment.employee_id
      ) ?? []
    )
    setOperatorEmployeeId(schedule?.operator_employee_id ?? "")
    setDate(initialDate)
    setDateRange({ startDate: initialDate, endDate: initialDate })
    setStartTime(schedule?.start_time.slice(0, 5) ?? "09:00")
    setEndTime(schedule?.end_time.slice(0, 5) ?? "17:00")
  }, [initialBoothId, open, schedule])

  const handleEmployeeChange = (nextEmployeeIds: string[]) => {
    setEmployeeIds(nextEmployeeIds)
    if (!nextEmployeeIds.includes(operatorEmployeeId)) {
      setOperatorEmployeeId("")
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const baseInput = {
      boothId,
      employeeIds,
      operatorEmployeeId,
      startTime,
      endTime,
    }

    const input: ScheduleFormInput = schedule?.id
      ? {
          ...baseInput,
          id: schedule.id,
          date,
        }
      : {
          ...baseInput,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }

    setPending(true)
    const result = await saveBoothSchedule(input)
    setPending(false)

    if (!result.ok) {
      toast.error(result.error ?? "Unable to save shift.")
      return
    }

    toast.success(result.message)
    onOpenChange(false)
    onSaved()
  }

  const submitDisabled =
    pending ||
    !boothId ||
    (isEditing ? !date : !dateRange.startDate || !dateRange.endDate)

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal="trap-focus">
      <SheetContent
        side="right"
        className="flex h-full w-full max-w-xl flex-col p-0"
      >
        <div className="border-border shrink-0 border-b px-6 pt-6 pb-5">
          <SheetTitle>{schedule ? "Edit Shift" : "Schedule Shift"}</SheetTitle>
          <SheetDescription>
            Assign the booth team and time slot. A shift can stay unassigned
            until someone is chosen as the POS operator.
          </SheetDescription>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <form
            id="schedule-shift-form"
            className="flex flex-col gap-7 p-6"
            onSubmit={handleSubmit}
          >
            <FieldGroup>
              <Field>
                <FieldLabel>Booth</FieldLabel>
                {boothLocked ? (
                  <p className="text-foreground text-sm font-medium">
                    {lockedBoothName}
                  </p>
                ) : booths.length === 0 ? (
                  <FieldDescription>
                    No active booths are available to schedule.
                  </FieldDescription>
                ) : (
                  <EmployeeChipSelect
                    mode="single"
                    options={boothOptions}
                    value={boothId}
                    onChange={setBoothId}
                    placeholder="Select a booth"
                    searchPlaceholder="Search booths"
                    emptyMessage="No booths found."
                    disabled={pending || startedShiftLocked}
                  />
                )}
              </Field>
              <Field>
                <FieldLabel>Employees</FieldLabel>
                {employees.length === 0 ? (
                  <FieldDescription>
                    No active employees are available to assign.
                  </FieldDescription>
                ) : (
                  <EmployeeChipSelect
                    mode="multiple"
                    options={employeeOptions}
                    value={employeeIds}
                    onChange={handleEmployeeChange}
                    placeholder="Select employees"
                    disabled={pending}
                  />
                )}
                <FieldDescription>
                  Leave this empty to keep the shift open for later pickup.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel>POS Operator</FieldLabel>
                {employeeIds.length === 0 ? (
                  <FieldDescription>
                    Choose assigned employees first if you want to set a POS
                    operator now.
                  </FieldDescription>
                ) : null}
                <div className="flex flex-col gap-2">
                  <EmployeeChipSelect
                    mode="single"
                    options={operatorOptions}
                    value={operatorEmployeeId}
                    onChange={setOperatorEmployeeId}
                    placeholder="No POS operator yet"
                    searchPlaceholder="Search operators"
                    emptyMessage="No operators found."
                    disabled={pending || employeeIds.length === 0}
                  />
                  {operatorEmployeeId ? (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => setOperatorEmployeeId("")}
                      >
                        Clear POS operator
                      </Button>
                    </div>
                  ) : null}
                </div>
                <FieldDescription>
                  Assigned employees can stay on the team even when no POS
                  operator is selected yet.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel>{isEditing ? "Date" : "Date range"}</FieldLabel>
                {isEditing ? (
                  <DateRangePicker
                    mode="single"
                    value={date}
                    onChange={setDate}
                    disabled={pending || startedShiftLocked}
                    minDate={getBusinessDate()}
                  />
                ) : (
                  <>
                    <DateRangePicker
                      value={dateRange}
                      onChange={setDateRange}
                      disabled={pending}
                      minDate={getBusinessDate()}
                    />
                    <FieldDescription>
                      Creates one shift per day in this range.
                    </FieldDescription>
                  </>
                )}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel>Start time</FieldLabel>
                  <TimeSelect
                    value={startTime}
                    onChange={setStartTime}
                    disabled={pending || startedShiftLocked}
                    stepMinutes={30}
                  />
                </Field>
                <Field>
                  <FieldLabel>End time</FieldLabel>
                  <TimeSelect
                    value={endTime}
                    onChange={setEndTime}
                    disabled={pending || startedShiftLocked}
                    stepMinutes={30}
                  />
                </Field>
              </div>
              {startedShiftLocked ? (
                <FieldDescription>
                  This shift has already started, so only the team and POS
                  operator can be changed now.
                </FieldDescription>
              ) : null}
              <FieldDescription>
                Opening inventory and sales are entered only by the current POS
                operator while this shift is active.
              </FieldDescription>
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
          <Button
            type="submit"
            form="schedule-shift-form"
            disabled={submitDisabled}
          >
            {pending ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : null}
            {schedule ? "Save Shift" : "Create Shift"}
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  )
}
