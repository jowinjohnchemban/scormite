/**
 * Bridges timeline scrubbing to the CMI Inspector.
 *
 * Lives in `app/` because it joins two features (timeline + inspector) and
 * no single feature is allowed to reach across to the other. While the
 * timeline cursor points at a historical snapshot, the inspector shows that
 * snapshot's data with its diff highlighting; when the cursor is released
 * the inspector re-syncs to live runtime state.
 */

import { useEffect } from 'react'
import { useTimelineStore } from '@/features/timeline'
import { useInspectorStore } from '@/features/inspector'
import { useRuntimeStore } from '@/features/runtime'

export function useTimelineReplay(): void {
  const cursor = useTimelineStore((s) => s.cursor)
  const currentSnapshot = useTimelineStore((s) => {
    if (s.cursor === null) return null
    return s.snapshots[s.cursor] ?? null
  })

  useEffect(() => {
    const inspector = useInspectorStore.getState()

    if (cursor === null) {
      // Only re-sync when this effect is the one leaving replay mode; while
      // live, new snapshots arrive on every API call and the api-call
      // listener already pushed those values (with diff highlighting) —
      // re-running updateValues here would wipe that highlighting.
      if (!inspector.isReplay) return
      inspector.showLive()
      const adapter = useRuntimeStore.getState().adapter
      if (!adapter) return
      try {
        inspector.updateValues(adapter.getFlattenedCmi())
      } catch {
        // The player may have navigated away while the event was being handled.
      }
      return
    }

    if (currentSnapshot) {
      inspector.showSnapshot(currentSnapshot.data, currentSnapshot.changedPaths)
    }
  }, [cursor, currentSnapshot])
}
