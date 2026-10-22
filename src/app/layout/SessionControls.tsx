/**
 * Package-level controls in the app header, available in both modes once a
 * package is open: open another package, restart (resume / new attempt /
 * whole course), export the QA report, and close.
 */

import { useRef } from 'react'
import { FileDown, FolderOpen, ListRestart, Play, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/menu'
import type { PackageSession } from '@/app/hooks/usePackageSession'
import { REPORT_FORMATS, useReportExport } from '@/app/hooks/useReportExport'
import { useCourseStore } from '@/app/state/courseStore'

/** Hidden file input + the trigger that opens it. */
function OpenPackageButton({ session }: { session: PackageSession }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => inputRef.current?.click()}
        disabled={session.loading}
        title="Open another SCORM package (.zip) — or drop one anywhere"
      >
        <FolderOpen aria-hidden />
        <span className="hidden md:inline">Open</span>
        <span className="sr-only md:hidden">Open package</span>
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void session.loadFile(file)
        }}
      />
    </>
  )
}

function RestartMenu({ session }: { session: PackageSession }) {
  const itemCount = useCourseStore((s) => s.items.length)
  const disabled = session.currentItem === null || session.loading
  return (
    <Menu
      closeOnSelect
      disabled={disabled}
      title="Relaunch or restart"
      ariaLabel="Restart"
      label={
        <>
          <RotateCcw aria-hidden />
          <span className="hidden md:inline">Restart</span>
        </>
      }
    >
      <MenuLabel>{session.currentItem?.title ?? 'Current item'}</MenuLabel>
      <MenuItem onClick={session.relaunch} title="Reload with the saved data — entry is 'resume' if the SCO suspended">
        <Play aria-hidden />
        Relaunch (resume)
      </MenuItem>
      <MenuItem onClick={session.newAttempt} title="Discard this item's saved data and launch it fresh">
        <RotateCcw aria-hidden />
        New attempt
      </MenuItem>
      {itemCount > 1 && (
        <>
          <MenuSeparator />
          <MenuItem onClick={session.restartCourse} title="Discard every item's data and start from the first item">
            <ListRestart aria-hidden />
            Restart whole course
          </MenuItem>
        </>
      )}
    </Menu>
  )
}

function ReportMenu() {
  const { ready, exportReport } = useReportExport()
  return (
    <Menu
      closeOnSelect
      align="end"
      disabled={!ready}
      title="Download a QA report of this session"
      ariaLabel="Export report"
      label={
        <>
          <FileDown aria-hidden />
          <span className="hidden md:inline">Report</span>
        </>
      }
    >
      <MenuLabel>Export report</MenuLabel>
      {REPORT_FORMATS.map(({ format, label }) => (
        <MenuItem key={format} onClick={() => exportReport(format)}>
          <FileDown aria-hidden />
          {label}
        </MenuItem>
      ))}
    </Menu>
  )
}

export function SessionControls({ session }: { session: PackageSession }) {
  if (!session.pkg) return null
  return (
    <div className="flex min-w-0 items-center gap-1">
      {session.loading && (
        <span role="status" className="mr-1 hidden max-w-48 truncate text-xs text-slate-500 lg:inline">
          Opening {session.loadingName}…
        </span>
      )}
      <OpenPackageButton session={session} />
      <RestartMenu session={session} />
      <ReportMenu />
      <Button size="sm" variant="ghost" onClick={session.close} title="Close this package">
        <X aria-hidden />
        <span className="hidden md:inline">Close</span>
        <span className="sr-only md:hidden">Close package</span>
      </Button>
    </div>
  )
}
