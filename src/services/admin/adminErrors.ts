export class AdminDataError extends Error {
  code?: string
  context?: Record<string, unknown>

  constructor(message: string, code?: string, context?: Record<string, unknown>) {
    super(message)
    this.name = 'AdminDataError'
    this.code = code
    this.context = context
  }
}

export const formatAdminFirestoreError = (
  error: unknown,
  fallback: string,
  options?: { missingCollectionMessage?: string; indexMessage?: string },
) => {
  const code = (error as { code?: string })?.code
  if (code === 'permission-denied') {
    return 'Permission denied: admin role missing.'
  }
  if (code === 'failed-precondition') {
    return options?.indexMessage ?? 'Missing Firestore index required for this query.'
  }
  if (code === 'not-found') {
    return options?.missingCollectionMessage ?? 'Engagement collection not initialized.'
  }
  if (code === 'unauthenticated') {
    return 'Authentication required to access admin data.'
  }
  return fallback
}

export const toAdminDataError = (
  error: unknown,
  fallback: string,
  options?: { context?: Record<string, unknown>; missingCollectionMessage?: string; indexMessage?: string },
) => {
  const code = (error as { code?: string })?.code ?? 'unknown'
  const message = formatAdminFirestoreError(error, fallback, options)
  return new AdminDataError(message, code, options?.context)
}
