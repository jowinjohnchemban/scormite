import { useEffect, useReducer } from 'react'
import { runtimeEvents, useRuntimeStore } from '@/features/runtime'
import { EMPTY_CMI_SUMMARY, summarizeCmi, type CmiSummary } from '@/app/course/summarizeCmi'

/**
 * Live summary of the running SCO's CMI state, re-derived after every API
 * call. Lives in app/hooks/ because it joins the runtime with the course
 * summary logic.
 */
export function useCmiState(): CmiSummary {
  const adapter = useRuntimeStore((s) => s.adapter)
  const version = useRuntimeStore((s) => s.scormVersion)

  // forceUpdate triggers a re-render after each api-call event.
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0)

  useEffect(() => {
    if (!adapter) return
    return runtimeEvents.on('api-call', forceUpdate)
  }, [adapter])

  if (!adapter || !version) return EMPTY_CMI_SUMMARY

  try {
    return summarizeCmi(adapter.getFlattenedCmi(), version)
  } catch {
    return EMPTY_CMI_SUMMARY
  }
}
