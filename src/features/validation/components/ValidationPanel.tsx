import { Button } from '@/components/ui/button'
import { ValidationService, countBySeverity } from '@/features/validation/services/ValidationService'
import { useValidationStore } from '@/features/validation/state/validationStore'
import { cn } from '@/shared/lib/utils'
import type { ValidationSeverity } from '@/shared/types'

const SEVERITY_STYLES: Record<ValidationSeverity, string> = {
  error: 'bg-red-400/15 text-red-300',
  warning: 'bg-amber-400/15 text-amber-200',
  suggestion: 'bg-sky-400/15 text-sky-300',
}

const SEVERITY_LABELS: Record<ValidationSeverity, string> = {
  error: 'Error',
  warning: 'Warning',
  suggestion: 'Suggestion',
}

/**
 * Static + runtime validation findings for the loaded package. The header
 * summarizes by severity; each row shows the rule, location, and message,
 * and can be dismissed individually.
 */
export function ValidationPanel() {
  const issues = useValidationStore((s) => s.issues)
  const lastRunAt = useValidationStore((s) => s.lastRunAt)

  const counts = countBySeverity(issues)
  const summary = [
    counts.error > 0 ? `${counts.error} error${counts.error === 1 ? '' : 's'}` : null,
    counts.warning > 0 ? `${counts.warning} warning${counts.warning === 1 ? '' : 's'}` : null,
    counts.suggestion > 0 ? `${counts.suggestion} suggestion${counts.suggestion === 1 ? '' : 's'}` : null,
  ].filter((part): part is string => part !== null)

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Validation">
      <header className="flex h-8 shrink-0 items-center justify-between border-b border-border-subtle px-2">
        <span className="text-[11px] text-slate-500">
          {issues.length === 0 ? (lastRunAt === null ? 'Not run yet' : 'No issues') : summary.join(' · ')}
        </span>
        {issues.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => ValidationService.clear()}>
            Clear
          </Button>
        )}
      </header>

      <div
        tabIndex={0}
        className="min-h-0 flex-1 overflow-auto p-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
      >
        {issues.length === 0 ? (
          <p className="text-xs text-slate-600">
            {lastRunAt === null
              ? 'Validation runs when a package loads and while the course is running.'
              : 'No issues found — the package looks clean.'}
          </p>
        ) : (
          <ul className="space-y-1" aria-label="Validation issue list">
            {issues.map((issue) => (
              <li key={issue.id} className="flex items-start gap-2 rounded-sm border border-border-subtle px-2 py-1.5">
                <span
                  className={cn(
                    'mt-px shrink-0 rounded-sm px-1.5 py-px text-[10px] font-medium uppercase tracking-wide',
                    SEVERITY_STYLES[issue.severity],
                  )}
                >
                  {SEVERITY_LABELS[issue.severity]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] leading-snug text-slate-300">{issue.message}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-slate-600">
                    {issue.source}
                    {issue.location !== undefined ? ` · ${issue.location}` : ''} · {issue.ruleId}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => ValidationService.dismiss(issue.id)}
                  aria-label="Dismiss issue"
                  className="shrink-0 text-slate-600 transition-colors hover:text-slate-200"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
