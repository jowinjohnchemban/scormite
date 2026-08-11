/**
 * Bridges FETCH_EVENT messages from the package service worker into the
 * network store. Start once per document — the listener is a singleton, so
 * repeated calls are no-ops.
 */

import { useNetworkStore } from '@/features/player/state/networkStore'

interface FetchEventMessage {
  type?: unknown
  path?: unknown
  hit?: unknown
  status?: unknown
  timestamp?: unknown
  durationMs?: unknown
}

let monitorStarted = false

export function startNetworkMonitor(): void {
  if (monitorStarted) return
  if (!('serviceWorker' in navigator)) return
  monitorStarted = true

  navigator.serviceWorker.addEventListener('message', (event: MessageEvent<FetchEventMessage>) => {
    const data = event.data
    if (!data || data.type !== 'FETCH_EVENT') return
    useNetworkStore.getState().addEntry({
      path: typeof data.path === 'string' ? data.path : '',
      hit: data.hit === true,
      status: typeof data.status === 'number' ? data.status : 0,
      timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
      durationMs: typeof data.durationMs === 'number' ? data.durationMs : 0,
    })
  })
}

export function clearNetworkEntries(): void {
  useNetworkStore.getState().clearEntries()
}
