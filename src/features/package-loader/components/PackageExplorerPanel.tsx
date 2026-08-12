import { useMemo, useState } from 'react'
import { ChevronRight, File, Folder, FolderOpen } from 'lucide-react'
import { usePackageStore } from '@/features/package-loader/state/packageStore'
import { buildFileTree, type FileTreeNode } from '@/features/package-loader/services/fileTree'

function normalizePath(path: string): string {
  return path.replace(/^\.\//, '').replace(/\\/g, '/')
}

interface TreeRowProps {
  node: FileTreeNode
  depth: number
  expanded: ReadonlySet<string>
  toggle: (path: string) => void
  launchPath: string | null
}

function TreeRow({ node, depth, expanded, toggle, launchPath }: TreeRowProps) {
  const isOpen = expanded.has(node.path)
  const isLaunch = launchPath === node.path

  return (
    <>
      <div
        role="treeitem"
        aria-level={depth + 1}
        aria-expanded={node.isDirectory ? isOpen : undefined}
        className="flex items-center gap-1 pr-2 hover:bg-surface-900"
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        {node.isDirectory ? (
          <button
            type="button"
            className="flex size-4 shrink-0 items-center justify-center text-slate-500 hover:text-slate-300"
            aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
            onClick={() => toggle(node.path)}
          >
            <ChevronRight
              aria-hidden
              className={`size-3 transition-transform ${isOpen ? 'rotate-90' : ''}`}
            />
          </button>
        ) : (
          <span className="size-4 shrink-0" aria-hidden />
        )}
        {node.isDirectory ? (
          isOpen ? (
            <FolderOpen aria-hidden className="size-3.5 shrink-0 text-accent" />
          ) : (
            <Folder aria-hidden className="size-3.5 shrink-0 text-accent" />
          )
        ) : (
          <File aria-hidden className="size-3.5 shrink-0 text-slate-500" />
        )}
        <span
          className={`truncate text-[11px] ${node.isDirectory ? 'font-medium text-slate-300' : 'text-slate-400'}`}
          title={node.path}
        >
          {node.name}
        </span>
        {isLaunch && (
          <span className="ml-1 shrink-0 rounded-sm bg-accent/15 px-1 text-[9px] text-accent">
            launch
          </span>
        )}
      </div>
      {node.isDirectory &&
        isOpen &&
        node.children.map((child) => (
          <TreeRow
            key={child.path}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            toggle={toggle}
            launchPath={launchPath}
          />
        ))}
    </>
  )
}

/**
 * Keyed by package id so a new package remounts the tree with fresh default
 * expansion — no effect needed, and stale paths from the previous package
 * can never linger in the expansion state.
 */
function FileTreeView({ filePaths, launchPath }: { filePaths: string[]; launchPath: string }) {
  const tree = useMemo(() => buildFileTree(filePaths), [filePaths])
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(tree.filter((node) => node.isDirectory).map((node) => node.path)),
  )

  const toggle = (path: string): void => {
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  return (
    <div role="tree" aria-label="Package files" tabIndex={0} className="min-h-0 overflow-auto py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent">
      {tree.map((node) => (
        <TreeRow
          key={node.path}
          node={node}
          depth={0}
          expanded={expanded}
          toggle={toggle}
          launchPath={launchPath}
        />
      ))}
    </div>
  )
}

/** Left-dock file tree of the loaded package, built from the real archive list. */
export function PackageExplorerPanel() {
  const pkg = usePackageStore((state) => state.package)
  const filePaths = usePackageStore((state) => state.filePaths)

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Package Explorer">
      <header className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-border-subtle px-2">
        <span className="text-[11px] text-slate-500">
          {filePaths.length} {filePaths.length === 1 ? 'file' : 'files'}
        </span>
        {pkg && (
          <span className="max-w-48 truncate text-[11px] text-slate-600" title={pkg.name}>
            {pkg.name}
          </span>
        )}
      </header>

      {pkg === null ? (
        <p className="p-3 text-xs text-slate-600">
          Load a package to explore its file structure.
        </p>
      ) : (
        <FileTreeView
          key={pkg.id}
          filePaths={filePaths}
          launchPath={normalizePath(pkg.launchUrl)}
        />
      )}
    </section>
  )
}
