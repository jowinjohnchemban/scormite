/**
 * Basic Mode shell — instructional designer / QA / reviewer view.
 *
 * Milestone 3: shows DropZone when no package is loaded; shows manifest
 * tree + package summary once a package is loaded.
 * Full two-column layout (PackageSummaryPanel + PlayerFrame) lands in Milestone 5.
 */

import { useState, useCallback } from 'react'
import { DropZone, loadZip, usePackageStore, PackageLoadError } from '@/features/package-loader'
import { ManifestExplorer, parseManifest, useManifestStore, ManifestParseError } from '@/features/manifest'
import type { Package } from '@/shared/types'

export function BasicModeShell() {
  const pkg = usePackageStore((s) => s.package)
  const setPackage = usePackageStore((s) => s.setPackage)
  const setManifest = useManifestStore((s) => s.setManifest)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(
    async (file: File) => {
      setLoading(true)
      setError(null)
      try {
        const raw = await loadZip(file)
        const manifest = parseManifest(raw.manifestXml)

        // Derive launchUrl: first SCO href in resources, or empty string.
        const launchUrl =
          manifest.resources.find((r) => r.scormType === 'sco')?.href ??
          manifest.resources[0]?.href ??
          ''

        const assembled: Package = {
          id: crypto.randomUUID(),
          name: raw.name,
          sourceType: 'zip',
          scormVersion: raw.scormVersion,
          ...(raw.scormEdition !== undefined ? { scormEdition: raw.scormEdition } : {}),
          manifest,
          launchUrl,
          loadedAt: new Date(),
        }

        setManifest(manifest)
        setPackage(assembled)
      } catch (e) {
        if (e instanceof PackageLoadError || e instanceof ManifestParseError) {
          setError(e.message)
        } else {
          setError('An unexpected error occurred while loading the package.')
        }
      } finally {
        setLoading(false)
      }
    },
    [setPackage, setManifest],
  )

  if (!pkg) {
    return <DropZone onFile={handleFile} loading={loading} error={error} />
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: package info + manifest tree */}
      <aside className="flex w-64 shrink-0 flex-col overflow-hidden border-r border-[var(--color-border-subtle)] bg-[var(--color-surface-900)]">
        <div className="shrink-0 border-b border-[var(--color-border-subtle)] px-3 py-2">
          <p className="truncate text-sm font-medium text-slate-200" title={pkg.name}>
            {pkg.name}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            SCORM {pkg.scormVersion}
            {pkg.scormEdition ? ` ${pkg.scormEdition} Edition` : ''}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <ManifestExplorer />
        </div>
      </aside>

      {/* Right: player placeholder (Milestone 5) */}
      <main className="flex min-w-0 flex-1 items-center justify-center text-sm text-slate-500">
        Player panel lands in Milestone 5.
      </main>
    </div>
  )
}
