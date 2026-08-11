/**
 * Builds a nested directory tree from a flat list of package file paths.
 * Pure logic so the component stays dumb: sort directories first, files
 * after, both case-insensitively, matching how an archive listing reads.
 */

export interface FileTreeNode {
  name: string
  /** Full archive path, e.g. `res/scormdriver/index.html`. */
  path: string
  isDirectory: boolean
  children: FileTreeNode[]
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '')
}

/** Compare for tree ordering: directories before files, then by name. */
function compareNodes(a: FileTreeNode, b: FileTreeNode): number {
  if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}

export function buildFileTree(filePaths: readonly string[]): FileTreeNode[] {
  const root: FileTreeNode = { name: '', path: '', isDirectory: true, children: [] }

  for (const rawPath of filePaths) {
    const path = normalizePath(rawPath)
    if (!path) continue
    const segments = path.split('/')
    let node = root
    let prefix = ''
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      if (!segment) continue
      const isLast = i === segments.length - 1
      prefix = prefix ? `${prefix}/${segment}` : segment
      let child = node.children.find((c) => c.name === segment)
      if (!child) {
        child = {
          name: segment,
          path: prefix,
          isDirectory: !isLast,
          children: [],
        }
        node.children.push(child)
      }
      node = child
    }
  }

  const sortRecursive = (nodes: FileTreeNode[]): FileTreeNode[] => {
    nodes.sort(compareNodes)
    for (const node of nodes) {
      if (node.isDirectory) sortRecursive(node.children)
    }
    return nodes
  }
  return sortRecursive(root.children)
}
