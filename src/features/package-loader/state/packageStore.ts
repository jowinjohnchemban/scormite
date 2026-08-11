import { create } from 'zustand'
import type { Package } from '@/shared/types'

interface PackageState {
  /** Currently loaded package, or null if none has been loaded. */
  package: Package | null
  /**
   * Flat list of files inside the loaded package, in archive order.
   * Kept for the Package Explorer panel — the raw bytes are discarded
   * after caching, but the file list stays queryable for the lifetime
   * of the session.
   */
  filePaths: string[]
  setPackage: (pkg: Package) => void
  setFilePaths: (filePaths: string[]) => void
  clearPackage: () => void
}

export const usePackageStore = create<PackageState>((set) => ({
  package: null,
  filePaths: [],
  setPackage: (pkg) => set({ package: pkg }),
  setFilePaths: (filePaths) => set({ filePaths }),
  clearPackage: () => set({ package: null, filePaths: [] }),
}))
