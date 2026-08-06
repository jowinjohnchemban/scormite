import { useReducer, useEffect } from 'react'
import { runtimeEvents, useRuntimeStore } from '@/features/runtime'

export interface CmiSummary {
  completionStatus: string
  successStatus: string
  scoreRaw: string
  scoreScaled: string
  location: string
  totalTime: string
}

const EMPTY: CmiSummary = {
  completionStatus: 'unknown',
  successStatus: 'unknown',
  scoreRaw: '',
  scoreScaled: '',
  location: '',
  totalTime: '',
}

function extractSummary(
  cmi: Record<string, string>,
  version: '1.2' | '2004',
): CmiSummary {
  if (version === '1.2') {
    return {
      completionStatus: cmi['cmi.core.lesson_status'] ?? 'not attempted',
      successStatus: cmi['cmi.core.lesson_status'] ?? '',
      scoreRaw: cmi['cmi.core.score.raw'] ?? '',
      scoreScaled: '',
      location: cmi['cmi.core.lesson_location'] ?? '',
      totalTime: cmi['cmi.core.total_time'] ?? '',
    }
  }
  return {
    completionStatus: cmi['cmi.completion_status'] ?? 'unknown',
    successStatus: cmi['cmi.success_status'] ?? 'unknown',
    scoreRaw: cmi['cmi.score.raw'] ?? '',
    scoreScaled: cmi['cmi.score.scaled'] ?? '',
    location: cmi['cmi.location'] ?? '',
    totalTime: cmi['cmi.total_time'] ?? '',
  }
}

/**
 * Derives live CMI state from the active adapter, updating after each API call.
 * Lives in app/hooks/ because it crosses the runtime and player feature boundary.
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

  if (!adapter || !version) return EMPTY

  try {
    const cmi = adapter.getFlattenedCmi()
    return extractSummary(cmi, version)
  } catch {
    return EMPTY
  }
}
