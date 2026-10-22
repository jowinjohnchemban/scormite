/**
 * Registers SCORMite's WebMCP tools with the browser, when it supports WebMCP,
 * for as long as the app is mounted. The tools read the latest session through
 * a ref, so they are registered once and never go stale.
 */

import { useEffect, useRef } from 'react'
import type { PackageSession } from '@/app/hooks/usePackageSession'
import { useAppModeStore } from '@/app/state/appModeStore'
import { getModelContext } from './modelContext'
import { createScormiteTools } from './tools'

export function useWebMcpTools(session: PackageSession, advancedAvailable: boolean): void {
  const latest = useRef({ session, advancedAvailable })
  useEffect(() => {
    latest.current = { session, advancedAvailable }
  })

  useEffect(() => {
    const modelContext = getModelContext()
    if (!modelContext) return
    const unregister = new AbortController()
    const tools = createScormiteTools({
      session: () => latest.current.session,
      mode: () => useAppModeStore.getState().mode,
      setMode: (mode) => useAppModeStore.getState().setMode(mode),
      advancedAvailable: () => latest.current.advancedAvailable,
    })
    for (const tool of tools) {
      modelContext.registerTool(tool, { signal: unregister.signal }).catch((error: unknown) => {
        // Disabled by Permissions-Policy (tools=()), or a name already taken.
        if (import.meta.env.DEV) console.warn(`[Scormite WebMCP] ${tool.name} not registered`, error)
      })
    }
    return () => unregister.abort()
  }, [])
}
