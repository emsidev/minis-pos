import { ShiftDetailSkeleton } from "@/components/shared/LoadingSkeletons"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import type {
  AdminInventoryEvent,
  AdminOperatorPeriod,
  AdminShiftCloseout,
} from "@/lib/adminBooths"
import type { ShiftDetailData } from "@/lib/shifts"
import { hasBusinessShiftStarted } from "@/lib/utils"
import { ShiftDetailView } from "./ShiftDetailView"

type ShiftDetailSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  detailData: ShiftDetailData | null
  loading?: boolean
  loadError?: string | null
  assignedEmployeeNames?: string[]
  operatorName?: string | null
  readOnly?: boolean
  canJoin?: boolean
  joinPending?: boolean
  onJoin?: () => void
  canTakeOver?: boolean
  takeoverPending?: boolean
  onTakeOver?: () => void
  canCloseShift?: boolean
  onCloseShift?: () => void
  showAdminAudit?: boolean
  inventoryEvents?: AdminInventoryEvent[]
  operatorPeriods?: AdminOperatorPeriod[]
  closeouts?: AdminShiftCloseout[]
  onEdit?: () => void
  onCancel?: () => void
  onOverride?: () => void
  onReopen?: () => void
  allowOfflineSaleCache?: boolean
}

export function ShiftDetailSheet({
  open,
  onOpenChange,
  detailData,
  loading = false,
  loadError = null,
  assignedEmployeeNames = [],
  operatorName = null,
  readOnly = false,
  canJoin = false,
  joinPending = false,
  onJoin,
  canTakeOver = false,
  takeoverPending = false,
  onTakeOver,
  canCloseShift = false,
  onCloseShift,
  showAdminAudit = false,
  inventoryEvents = [],
  operatorPeriods = [],
  closeouts = [],
  onEdit,
  onCancel,
  onOverride,
  onReopen,
  allowOfflineSaleCache,
}: ShiftDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-[58rem] p-0">
        <div className="sr-only">
          <SheetTitle>Shift Details</SheetTitle>
          <SheetDescription>
            Review booth assignment details, inventory, sales, and available
            actions for this shift.
          </SheetDescription>
        </div>

        {loading ? (
          <ShiftDetailSkeleton />
        ) : detailData?.schedule ? (
          <ScrollArea className="h-full">
            <ShiftDetailView
              schedule={detailData.schedule}
              products={detailData.products}
              sales={detailData.sales}
              isFuture={
                hasBusinessShiftStarted(
                  detailData.schedule.date,
                  detailData.schedule.start_time
                )
                  ? false
                  : detailData.schedule.status === "scheduled"
              }
              className="min-h-full p-0 pt-14"
              assignedEmployeeNames={assignedEmployeeNames}
              operatorName={operatorName}
              readOnly={readOnly}
              canJoin={canJoin}
              joinPending={joinPending}
              onJoin={onJoin}
              canTakeOver={canTakeOver}
              takeoverPending={takeoverPending}
              onTakeOver={onTakeOver}
              canCloseShift={canCloseShift}
              onCloseShift={onCloseShift}
              showAdminAudit={showAdminAudit}
              inventoryEvents={inventoryEvents}
              operatorPeriods={operatorPeriods}
              closeouts={closeouts}
              onEdit={onEdit}
              onCancel={onCancel}
              onOverride={onOverride}
              onReopen={onReopen}
              allowOfflineSaleCache={allowOfflineSaleCache}
            />
          </ScrollArea>
        ) : loadError ? (
          <div className="text-muted-foreground flex h-full items-center justify-center px-6 text-center text-sm">
            {loadError}
          </div>
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center px-6 text-center text-sm">
            Select a shift to review its details.
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
