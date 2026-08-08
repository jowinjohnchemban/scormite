/**
 * Drag-and-drop plumbing for docking panels between regions.
 *
 * The dragged panel id lives in the registry (`draggingId`) rather than only
 * in `dataTransfer`, because `dataTransfer.getData` is unreadable during
 * `dragover` in every browser — drop targets need to know *what* is being
 * dragged in order to decide whether to light up. The id is still written to
 * `dataTransfer` so the drag reads as a real HTML5 drag to the platform.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent as ReactDragEvent } from 'react'
import { usePanelRegistry } from './PanelRegistry'

export const PANEL_DND_MIME = 'application/x-scormite-panel'

export interface PanelDragSourceProps {
  draggable: true
  onDragStart: (event: ReactDragEvent) => void
  onDragEnd: () => void
}

/** Spread onto whatever element should be the drag grip for `panelId`. */
export function usePanelDragSource(panelId: string): PanelDragSourceProps {
  const beginDrag = usePanelRegistry((s) => s.beginDrag)
  const endDrag = usePanelRegistry((s) => s.endDrag)

  const onDragStart = useCallback(
    (event: ReactDragEvent) => {
      event.dataTransfer.setData(PANEL_DND_MIME, panelId)
      event.dataTransfer.effectAllowed = 'move'
      beginDrag(panelId)
    },
    [panelId, beginDrag],
  )

  return { draggable: true, onDragStart, onDragEnd: endDrag }
}

export interface PanelDropTargetProps {
  onDragEnter: (event: ReactDragEvent) => void
  onDragOver: (event: ReactDragEvent) => void
  onDragLeave: () => void
  onDrop: (event: ReactDragEvent) => void
}

export interface PanelDropTarget {
  /** A panel drag is in progress and this target would accept it. */
  isActive: boolean
  /** The pointer is currently over this target. */
  isOver: boolean
  dropProps: PanelDropTargetProps
}

interface UsePanelDropTargetOptions {
  onDrop: (draggedId: string) => void
  /** Reject specific panels — e.g. a tab refusing a drop of itself. */
  accepts?: (draggedId: string) => boolean
}

export function usePanelDropTarget({
  onDrop,
  accepts,
}: UsePanelDropTargetOptions): PanelDropTarget {
  const draggingId = usePanelRegistry((s) => s.draggingId)
  const endDrag = usePanelRegistry((s) => s.endDrag)
  const [isOver, setIsOver] = useState(false)

  // dragenter/dragleave fire once per descendant, so nesting has to be counted
  // rather than treated as a boolean.
  const depth = useRef(0)

  // A drag that ends anywhere other than this target never sends it a matching
  // dragleave, which would strand the highlight on. `dragend` (source) and
  // `drop` (target) both bubble to the document, so one subscription covers it.
  useEffect(() => {
    const clear = () => {
      depth.current = 0
      setIsOver(false)
    }
    document.addEventListener('dragend', clear)
    document.addEventListener('drop', clear)
    return () => {
      document.removeEventListener('dragend', clear)
      document.removeEventListener('drop', clear)
    }
  }, [])

  const isActive = draggingId !== null && (accepts?.(draggingId) ?? true)

  const handleDragEnter = useCallback((event: ReactDragEvent) => {
    event.preventDefault()
    depth.current += 1
    setIsOver(true)
  }, [])

  const handleDragOver = useCallback((event: ReactDragEvent) => {
    // Without preventDefault the browser refuses the drop entirely.
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDragLeave = useCallback(() => {
    depth.current = Math.max(0, depth.current - 1)
    if (depth.current === 0) setIsOver(false)
  }, [])

  const handleDrop = useCallback(
    (event: ReactDragEvent) => {
      event.preventDefault()
      // Nested targets (a tab inside a strip) must not both handle one drop.
      event.stopPropagation()
      depth.current = 0
      setIsOver(false)
      const id =
        usePanelRegistry.getState().draggingId ||
        event.dataTransfer.getData(PANEL_DND_MIME)
      if (!id) return
      if (accepts?.(id) === false) return
      onDrop(id)
      endDrag()
    },
    [onDrop, accepts, endDrag],
  )

  return {
    isActive,
    isOver: isActive && isOver,
    dropProps: {
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
  }
}
