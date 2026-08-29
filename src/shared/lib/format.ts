/**
 * Shared formatting utilities.
 */

/** Formats a timestamp as HH:mm:ss[.SSS] */
export function formatTime(timestamp: number | Date, includeMs = true): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    ...(includeMs ? { fractionalSecondDigits: 3 } : {}),
  }).format(timestamp)
}
