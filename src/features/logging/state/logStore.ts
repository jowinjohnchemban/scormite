import { create } from 'zustand'
import type { ApiCallRecord } from '@/shared/types'

interface LogState {
  records: ApiCallRecord[]
  addRecord: (record: ApiCallRecord) => void
  clearRecords: () => void
}

export const useLogStore = create<LogState>((set) => ({
  records: [],
  addRecord: (record) => set((s) => ({ records: [...s.records, record] })),
  clearRecords: () => set({ records: [] }),
}))
