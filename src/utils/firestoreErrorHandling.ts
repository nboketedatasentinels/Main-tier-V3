import { FirestoreError } from 'firebase/firestore';

/**
 * Creates a standardized error handler for onSnapshot listeners
 * @param context - Description of what data is being loaded (e.g., "notifications", "impact logs")
 * @param onError - Optional callback to handle the error (e.g., update error state)
 * @returns Error handler function for onSnapshot
 */
export const createSnapshotErrorHandler = (
  context: string,
  onError?: (error: Error) => void
) => (error: FirestoreError) => {
  console.error(`[${context}] Snapshot error:`, error);

  // Create user-friendly error message
  let userMessage = `Unable to load ${context}.`;

  if (error.code === 'permission-denied') {
    userMessage = `You do not have permission to access ${context}.`;
  } else if (error.code === 'unavailable') {
    userMessage = `${context} temporarily unavailable. Please check your connection.`;
  } else if (error.code === 'failed-precondition') {
    userMessage = `${context} requires additional setup. Please contact support.`;
  } else {
    userMessage = `Unable to load ${context}. Please check your connection.`;
  }

  if (onError) {
    onError(new Error(userMessage));
  }
};

/**
 * Coordinates loading state across multiple parallel async operations
 * Ensures loading stays true until ALL operations complete
 */
export class LoadingCoordinator {
  private pending: Set<string> = new Set();
  private onUpdate: (isLoading: boolean) => void;

  constructor(onUpdate: (isLoading: boolean) => void) {
    this.onUpdate = onUpdate;
  }

  /**
   * Mark an operation as started
   * @param key - Unique identifier for this operation
   */
  start(key: string) {
    this.pending.add(key);
    this.onUpdate(true);
  }

  /**
   * Mark an operation as completed (success or error)
   * @param key - Unique identifier for this operation
   */
  complete(key: string) {
    this.pending.delete(key);
    if (this.pending.size === 0) {
      this.onUpdate(false);
    }
  }

  /**
   * Check if any operations are still pending
   */
  get isPending(): boolean {
    return this.pending.size > 0;
  }

  /**
   * Get count of pending operations
   */
  get pendingCount(): number {
    return this.pending.size;
  }
}

/**
 * Executes multiple promises in parallel with graceful partial failure handling
 * Uses Promise.allSettled to allow successful operations to complete even if others fail
 *
 * @param promises - Array of promises to execute
 * @param context - Description of the operation for logging
 * @returns Object containing successful results and any failures
 */
export async function executeWithPartialFailureRecovery<T>(
  promises: Promise<T>[],
  context: string
): Promise<{ results: T[]; failures: Error[] }> {
  const settled = await Promise.allSettled(promises);
  const results: T[] = [];
  const failures: Error[] = [];

  settled.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      results.push(result.value);
    } else {
      const error = result.reason instanceof Error
        ? result.reason
        : new Error(String(result.reason));

      console.error(`[${context}] Operation ${idx} failed:`, error);
      failures.push(error);
    }
  });

  // Log summary if there were failures
  if (failures.length > 0) {
    console.warn(
      `[${context}] ${failures.length} of ${promises.length} operations failed. ` +
      `Proceeding with ${results.length} successful results.`
    );
  }

  return { results, failures };
}

/**
 * Transform Firebase errors into user-friendly messages
 * @param error - The Firebase error
 * @param operation - Description of what operation failed
 * @returns User-friendly error message
 */
export function getFriendlyErrorMessage(error: unknown, operation: string): string {
  if (error instanceof FirestoreError) {
    switch (error.code) {
      case 'permission-denied':
        return `You do not have permission to ${operation}.`;
      case 'unavailable':
        return 'Service temporarily unavailable. Please try again.';
      case 'failed-precondition':
        return 'Operation requires additional setup. Please contact support.';
      case 'not-found':
        return 'The requested data was not found.';
      case 'already-exists':
        return 'This item already exists.';
      case 'resource-exhausted':
        return 'Too many requests. Please try again later.';
      case 'unauthenticated':
        return 'Please log in to continue.';
      case 'deadline-exceeded':
        return 'Request timed out. Please try again.';
      default:
        return `Failed to ${operation}. Please try again.`;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return `Failed to ${operation}. Please try again.`;
}

/**
 * Wraps a service function with standardized error handling
 * @param fn - The async function to wrap
 * @param operation - Description of the operation for error messages
 * @returns Wrapped function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  operation: string
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error(`[${operation}] Error:`, error);
      throw new Error(getFriendlyErrorMessage(error, operation));
    }
  }) as T;
}
