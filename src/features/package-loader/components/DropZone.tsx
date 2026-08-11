import { useRef, useState } from 'react'
import { cn } from '@/shared/lib/utils'

interface DropZoneProps {
  onFile: (file: File) => void
  loading?: boolean
  error?: string | null
}

/**
 * Accepts a single SCORM ZIP file via drag-and-drop or click.
 * The actual file reading/parsing is done by the caller (onFile callback),
 * keeping this component purely presentational.
 */
export function DropZone({ onFile, loading = false, error = null }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File | undefined) {
    if (!file) return
    onFile(file)
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(true)
  }

  function onDragLeave(e: React.DragEvent<HTMLDivElement>) {
    // Only clear if leaving the drop zone entirely (not a child element).
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    handleFile(file)
    // Reset input so the same file can be re-loaded.
    e.target.value = ''
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
      <div
        role="button"
        aria-label="Drop SCORM ZIP here or click to browse"
        tabIndex={0}
        className={cn(
          'flex w-full max-w-lg cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed px-8 py-12 text-center transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
          isDragging
            ? 'border-accent bg-accent/10'
            : 'border-border-subtle hover:border-accent/60 hover:bg-surface-800',
          loading && 'pointer-events-none opacity-60',
        )}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
      >
        {loading ? (
          <>
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent"
              aria-hidden="true"
            />
            <p className="text-sm text-slate-400">Loading package…</p>
          </>
        ) : (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.25}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-slate-200">
                Drop a SCORM package here
              </p>
              <p className="mt-1 text-xs text-slate-500">
                or click to browse
              </p>
              <p className="mt-2 text-[10px] tracking-wide text-slate-600">
                .zip &middot; SCORM 1.2 &amp; 2004 &middot; runs locally &mdash; your package never leaves this tab
              </p>
            </div>
          </>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="max-w-lg rounded border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs text-red-400"
        >
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={onInputChange}
      />
    </div>
  )
}
