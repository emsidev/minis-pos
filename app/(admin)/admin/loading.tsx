import { Loader2 } from "lucide-react"

export default function AdminLoading() {
  return (
    <div className="app-page-center">
      <div className="app-panel flex w-full max-w-sm flex-col items-center gap-3 p-6 text-center">
        <Loader2 className="size-5 animate-spin text-primary" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">
            Loading admin workspace
          </p>
          <p className="text-sm text-muted-foreground">
            Fetching the latest sales and booth data.
          </p>
        </div>
      </div>
    </div>
  )
}
