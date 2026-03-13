/**
 * Extract a human-readable error message from an unknown caught value.
 *
 * @param err - The caught error value (typically from a `catch` clause).
 * @param fallback - Optional fallback message when `err` is not an `Error` instance.
 *                   Defaults to `"Unknown error"`.
 * @returns The error message string.
 */
export function getErrorMessage(
  err: unknown,
  fallback: string = "Unknown error"
): string {
  if (err instanceof Error) return err.message;
  return fallback;
}
