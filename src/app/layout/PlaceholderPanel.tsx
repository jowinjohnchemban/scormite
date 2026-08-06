/** Placeholder for panels not yet implemented. Replaced milestone by milestone. */
export function PlaceholderPanel({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-xs text-slate-600">
      {label} — coming in a future milestone
    </div>
  )
}
