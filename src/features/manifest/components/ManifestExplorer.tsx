import { useState, type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import type {
  ManifestItem,
  ManifestOrganization,
  ManifestResource,
  SequencingDefinition,
} from '@/shared/types'
import { useManifestStore } from '../state/manifestStore'

/**
 * imsmanifest.xml as SCORMite parsed it: every organization's item tree
 * and the resources. Expanding an item shows what the player will use for
 * it — resource, launch href, parameters, launch data, visibility, hidden
 * LMS controls, and sequencing — so a manifest problem can be traced to the
 * element that causes it.
 */

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={cn('mt-0.5 h-3 w-3 shrink-0 text-slate-500 transition-transform', open && 'rotate-90')}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 5l8 7-8 7V5z" />
    </svg>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 break-all text-slate-300">{children}</dd>
    </div>
  )
}

function sequencingSummary(sequencing: SequencingDefinition): string {
  const parts: string[] = []
  const controls = sequencing.controls
  if (controls) {
    const flags = (['choice', 'flow', 'forwardOnly', 'choiceExit'] as const)
      .filter((key) => controls[key] !== undefined)
      .map((key) => `${key}=${String(controls[key])}`)
    if (flags.length > 0) parts.push(flags.join(' '))
  }
  const rules = sequencing.rules
  if (rules) {
    const count = rules.preConditionRules.length + rules.exitConditionRules.length + rules.postConditionRules.length
    if (count > 0) parts.push(`${count} rule${count === 1 ? '' : 's'}`)
  }
  const objectives = (sequencing.primaryObjective ? 1 : 0) + (sequencing.objectives?.length ?? 0)
  if (objectives > 0) parts.push(`${objectives} objective${objectives === 1 ? '' : 's'}`)
  if (sequencing.rollupRules?.length) parts.push(`${sequencing.rollupRules.length} rollup rule${sequencing.rollupRules.length === 1 ? '' : 's'}`)
  if (sequencing.attemptLimit !== undefined) parts.push(`attempt limit ${sequencing.attemptLimit}`)
  if (sequencing.collectionRef) parts.push(`uses collection ${sequencing.collectionRef}`)
  return parts.join(' · ') || 'declared, no settings'
}

function ItemDetails({ item, resource }: { item: ManifestItem; resource: ManifestResource | undefined }) {
  const launchData = Object.entries(item.launchData ?? {})
  return (
    <dl className="my-1 ml-6 space-y-0.5 rounded-sm border border-border-subtle bg-surface-900 px-2 py-1.5 font-mono text-[10px]">
      <Detail label="identifier">{item.identifier}</Detail>
      {item.identifierref ? (
        <Detail label="resource">
          {resource ? (
            <>
              {resource.identifier} · {resource.scormType ?? 'no scormType'}
            </>
          ) : (
            <span className="text-red-400">{item.identifierref} — not found</span>
          )}
        </Detail>
      ) : (
        <Detail label="resource">none (cluster)</Detail>
      )}
      {resource?.href && <Detail label="href">{resource.href}</Detail>}
      {item.parameters && <Detail label="parameters">{item.parameters}</Detail>}
      {!item.isvisible && <Detail label="visible">false</Detail>}
      {launchData.map(([key, value]) => (
        <Detail key={key} label={key}>
          {value}
        </Detail>
      ))}
      {item.hideLmsUi && <Detail label="hideLMSUI">{item.hideLmsUi.join(', ')}</Detail>}
      {item.sequencing && <Detail label="sequencing">{sequencingSummary(item.sequencing)}</Detail>}
    </dl>
  )
}

function TreeItem({
  item,
  depth,
  resources,
}: {
  item: ManifestItem
  depth: number
  resources: ReadonlyMap<string, ManifestResource>
}) {
  const [open, setOpen] = useState(item.children.length > 0)
  const [showDetails, setShowDetails] = useState(false)
  const hasChildren = item.children.length > 0
  const resource = item.identifierref ? resources.get(item.identifierref) : undefined

  return (
    <li>
      <div className="flex items-start" style={{ paddingLeft: `${depth * 14}px` }}>
        {hasChildren ? (
          <button
            type="button"
            className="rounded px-1 py-0.5 hover:bg-surface-700"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? `Collapse ${item.title || item.identifier}` : `Expand ${item.title || item.identifier}`}
          >
            <Chevron open={open} />
          </button>
        ) : (
          <span className="w-5 shrink-0" aria-hidden="true" />
        )}
        <button
          type="button"
          className={cn(
            'flex min-w-0 flex-1 items-start gap-1.5 rounded px-1 py-0.5 text-left text-xs transition-colors hover:bg-surface-700',
            !item.isvisible && 'opacity-50',
          )}
          onClick={() => setShowDetails((v) => !v)}
          aria-expanded={showDetails}
          title="Show what the manifest declares for this item"
        >
          <span className="truncate text-slate-300">{item.title || item.identifier}</span>
          {item.sequencing && (
            <span className="shrink-0 rounded bg-accent/15 px-1 text-[10px] text-accent">seq</span>
          )}
          {item.identifierref && (
            <span className={cn('ml-auto shrink-0 text-[10px]', resource ? 'text-slate-500' : 'text-red-400')}>
              {item.identifierref}
            </span>
          )}
        </button>
      </div>
      {showDetails && <ItemDetails item={item} resource={resource} />}
      {hasChildren && open && (
        <ul>
          {item.children.map((child) => (
            <TreeItem key={child.identifier} item={child} depth={depth + 1} resources={resources} />
          ))}
        </ul>
      )}
    </li>
  )
}

function Section({ title, badge, children, defaultOpen }: { title: string; badge?: ReactNode; children: ReactNode; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 transition-colors hover:bg-surface-700"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Chevron open={open} />
        <span className="truncate">{title}</span>
        {badge}
      </button>
      {open && children}
    </div>
  )
}

function OrganizationSection({
  org,
  isDefault,
  resources,
}: {
  org: ManifestOrganization
  isDefault: boolean
  resources: ReadonlyMap<string, ManifestResource>
}) {
  return (
    <Section
      title={org.title || org.identifier}
      defaultOpen={isDefault}
      badge={
        <>
          {isDefault && (
            <span className="ml-1 shrink-0 rounded bg-accent/20 px-1 py-px text-[10px] font-normal normal-case tracking-normal text-accent">
              default
            </span>
          )}
          {org.sequencing && (
            <span
              className="ml-1 shrink-0 rounded bg-accent/15 px-1 py-px text-[10px] font-normal normal-case tracking-normal text-accent"
              title={sequencingSummary(org.sequencing)}
            >
              seq
            </span>
          )}
        </>
      }
    >
      <ul>
        {org.items.map((item) => (
          <TreeItem key={item.identifier} item={item} depth={0} resources={resources} />
        ))}
      </ul>
    </Section>
  )
}

function ResourceList({ resources }: { resources: ManifestResource[] }) {
  return (
    <Section
      title="Resources"
      defaultOpen={false}
      badge={<span className="ml-1 text-[10px] font-normal text-slate-500">({resources.length})</span>}
    >
      <ul className="mt-0.5">
        {resources.map((res) => (
          <li key={res.identifier} className="flex items-start gap-1.5 rounded px-2 py-0.5 text-xs">
            <span
              className={cn(
                'mt-0.5 shrink-0 rounded px-1 py-px text-[10px] font-medium',
                res.scormType === 'sco' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-600/40 text-slate-400',
              )}
            >
              {res.scormType ?? 'asset'}
            </span>
            <span className="min-w-0 truncate text-slate-400" title={`${res.identifier} · ${res.files.length} declared files`}>
              {res.href ?? res.identifier}
            </span>
            <span className="ml-auto shrink-0 text-[10px] text-slate-600">{res.files.length} files</span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

/** Renders the parsed imsmanifest.xml. Reads from manifestStore — nothing when no manifest is loaded. */
export function ManifestExplorer() {
  const manifest = useManifestStore((s) => s.manifest)
  if (!manifest) return null
  const resources = new Map(manifest.resources.map((r) => [r.identifier, r] as const))

  return (
    <div className="flex h-full flex-col overflow-hidden text-xs">
      {(manifest.metadata.schema ?? manifest.metadata.schemaVersion) && (
        <div className="shrink-0 border-b border-border-subtle px-3 py-1.5 text-[10px] text-slate-500">
          {manifest.metadata.schema}
          {manifest.metadata.schemaVersion && <span className="ml-1 text-slate-400">{manifest.metadata.schemaVersion}</span>}
          {manifest.sequencingCollections && (
            <span className="ml-2">
              · {Object.keys(manifest.sequencingCollections).length} sequencing collection
              {Object.keys(manifest.sequencingCollections).length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      )}

      <div
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
      >
        <div className="px-1">
          {manifest.organizations.map((org) => (
            <OrganizationSection
              key={org.identifier}
              org={org}
              isDefault={
                org.identifier === manifest.defaultOrganizationIdentifier ||
                (manifest.defaultOrganizationIdentifier === undefined && org === manifest.organizations[0])
              }
              resources={resources}
            />
          ))}
        </div>
        {manifest.resources.length > 0 && (
          <div className="mt-1 border-t border-border-subtle px-1 pt-1">
            <ResourceList resources={manifest.resources} />
          </div>
        )}
      </div>
    </div>
  )
}
