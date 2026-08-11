import { useState } from 'react'
import { cn } from '@/shared/lib/utils'
import type { ManifestItem, ManifestOrganization, ManifestResource } from '@/shared/types'
import { useManifestStore } from '../state/manifestStore'

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface TreeItemProps {
  item: ManifestItem
  depth: number
}

function TreeItem({ item, depth }: TreeItemProps) {
  const [open, setOpen] = useState(true)
  const hasChildren = item.children.length > 0

  return (
    <li>
      <button
        type="button"
        className={cn(
          'flex w-full items-start gap-1.5 rounded px-2 py-0.5 text-left text-xs transition-colors hover:bg-surface-700',
          !item.isvisible && 'opacity-50',
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => hasChildren && setOpen((v) => !v)}
        aria-expanded={hasChildren ? open : undefined}
      >
        {hasChildren ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={cn(
              'mt-0.5 h-3 w-3 shrink-0 text-slate-500 transition-transform',
              open && 'rotate-90',
            )}
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M8 5l8 7-8 7V5z" />
          </svg>
        ) : (
          <span className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
        )}
        <span className="truncate text-slate-300">{item.title || item.identifier}</span>
        {item.identifierref && (
          <span className="ml-auto shrink-0 text-[10px] text-slate-600">
            {item.identifierref}
          </span>
        )}
      </button>
      {hasChildren && open && (
        <ul>
          {item.children.map((child) => (
            <TreeItem key={child.identifier} item={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

interface OrganizationSectionProps {
  org: ManifestOrganization
  isDefault: boolean
}

function OrganizationSection({ org, isDefault }: OrganizationSectionProps) {
  const [open, setOpen] = useState(true)

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 transition-colors hover:bg-[var(--color-surface-700)]"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={cn(
            'h-3 w-3 shrink-0 transition-transform',
            open && 'rotate-90',
          )}
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M8 5l8 7-8 7V5z" />
        </svg>
        {org.title || org.identifier}
        {isDefault && (
          <span className="ml-1 rounded bg-accent/20 px-1 py-px text-[10px] font-normal text-accent">
            default
          </span>
        )}
      </button>
      {open && (
        <ul>
          {org.items.map((item) => (
            <TreeItem key={item.identifier} item={item} depth={0} />
          ))}
        </ul>
      )}
    </div>
  )
}

interface ResourceListProps {
  resources: ManifestResource[]
}

function ResourceList({ resources }: ResourceListProps) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 transition-colors hover:bg-[var(--color-surface-700)]"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={cn(
            'h-3 w-3 shrink-0 transition-transform',
            open && 'rotate-90',
          )}
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M8 5l8 7-8 7V5z" />
        </svg>
        Resources
        <span className="ml-1 text-[10px] font-normal text-slate-500">
          ({resources.length})
        </span>
      </button>
      {open && (
        <ul className="mt-0.5">
          {resources.map((res) => (
            <li key={res.identifier}>
              <div className="flex w-full items-start gap-1.5 rounded px-2 py-0.5 text-xs">
                <span
                  className={cn(
                    'mt-0.5 shrink-0 rounded px-1 py-px text-[10px] font-medium',
                    res.scormType === 'sco'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-slate-600/40 text-slate-400',
                  )}
                >
                  {res.scormType ?? 'asset'}
                </span>
                <span className="truncate text-slate-400" title={res.href}>
                  {res.href ?? res.identifier}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Renders the parsed imsmanifest.xml as a collapsible tree.
 * Reads from manifestStore — renders nothing if no manifest is loaded.
 */
export function ManifestExplorer() {
  const manifest = useManifestStore((s) => s.manifest)

  if (!manifest) return null

  return (
    <div className="flex h-full flex-col overflow-hidden text-xs">
      {/* Metadata strip */}
      {(manifest.metadata.schema ?? manifest.metadata.schemaVersion) && (
        <div className="shrink-0 border-b border-border-subtle px-3 py-1.5 text-[10px] text-slate-500">
          {manifest.metadata.schema}
          {manifest.metadata.schemaVersion && (
            <span className="ml-1 text-slate-400">{manifest.metadata.schemaVersion}</span>
          )}
        </div>
      )}

      {/* Tree */}
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {/* Organizations */}
        <div className="px-1">
          {manifest.organizations.map((org) => (
            <OrganizationSection
              key={org.identifier}
              org={org}
              isDefault={org.identifier === manifest.defaultOrganizationIdentifier}
            />
          ))}
        </div>

        {/* Divider + Resources */}
        {manifest.resources.length > 0 && (
          <div className="mt-1 border-t border-border-subtle px-1 pt-1">
            <ResourceList resources={manifest.resources} />
          </div>
        )}
      </div>
    </div>
  )
}
