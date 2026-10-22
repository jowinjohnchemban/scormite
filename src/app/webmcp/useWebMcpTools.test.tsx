/**
 * The hook registers SCORMite's tools with the browser's WebMCP model
 * context, unregisters them on unmount, and does nothing without WebMCP.
 */

import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PackageSession } from '@/app/hooks/usePackageSession'
import type { ModelContextTool } from './modelContext'
import { useWebMcpTools } from './useWebMcpTools'

const session = { pkg: null } as unknown as PackageSession

afterEach(() => {
  delete (document as Document & { modelContext?: unknown }).modelContext
})

describe('useWebMcpTools', () => {
  it('registers every tool and unregisters them on unmount', () => {
    const registered: { tool: ModelContextTool; signal: AbortSignal }[] = []
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        registerTool: vi.fn(async (tool: ModelContextTool, options: { signal: AbortSignal }) => {
          registered.push({ tool, signal: options.signal })
        }),
      },
    })

    const { unmount } = renderHook(() => useWebMcpTools(session, true))
    expect(registered.map((r) => r.tool.name)).toEqual([
      'get_session',
      'get_cmi',
      'get_api_log',
      'get_validation_issues',
      'get_report',
      'launch_item',
      'navigate',
      'relaunch_item',
      'discard_and_restart',
      'set_view_mode',
    ])
    expect(registered.every((r) => !r.signal.aborted)).toBe(true)

    unmount()
    expect(registered.every((r) => r.signal.aborted)).toBe(true)
  })

  it('does nothing where the browser has no WebMCP', () => {
    expect(() => renderHook(() => useWebMcpTools(session, true)).unmount()).not.toThrow()
  })
})
