import { useEffect, useRef, useState } from 'react'

function carriesFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes('Files') ?? false
}

/**
 * Lets a file be dropped anywhere in the window while `enabled`, and reports
 * whether one is currently being dragged over it (to show a drop overlay).
 *
 * A drop already handled by an inner drop target (which calls
 * `preventDefault`) is left alone, so the empty-state drop zone and this
 * hook never both load the same file.
 */
export function useWindowFileDrop(enabled: boolean, onFile: (file: File) => void): boolean {
  const [dragging, setDragging] = useState(false)
  // dragenter/dragleave fire for every child element crossed; count them.
  const depth = useRef(0)
  const onFileRef = useRef(onFile)

  useEffect(() => {
    onFileRef.current = onFile
  }, [onFile])

  useEffect(() => {
    if (!enabled) return
    const reset = () => {
      depth.current = 0
      setDragging(false)
    }
    const onDragEnter = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      depth.current += 1
      setDragging(true)
    }
    const onDragLeave = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDragging(false)
    }
    const onDragOver = (event: DragEvent) => {
      // Without this the browser navigates to the dropped file.
      if (carriesFiles(event)) event.preventDefault()
    }
    const onDrop = (event: DragEvent) => {
      const handled = event.defaultPrevented
      reset()
      if (handled || !carriesFiles(event)) return
      event.preventDefault()
      const file = event.dataTransfer?.files[0]
      if (file) onFileRef.current(file)
    }
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
      reset()
    }
  }, [enabled])

  return enabled && dragging
}
