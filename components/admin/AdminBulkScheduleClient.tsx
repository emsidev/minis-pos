"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Loader2,
  Lock,
  Plus,
  RefreshCcw,
  Save,
  Trash2,
  WandSparkles,
} from "lucide-react"
import { toast } from "sonner"

import {
  loadBulkScheduleRows,
  saveBulkScheduleRows,
} from "@/app/actions/adminBooths"
import { EmployeeChipSelect } from "@/components/admin/EmployeeChipSelect"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DateRangePicker,
  type DateRangePickerValue,
} from "@/components/ui/date-range-picker"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  SingleSelect,
  type SingleSelectOption,
} from "@/components/ui/single-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TimeSelect } from "@/components/ui/time-select"
import type {
  AdminEmployeeOption,
  BulkScheduleEditableRow,
} from "@/lib/adminBooths"
import type { Booth } from "@/lib/shifts"
import { cn, getBusinessDate } from "@/lib/utils"

type BulkMode = "add" | "edit"

type RowSaveState = "idle" | "dirty" | "saving" | "saved" | "error"

type BulkScheduleRowState = BulkScheduleEditableRow & {
  rowKey: string
  persisted: boolean
  saveState: RowSaveState
  error: string | null
  note: string | null
  original: BulkScheduleEditableRow
}

type RowCorePatch = Partial<
  Pick<
    BulkScheduleEditableRow,
    | "boothId"
    | "date"
    | "startTime"
    | "endTime"
    | "employeeIds"
    | "operatorEmployeeId"
  >
>

const DEFAULT_SHIFT_START = "09:00"
const DEFAULT_SHIFT_END = "17:00"
const OPERATOR_UNCHANGED = "__UNCHANGED__"
const OPERATOR_CLEAR = "__CLEAR__"

function getCurrentMonthRange() {
  const [year, month] = getBusinessDate().split("-").map(Number)
  const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const paddedMonth = String(month).padStart(2, "0")

  return {
    startDate: `${year}-${paddedMonth}-01`,
    endDate: `${year}-${paddedMonth}-${String(endDay).padStart(2, "0")}`,
  } satisfies DateRangePickerValue
}

function enumerateDateRange(startDate: string, endDate: string) {
  const dates: string[] = []
  const cursor = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return dates
}

function createRowState(
  rowKey: string,
  row: BulkScheduleEditableRow,
  persisted: boolean
): BulkScheduleRowState {
  return {
    rowKey,
    persisted,
    saveState: persisted ? "idle" : "dirty",
    error: null,
    note: null,
    original: row,
    ...row,
  }
}

function toRowSnapshot(row: BulkScheduleRowState): BulkScheduleEditableRow {
  return {
    id: row.id,
    boothId: row.boothId,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    employeeIds: row.employeeIds,
    operatorEmployeeId: row.operatorEmployeeId,
    startedLocked: row.startedLocked,
  }
}

function sameStringArray(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function isSameRow(
  left: BulkScheduleEditableRow,
  right: BulkScheduleEditableRow
) {
  return (
    left.id === right.id &&
    left.boothId === right.boothId &&
    left.date === right.date &&
    left.startTime === right.startTime &&
    left.endTime === right.endTime &&
    sameStringArray(left.employeeIds, right.employeeIds) &&
    left.operatorEmployeeId === right.operatorEmployeeId &&
    left.startedLocked === right.startedLocked
  )
}

function buildRowStatus(row: BulkScheduleRowState) {
  if (row.saveState === "saving") {
    return {
      label: "Saving",
      className: "border-primary/20 bg-primary/10 text-primary",
    }
  }

  if (row.saveState === "error") {
    return {
      label: "Needs Fix",
      className: "border-destructive/25 bg-destructive/10 text-destructive",
    }
  }

  if (row.saveState === "saved") {
    return {
      label: "Saved",
      className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
    }
  }

  if (!row.persisted) {
    return {
      label: "Draft",
      className:
        "border-secondary/20 bg-secondary/10 text-secondary-foreground",
    }
  }

  if (row.startedLocked) {
    return {
      label: "Started",
      className: "border-amber-500/20 bg-amber-500/10 text-amber-800",
    }
  }

  return {
    label: "Scheduled",
    className: "border-primary/15 bg-background text-foreground",
  }
}

type AdminBulkScheduleClientProps = {
  booths: Booth[]
  employees: AdminEmployeeOption[]
}

export function AdminBulkScheduleClient({
  booths,
  employees,
}: AdminBulkScheduleClientProps) {
  const businessDate = getBusinessDate()
  const activeBooths = useMemo(
    () => booths.filter((booth) => booth.is_active),
    [booths]
  )
  const boothOptions = useMemo(
    () =>
      activeBooths.map((booth) => ({
        value: booth.id,
        label: booth.name,
        description: booth.location_text ?? undefined,
      })),
    [activeBooths]
  )
  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => ({
        value: employee.id,
        label: employee.name,
        description: employee.email,
      })),
    [employees]
  )
  const massBoothOptions = useMemo(
    () =>
      [
        { value: "", label: "Keep current booth" },
        ...activeBooths.map((booth) => ({
          value: booth.id,
          label: booth.name,
        })),
      ] satisfies SingleSelectOption[],
    [activeBooths]
  )
  const editRangeDefaults = useMemo(() => getCurrentMonthRange(), [])

  const [mode, setMode] = useState<BulkMode>("add")
  const [rowsByMode, setRowsByMode] = useState<
    Record<BulkMode, BulkScheduleRowState[]>
  >({
    add: [],
    edit: [],
  })
  const [selectedRowKeysByMode, setSelectedRowKeysByMode] = useState<
    Record<BulkMode, string[]>
  >({
    add: [],
    edit: [],
  })
  const [addRange, setAddRange] = useState<DateRangePickerValue>({
    startDate: businessDate,
    endDate: businessDate,
  })
  const [editRange, setEditRange] =
    useState<DateRangePickerValue>(editRangeDefaults)
  const [editBoothIds, setEditBoothIds] = useState<string[]>([])
  const [massBoothId, setMassBoothId] = useState("")
  const [massStartTime, setMassStartTime] = useState("")
  const [massEndTime, setMassEndTime] = useState("")
  const [massReplaceEmployees, setMassReplaceEmployees] = useState(false)
  const [massEmployeeIds, setMassEmployeeIds] = useState<string[]>([])
  const [massOperatorValue, setMassOperatorValue] = useState(OPERATOR_UNCHANGED)
  const [loadingRows, startLoadingRows] = useTransition()
  const [savingRows, startSavingRows] = useTransition()

  const rows = rowsByMode[mode]
  const selectedRowKeys = selectedRowKeysByMode[mode]
  const selectedRowKeySet = useMemo(
    () => new Set(selectedRowKeys),
    [selectedRowKeys]
  )
  const dirtyRows = useMemo(
    () => rows.filter((row) => row.saveState === "dirty"),
    [rows]
  )
  const selectedCount = selectedRowKeys.length
  const allRowsSelected =
    rows.length > 0 && selectedRowKeys.length === rows.length

  const updateRowsForMode = (
    targetMode: BulkMode,
    updater:
      | BulkScheduleRowState[]
      | ((current: BulkScheduleRowState[]) => BulkScheduleRowState[])
  ) => {
    setRowsByMode((current) => ({
      ...current,
      [targetMode]:
        typeof updater === "function" ? updater(current[targetMode]) : updater,
    }))
  }

  const setSelectedRowKeysForMode = (
    targetMode: BulkMode,
    value: string[] | ((current: string[]) => string[])
  ) => {
    setSelectedRowKeysByMode((current) => ({
      ...current,
      [targetMode]:
        typeof value === "function" ? value(current[targetMode]) : value,
    }))
  }

  const updateRow = (rowKey: string, patch: RowCorePatch) => {
    updateRowsForMode(mode, (current) =>
      current.map((row) => {
        if (row.rowKey !== rowKey) {
          return row
        }

        const nextEmployeeIds = patch.employeeIds ?? row.employeeIds
        const nextOperatorEmployeeId = (() => {
          if ("operatorEmployeeId" in patch) {
            return patch.operatorEmployeeId ?? null
          }

          return row.operatorEmployeeId &&
            nextEmployeeIds.includes(row.operatorEmployeeId)
            ? row.operatorEmployeeId
            : null
        })()

        const nextSnapshot: BulkScheduleEditableRow = {
          ...toRowSnapshot(row),
          ...patch,
          employeeIds: nextEmployeeIds,
          operatorEmployeeId: nextOperatorEmployeeId,
        }

        const nextSaveState = row.persisted
          ? isSameRow(nextSnapshot, row.original)
            ? "idle"
            : "dirty"
          : "dirty"

        return {
          ...row,
          ...nextSnapshot,
          saveState: nextSaveState,
          error: null,
          note: null,
        }
      })
    )
  }

  const handleGenerateRows = () => {
    if (!addRange.startDate || !addRange.endDate) {
      toast.error("Pick a date range first.")
      return
    }

    const defaultBoothId = activeBooths[0]?.id ?? ""
    const nextRows = enumerateDateRange(
      addRange.startDate,
      addRange.endDate
    ).map((date) =>
      createRowState(
        `draft-${crypto.randomUUID()}`,
        {
          boothId: defaultBoothId,
          date,
          startTime: DEFAULT_SHIFT_START,
          endTime: DEFAULT_SHIFT_END,
          employeeIds: [],
          operatorEmployeeId: null,
          startedLocked: false,
        },
        false
      )
    )

    updateRowsForMode("add", nextRows)
    setSelectedRowKeysForMode("add", [])
    toast.success(
      nextRows.length === 1
        ? "Generated 1 draft shift row."
        : `Generated ${nextRows.length} draft shift rows.`
    )
  }

  const handleLoadScheduledRows = () => {
    startLoadingRows(async () => {
      try {
        const loadedRows = await loadBulkScheduleRows({
          startDate: editRange.startDate,
          endDate: editRange.endDate,
          boothIds: editBoothIds,
        })

        updateRowsForMode(
          "edit",
          loadedRows.map((row) => createRowState(`loaded-${row.id}`, row, true))
        )
        setSelectedRowKeysForMode("edit", [])
        toast.success(
          loadedRows.length === 0
            ? "No scheduled shifts matched the filters."
            : `Loaded ${loadedRows.length} scheduled shift${loadedRows.length === 1 ? "" : "s"}.`
        )
      } catch (error) {
        console.error("Unable to load bulk schedule rows:", error)
        toast.error("Unable to load scheduled shifts.")
      }
    })
  }

  const handleToggleAllRows = (checked: boolean) => {
    setSelectedRowKeysForMode(
      mode,
      checked ? rows.map((row) => row.rowKey) : []
    )
  }

  const handleToggleRow = (rowKey: string, checked: boolean) => {
    setSelectedRowKeysForMode(mode, (current) =>
      checked
        ? [...current, rowKey]
        : current.filter((entry) => entry !== rowKey)
    )
  }

  const handleResetRow = (rowKey: string) => {
    updateRowsForMode(mode, (current) =>
      current.map((row) => {
        if (row.rowKey !== rowKey) {
          return row
        }

        return {
          ...row,
          ...row.original,
          saveState: row.persisted ? "idle" : "dirty",
          error: null,
          note: null,
        }
      })
    )
  }

  const handleRemoveRow = (rowKey: string) => {
    updateRowsForMode("add", (current) =>
      current.filter((row) => row.rowKey !== rowKey)
    )
    setSelectedRowKeysForMode("add", (current) =>
      current.filter((entry) => entry !== rowKey)
    )
  }

  const clearMassApplyForm = () => {
    setMassBoothId("")
    setMassStartTime("")
    setMassEndTime("")
    setMassReplaceEmployees(false)
    setMassEmployeeIds([])
    setMassOperatorValue(OPERATOR_UNCHANGED)
  }

  const handleApplyMassChanges = () => {
    if (selectedRowKeys.length === 0) {
      toast.error("Select at least one row first.")
      return
    }

    const hasMassChange =
      Boolean(massBoothId) ||
      Boolean(massStartTime) ||
      Boolean(massEndTime) ||
      massReplaceEmployees ||
      massOperatorValue !== OPERATOR_UNCHANGED

    if (!hasMassChange) {
      toast.error("Add at least one bulk change first.")
      return
    }

    let changedRowCount = 0
    let noteCount = 0

    updateRowsForMode(mode, (current) =>
      current.map((row) => {
        if (!selectedRowKeySet.has(row.rowKey)) {
          return row
        }

        const notes: string[] = []
        const nextSnapshot = toRowSnapshot(row)
        const lockCoreFields = row.persisted && row.startedLocked

        if (massBoothId) {
          if (lockCoreFields) {
            notes.push(
              "Booth stayed the same because this shift already started."
            )
          } else {
            nextSnapshot.boothId = massBoothId
          }
        }

        if (massStartTime) {
          if (lockCoreFields) {
            notes.push(
              "Start time stayed the same because this shift already started."
            )
          } else {
            nextSnapshot.startTime = massStartTime
          }
        }

        if (massEndTime) {
          if (lockCoreFields) {
            notes.push(
              "End time stayed the same because this shift already started."
            )
          } else {
            nextSnapshot.endTime = massEndTime
          }
        }

        if (massReplaceEmployees) {
          nextSnapshot.employeeIds = massEmployeeIds
          if (
            nextSnapshot.operatorEmployeeId &&
            !massEmployeeIds.includes(nextSnapshot.operatorEmployeeId)
          ) {
            nextSnapshot.operatorEmployeeId = null
          }
        }

        if (massOperatorValue === OPERATOR_CLEAR) {
          nextSnapshot.operatorEmployeeId = null
        } else if (massOperatorValue !== OPERATOR_UNCHANGED) {
          if (nextSnapshot.employeeIds.includes(massOperatorValue)) {
            nextSnapshot.operatorEmployeeId = massOperatorValue
          } else {
            notes.push(
              "POS operator stayed the same because that person is not on the assigned team."
            )
          }
        }

        const nextSaveState = row.persisted
          ? isSameRow(nextSnapshot, row.original)
            ? "idle"
            : "dirty"
          : "dirty"

        if (!isSameRow(nextSnapshot, toRowSnapshot(row))) {
          changedRowCount += 1
        }

        if (notes.length > 0) {
          noteCount += 1
        }

        return {
          ...row,
          ...nextSnapshot,
          saveState: nextSaveState,
          error: null,
          note: notes.length > 0 ? notes.join(" ") : null,
        }
      })
    )

    clearMassApplyForm()

    if (changedRowCount === 0 && noteCount > 0) {
      toast.message("Bulk changes were skipped on the selected rows.")
      return
    }

    toast.success(
      noteCount > 0
        ? `Updated ${changedRowCount} row${changedRowCount === 1 ? "" : "s"} with ${noteCount} locked-row note${noteCount === 1 ? "" : "s"}.`
        : `Updated ${changedRowCount} selected row${changedRowCount === 1 ? "" : "s"}.`
    )
  }

  const handleSaveDirtyRows = () => {
    if (dirtyRows.length === 0) {
      toast.error("There are no dirty rows to save.")
      return
    }

    const dirtyRowKeys = new Set(dirtyRows.map((row) => row.rowKey))

    updateRowsForMode(mode, (current) =>
      current.map((row) =>
        dirtyRowKeys.has(row.rowKey)
          ? { ...row, saveState: "saving", error: null }
          : row
      )
    )

    startSavingRows(async () => {
      try {
        const results = await saveBulkScheduleRows(
          dirtyRows.map((row) => ({
            rowKey: row.rowKey,
            id: row.id,
            boothId: row.boothId,
            date: row.date,
            startTime: row.startTime,
            endTime: row.endTime,
            employeeIds: row.employeeIds,
            operatorEmployeeId: row.operatorEmployeeId,
          }))
        )

        const resultsByKey = new Map(
          results.map((result) => [result.rowKey, result])
        )
        let successCount = 0
        let failureCount = 0

        updateRowsForMode(mode, (current) =>
          current.map((row) => {
            const result = resultsByKey.get(row.rowKey)
            if (!result) {
              return row
            }

            if (!result.ok || !result.row) {
              failureCount += 1
              return {
                ...row,
                saveState: "error",
                error: result.error ?? "Unable to save this row.",
              }
            }

            successCount += 1
            return {
              ...row,
              ...result.row,
              persisted: true,
              saveState: "saved",
              error: null,
              original: result.row,
            }
          })
        )

        if (failureCount === 0) {
          toast.success(
            successCount === 1
              ? "Saved 1 shift row."
              : `Saved ${successCount} shift rows.`
          )
          return
        }

        toast.message(
          `Saved ${successCount} row${successCount === 1 ? "" : "s"} and left ${failureCount} row${failureCount === 1 ? "" : "s"} for review.`
        )
      } catch (error) {
        console.error("Unable to save bulk schedule rows:", error)
        updateRowsForMode(mode, (current) =>
          current.map((row) =>
            dirtyRowKeys.has(row.rowKey)
              ? {
                  ...row,
                  saveState: "error",
                  error: "Unable to save this row right now.",
                }
              : row
          )
        )
        toast.error("Unable to save the selected rows.")
      }
    })
  }

  return (
    <div className="app-page flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <Button
          render={<Link href="/admin/booths" />}
          nativeButton={false}
          variant="ghost"
          className="w-fit"
        >
          <ArrowLeft data-icon="inline-start" />
          Back to booths
        </Button>
        <div className="app-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div>
            <p className="app-kicker">Admin Workspace</p>
            <h1 className="text-3xl font-semibold">Bulk Shift Scheduling</h1>
            <p className="app-caption">
              Generate or edit multiple scheduled shifts in one table, with
              per-row teams and per-row validation.
            </p>
          </div>
          <div className="grid gap-2 text-sm sm:text-right">
            <div className="bg-muted/60 rounded-xl px-4 py-3">
              <span className="text-foreground font-medium">
                {dirtyRows.length}
              </span>{" "}
              dirty row{dirtyRows.length === 1 ? "" : "s"}
            </div>
            <div className="bg-muted/40 rounded-xl px-4 py-3">
              <span className="text-foreground font-medium">
                {selectedCount}
              </span>{" "}
              selected
            </div>
          </div>
        </div>
      </header>

      <Tabs value={mode} onValueChange={(value) => setMode(value as BulkMode)}>
        <TabsList>
          <TabsTrigger value="add">Bulk Add</TabsTrigger>
          <TabsTrigger value="edit">Bulk Edit</TabsTrigger>
        </TabsList>

        <TabsContent value="add" className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Generate Draft Rows</CardTitle>
              <CardDescription>
                Create one draft row per day, then change booth, time, team, and
                POS operator per row.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="w-full max-w-xl">
                <FieldGroup>
                  <Field>
                    <FieldLabel>Date range</FieldLabel>
                    <DateRangePicker
                      value={addRange}
                      onChange={setAddRange}
                      minDate={businessDate}
                    />
                    <FieldDescription>
                      Draft rows cover every date in the selected range. Remove
                      dates you do not need after generation.
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => updateRowsForMode("add", [])}
                >
                  <RefreshCcw data-icon="inline-start" />
                  Clear Drafts
                </Button>
                <Button type="button" onClick={handleGenerateRows}>
                  <Plus data-icon="inline-start" />
                  Generate Rows
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="edit" className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Load Scheduled Shifts</CardTitle>
              <CardDescription>
                Load scheduled shifts by date range and optional booth filters.
                Started shifts keep booth, date, and time locked.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)_auto]">
                <Field>
                  <FieldLabel>Date range</FieldLabel>
                  <DateRangePicker value={editRange} onChange={setEditRange} />
                </Field>
                <Field>
                  <FieldLabel>Booths</FieldLabel>
                  <EmployeeChipSelect
                    options={boothOptions}
                    value={editBoothIds}
                    onChange={setEditBoothIds}
                    placeholder="All active booths"
                    searchPlaceholder="Search booths"
                    emptyMessage="No booths found."
                  />
                </Field>
                <div className="flex flex-wrap gap-2 self-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      updateRowsForMode("edit", [])
                      setSelectedRowKeysForMode("edit", [])
                    }}
                  >
                    <RefreshCcw data-icon="inline-start" />
                    Clear Results
                  </Button>
                  <Button
                    type="button"
                    disabled={loadingRows}
                    onClick={handleLoadScheduledRows}
                  >
                    {loadingRows ? (
                      <Loader2
                        data-icon="inline-start"
                        className="animate-spin"
                      />
                    ) : null}
                    Load Scheduled Shifts
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Mass Apply</CardTitle>
          <CardDescription>
            Apply the same booth, time, team, or POS operator to the selected
            rows. Locked fields on started shifts are skipped with inline notes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 2xl:grid-cols-[minmax(0,14rem)_minmax(0,11rem)_minmax(0,11rem)_minmax(0,20rem)_minmax(0,16rem)_auto]">
            <Field>
              <FieldLabel>Booth</FieldLabel>
              <SingleSelect
                value={massBoothId}
                onChange={setMassBoothId}
                options={massBoothOptions}
                placeholder="Keep current booth"
              />
            </Field>
            <Field>
              <FieldLabel>Start time</FieldLabel>
              <Input
                type="time"
                step={1800}
                value={massStartTime}
                onChange={(event) => setMassStartTime(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>End time</FieldLabel>
              <Input
                type="time"
                step={1800}
                value={massEndTime}
                onChange={(event) => setMassEndTime(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>Assigned team</FieldLabel>
              <div className="flex flex-col gap-2">
                <label className="text-foreground flex items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={massReplaceEmployees}
                    onCheckedChange={(checked) =>
                      setMassReplaceEmployees(Boolean(checked))
                    }
                  />
                  Replace the full team on selected rows
                </label>
                <EmployeeChipSelect
                  options={employeeOptions}
                  value={massEmployeeIds}
                  onChange={setMassEmployeeIds}
                  placeholder="Leave empty to clear team"
                  disabled={!massReplaceEmployees}
                />
              </div>
            </Field>
            <Field>
              <FieldLabel>POS operator</FieldLabel>
              <SingleSelect
                value={massOperatorValue}
                onChange={setMassOperatorValue}
                options={[
                  { value: OPERATOR_UNCHANGED, label: "Keep current operator" },
                  { value: OPERATOR_CLEAR, label: "Clear operator" },
                  ...employees.map((employee) => ({
                    value: employee.id,
                    label: employee.name,
                  })),
                ]}
              />
            </Field>
            <div className="flex flex-wrap gap-2 self-end">
              <Button
                type="button"
                variant="outline"
                onClick={clearMassApplyForm}
              >
                <RefreshCcw data-icon="inline-start" />
                Clear
              </Button>
              <Button type="button" onClick={handleApplyMassChanges}>
                <WandSparkles data-icon="inline-start" />
                Apply To Selected
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Bulk Schedule Table</CardTitle>
          <CardDescription>
            Save only dirty rows. Successful rows clear, while failed rows stay
            in place with row-level errors.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-muted-foreground text-sm">
              {rows.length === 0
                ? "No rows loaded yet."
                : `${rows.length} row${rows.length === 1 ? "" : "s"} in the table.`}
            </div>
            <Button
              type="button"
              disabled={savingRows || dirtyRows.length === 0}
              onClick={handleSaveDirtyRows}
            >
              {savingRows ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <Save data-icon="inline-start" />
              )}
              Save Dirty Rows
            </Button>
          </div>

          <Table className="min-w-[88rem]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={allRowsSelected}
                    onCheckedChange={(checked) =>
                      handleToggleAllRows(Boolean(checked))
                    }
                    aria-label="Select all rows"
                  />
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Booth</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Assigned Employees</TableHead>
                <TableHead>POS Operator</TableHead>
                <TableHead className="w-[22rem]">Row Feedback</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="text-muted-foreground py-8 text-center"
                  >
                    Generate add rows or load scheduled shifts to start.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const status = buildRowStatus(row)
                  const rowOperatorOptions: SingleSelectOption[] = [
                    { value: "", label: "No POS operator" },
                    ...employees
                      .filter((employee) =>
                        row.employeeIds.includes(employee.id)
                      )
                      .map((employee) => ({
                        value: employee.id,
                        label: employee.name,
                      })),
                  ]

                  return (
                    <TableRow key={row.rowKey}>
                      <TableCell>
                        <Checkbox
                          checked={selectedRowKeySet.has(row.rowKey)}
                          onCheckedChange={(checked) =>
                            handleToggleRow(row.rowKey, Boolean(checked))
                          }
                          aria-label={`Select row for ${row.date}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
                            status.className
                          )}
                        >
                          {row.startedLocked ? (
                            <Lock className="size-3" />
                          ) : null}
                          {status.label}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={row.date}
                          min={businessDate}
                          disabled={row.persisted && row.startedLocked}
                          onChange={(event) =>
                            updateRow(row.rowKey, { date: event.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell className="min-w-60">
                        <EmployeeChipSelect
                          mode="single"
                          options={boothOptions}
                          value={row.boothId}
                          onChange={(value) =>
                            updateRow(row.rowKey, { boothId: value })
                          }
                          placeholder="Select booth"
                          searchPlaceholder="Search booths"
                          emptyMessage="No booths found."
                          disabled={row.persisted && row.startedLocked}
                        />
                      </TableCell>
                      <TableCell>
                        <TimeSelect
                          value={row.startTime}
                          onChange={(value) =>
                            updateRow(row.rowKey, { startTime: value })
                          }
                          stepMinutes={30}
                          disabled={row.persisted && row.startedLocked}
                        />
                      </TableCell>
                      <TableCell>
                        <TimeSelect
                          value={row.endTime}
                          onChange={(value) =>
                            updateRow(row.rowKey, { endTime: value })
                          }
                          stepMinutes={30}
                          disabled={row.persisted && row.startedLocked}
                        />
                      </TableCell>
                      <TableCell className="min-w-80">
                        <EmployeeChipSelect
                          options={employeeOptions}
                          value={row.employeeIds}
                          onChange={(value) =>
                            updateRow(row.rowKey, { employeeIds: value })
                          }
                          placeholder="Select employees"
                        />
                      </TableCell>
                      <TableCell className="min-w-56">
                        <SingleSelect
                          value={row.operatorEmployeeId ?? ""}
                          onChange={(value) =>
                            updateRow(row.rowKey, {
                              operatorEmployeeId: value || null,
                            })
                          }
                          options={rowOperatorOptions}
                          placeholder="No POS operator"
                          disabled={row.employeeIds.length === 0}
                        />
                      </TableCell>
                      <TableCell className="align-top whitespace-normal">
                        <div className="flex flex-col gap-2 text-sm">
                          {row.note ? (
                            <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-amber-800">
                              {row.note}
                            </p>
                          ) : null}
                          {row.error ? (
                            <p className="bg-destructive/10 text-destructive rounded-xl px-3 py-2">
                              {row.error}
                            </p>
                          ) : null}
                          {!row.note && !row.error ? (
                            <span className="text-muted-foreground text-xs">
                              Row is ready to save.
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-2">
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={() => handleResetRow(row.rowKey)}
                          >
                            Reset
                          </Button>
                          {mode === "add" ? (
                            <Button
                              type="button"
                              size="xs"
                              variant="destructive"
                              onClick={() => handleRemoveRow(row.rowKey)}
                            >
                              <Trash2 data-icon="inline-start" />
                              Remove
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
