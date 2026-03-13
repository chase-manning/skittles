/**
 * Extract a human-readable error message from an unknown caught value.
 *
 * @param err - The caught error value (typically from a `catch` clause).
 * @param fallback - Optional fallback message when `err` is not an `Error` instance
 *                   and `err` is nullish. Defaults to `"Unknown error occurred"`.
 * @returns The error message string.
 */
export function getErrorMessage(
  err: unknown,
  fallback = "Unknown error occurred"
): string {
  return err instanceof Error ? err.message : String(err ?? fallback);
}
