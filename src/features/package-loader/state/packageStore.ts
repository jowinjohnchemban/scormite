import { create } from 'zustand'
import type { Package } from '@/shared/types'

interface PackageState {
  /** Currently loaded package, or null if none has been loaded. */
  package: Package | null
  setPackage: (pkg: Package) => void
  clearPackage: () => void
}

export const usePackageStore = create<PackageState>((set) => ({
  package: null,
  setPackage: (pkg) => set({ package: pkg }),
  clearPackage: () => set({ package: null }),
}))
