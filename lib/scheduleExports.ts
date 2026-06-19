type ScheduleExportRow = {
  boothName: string
  date: string
  startTime: string
  endTime: string
  status: string
  assignedEmployeeNames: string[]
}

const monthHeadingFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "long",
  timeZone: "Asia/Manila",
})

const lineDateFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "long",
  day: "numeric",
  timeZone: "Asia/Manila",
})

function dateFromYmd(value: string) {
  const [year, month, day] = value.split("-").map(Number)

  if (!year || !month || !day) {
    return new Date()
  }

  return new Date(Date.UTC(year, month - 1, day, 12))
}

function formatTeamLabel(names: string[]) {
  if (names.length === 0) {
    return "Open"
  }

  if (names.length === 1) {
    return names[0]
  }

  if (names.length === 2) {
    return `${names[0]} & ${names[1]}`
  }

  return names.join(", ")
}

function formatStatusSuffix(status: string) {
  return status === "scheduled"
    ? ""
    : ` (${status.charAt(0).toUpperCase()}${status.slice(1)})`
}

function formatLine(row: ScheduleExportRow) {
  return `${lineDateFormatter.format(dateFromYmd(row.date))} - ${formatTeamLabel(row.assignedEmployeeNames)}${formatStatusSuffix(row.status)}`
}

export function buildCalendarExportText(
  rows: ScheduleExportRow[],
  visibleMonth: Date
) {
  const grouped = new Map<string, ScheduleExportRow[]>()

  for (const row of rows) {
    const current = grouped.get(row.boothName) ?? []
    current.push(row)
    grouped.set(row.boothName, current)
  }

  const sections = Array.from(grouped.entries()).map(
    ([boothName, boothRows]) => {
      const sortedRows = boothRows
        .slice()
        .sort(
          (left, right) =>
            left.date.localeCompare(right.date) ||
            left.startTime.localeCompare(right.startTime) ||
            left.endTime.localeCompare(right.endTime)
        )

      return [
        `📍${boothName.toUpperCase()}`,
        ...sortedRows.map(formatLine),
      ].join("\n")
    }
  )

  return [
    `${monthHeadingFormatter.format(visibleMonth).toUpperCase()} BOOTH DUTY!`,
    "",
    ...sections,
  ].join("\n\n")
}

export function buildBoothAssignmentExportText(
  boothName: string,
  rows: Omit<ScheduleExportRow, "boothName">[],
  visibleMonth: Date
) {
  const normalizedRows = rows.map((row) => ({ ...row, boothName }))

  return buildCalendarExportText(normalizedRows, visibleMonth)
}
