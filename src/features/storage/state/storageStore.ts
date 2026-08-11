import { create } from 'zustand'
import { inspectStorage, type StorageReport } from '@/features/storage/services/StorageService'

interface StorageState {
  report: StorageReport | null
  refreshing: boolean
  refresh: () => Promise<void>
}

export const useStorageStore = create<StorageState>((set, get) => ({
  report: null,
  refreshing: false,
  refresh: async () => {
    // Skip overlapping refreshes (interval tick while a click is in flight).
    if (get().refreshing) return
    set({ refreshing: true })
    try {
      const report = await inspectStorage()
      set({ report })
    } finally {
      set({ refreshing: false })
    }
  },
}))
