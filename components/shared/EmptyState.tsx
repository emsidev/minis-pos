import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyFooter,
  EmptyHeader,
  EmptyImage,
  EmptyTitle,
} from "@/components/ui/empty"

type EmptyStateProps = {
  icon: React.ReactNode
  title: string
  description: string
  actionLabel?: string
  href?: string
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  href,
  className,
}: EmptyStateProps) {
  return (
    <Empty className={className}>
      <EmptyImage>{icon}</EmptyImage>

      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>

      {actionLabel && href ? (
        <EmptyFooter>
          <Link href={href}>
            <Button size="lg" className="rounded-full px-8">
              {actionLabel}
            </Button>
          </Link>
        </EmptyFooter>
      ) : null}
    </Empty>
  )
}
