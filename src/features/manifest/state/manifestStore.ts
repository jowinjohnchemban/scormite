import { create } from 'zustand'
import type { Manifest } from '@/shared/types'

interface ManifestState {
  /** Currently loaded manifest, or null if no package is loaded. */
  manifest: Manifest | null
  setManifest: (manifest: Manifest) => void
  clearManifest: () => void
}

export const useManifestStore = create<ManifestState>((set) => ({
  manifest: null,
  setManifest: (manifest) => set({ manifest }),
  clearManifest: () => set({ manifest: null }),
}))
