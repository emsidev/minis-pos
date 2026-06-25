export type OptimisticMutationResult =
  | void
  | (() => void)
  | { rollback?: () => void }

export type OptimisticMutationHandler<T> = (
  input: T
) => OptimisticMutationResult

export function extractOptimisticRollback(
  result: OptimisticMutationResult
): (() => void) | undefined {
  if (typeof result === "function") {
    return result
  }

  return result?.rollback
}
