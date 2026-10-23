/**
 * Registers SCORMite's WebMCP tools with the browser, when it supports WebMCP,
 * for as long as the app is mounted. The tools read the latest session through
 * a ref, so they are registered once and never go stale.
 *
 * The tools are their own file, fetched only in browsers with WebMCP, so the
 * start page stays light everywhere else.
 */

import { useEffect, useRef } from 'react'
import type { PackageSession } from '@/app/hooks/usePackageSession'
import { importWithRetry } from '@/app/moduleLoad'
import { useAppModeStore } from '@/app/state/appModeStore'
import { getModelContext } from './modelContext'

export function useWebMcpTools(session: PackageSession, advancedAvailable: boolean): void {
  const latest = useRef({ session, advancedAvailable })
  useEffect(() => {
    latest.current = { session, advancedAvailable }
  })

  useEffect(() => {
    const modelContext = getModelContext()
    if (!modelContext) return
    const unregister = new AbortController()
    importWithRetry(() => import('./tools'))
      .then(({ createScormiteTools }) => {
        if (unregister.signal.aborted) return
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
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) console.warn('[Scormite WebMCP] tools could not be loaded', error)
      })
    return () => unregister.abort()
  }, [])
}
