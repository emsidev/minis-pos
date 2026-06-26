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
import type { ApprovalProduct, ShiftApprovalRecord } from "@/lib/shiftApprovals"
import type { ShiftDetailData } from "@/lib/shifts"
import { getBusinessShiftState, hasStartedOperatorPeriod } from "@/lib/utils"
import { ShiftDetailView } from "./ShiftDetailView"

type ShiftDetailSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  detailData: ShiftDetailData | null
  loading?: boolean
  loadError?: string | null
  assignedEmployeeNames?: string[]
  operatorName?: string | null
  canEditReceipts?: boolean
  readOnly?: boolean
  canJoin?: boolean
  joinPending?: boolean
  onJoin?: () => void
  canTakeOver?: boolean
  takeoverPending?: boolean
  onTakeOver?: () => void
  operatorActionLabel?: "Start Shift" | "Take Over POS"
  canCloseShift?: boolean
  onCloseShift?: () => void
  showAdminAudit?: boolean
  inventoryEvents?: AdminInventoryEvent[]
  operatorPeriods?: AdminOperatorPeriod[]
  closeouts?: AdminShiftCloseout[]
  approvalHistory?: ShiftApprovalRecord[]
  approvalProducts?: ApprovalProduct[]
  pendingRevenueIncrease?: number
  pendingRevenueDecrease?: number
  saleActionMode?: "none" | "direct" | "request"
  onSalesChanged?: () => void
  onEdit?: () => void
  onCancel?: () => void
  onDelete?: () => void
  onOverride?: () => void
  onReopen?: () => void
  onAddCashDeduction?: () => void
  cashDeductionPending?: boolean
  onRequestReopenApproval?: () => void
  requestReopenApprovalPending?: boolean
  pendingReopenApprovalCount?: number
  onApproveReopenApproval?: () => void
  onRejectReopenApproval?: () => void
  resolveReopenApprovalPending?: boolean
  onApproveSaleApproval?: (approvalId: string) => void
  onRejectSaleApproval?: (approvalId: string) => void
  resolvingSaleApprovalId?: string | null
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
  canEditReceipts = false,
  readOnly = false,
  canJoin = false,
  joinPending = false,
  onJoin,
  canTakeOver = false,
  takeoverPending = false,
  onTakeOver,
  operatorActionLabel = "Take Over POS",
  canCloseShift = false,
  onCloseShift,
  showAdminAudit = false,
  inventoryEvents = [],
  operatorPeriods = [],
  closeouts = [],
  approvalHistory = [],
  approvalProducts = [],
  pendingRevenueIncrease = 0,
  pendingRevenueDecrease = 0,
  saleActionMode = "none",
  onSalesChanged,
  onEdit,
  onCancel,
  onDelete,
  onOverride,
  onReopen,
  onAddCashDeduction,
  cashDeductionPending = false,
  onRequestReopenApproval,
  requestReopenApprovalPending = false,
  pendingReopenApprovalCount = 0,
  onApproveReopenApproval,
  onRejectReopenApproval,
  resolveReopenApprovalPending = false,
  onApproveSaleApproval,
  onRejectSaleApproval,
  resolvingSaleApprovalId = null,
  allowOfflineSaleCache,
}: ShiftDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="app-sheet-content max-w-[58rem]">
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
              saleItems={detailData.saleItems}
              isFuture={
                getBusinessShiftState(detailData.schedule, {
                  inventoryReady: detailData.products.length > 0,
                  manuallyStarted: hasStartedOperatorPeriod(
                    detailData.schedule.booth_schedule_operator_periods
                  ),
                }).isFuture
              }
              className="min-h-full p-0 pt-12 sm:pt-14"
              assignedEmployeeNames={assignedEmployeeNames}
              operatorName={operatorName}
              canEditReceipts={canEditReceipts}
              readOnly={readOnly}
              canJoin={canJoin}
              joinPending={joinPending}
              onJoin={onJoin}
              canTakeOver={canTakeOver}
              takeoverPending={takeoverPending}
              onTakeOver={onTakeOver}
              operatorActionLabel={operatorActionLabel}
              canCloseShift={canCloseShift}
              onCloseShift={onCloseShift}
              showAdminAudit={showAdminAudit}
              inventoryEvents={inventoryEvents}
              operatorPeriods={operatorPeriods}
              closeouts={closeouts}
              approvalHistory={approvalHistory}
              approvalProducts={approvalProducts}
              pendingRevenueIncrease={pendingRevenueIncrease}
              pendingRevenueDecrease={pendingRevenueDecrease}
              saleActionMode={saleActionMode}
              onSalesChanged={onSalesChanged}
              onEdit={onEdit}
              onCancel={onCancel}
              onDelete={onDelete}
              onOverride={onOverride}
              onReopen={onReopen}
              onAddCashDeduction={onAddCashDeduction}
              cashDeductionPending={cashDeductionPending}
              onRequestReopenApproval={onRequestReopenApproval}
              requestReopenApprovalPending={requestReopenApprovalPending}
              pendingReopenApprovalCount={pendingReopenApprovalCount}
              onApproveReopenApproval={onApproveReopenApproval}
              onRejectReopenApproval={onRejectReopenApproval}
              resolveReopenApprovalPending={resolveReopenApprovalPending}
              onApproveSaleApproval={onApproveSaleApproval}
              onRejectSaleApproval={onRejectSaleApproval}
              resolvingSaleApprovalId={resolvingSaleApprovalId}
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
