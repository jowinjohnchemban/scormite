import { useState, type FormEvent } from 'react'
import { UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, usePopoverClose } from '@/components/ui/popover'
import { learnerIdProblem, useLearnerStore } from '../state/learnerStore'

const inputClass =
  'h-7 w-full rounded-sm border border-border-subtle bg-surface-900 px-2 text-xs text-slate-200 ' +
  'outline-none placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-accent'

function LearnerForm() {
  const onDone = usePopoverClose()
  const learner = useLearnerStore()
  const [id, setId] = useState(learner.id)
  const [name, setName] = useState(learner.name)
  const problem = learnerIdProblem(id)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (problem) return
    learner.setLearner({ id, name })
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-2.5 text-xs">
      <p className="text-slate-400">
        The learner SCORMite reports to courses. Applies from the next launch.
      </p>
      <label className="block space-y-1">
        <span className="text-slate-300">Learner ID</span>
        <input
          className={inputClass}
          value={id}
          onChange={(event) => setId(event.target.value)}
          placeholder="e.g. learner-042"
          autoComplete="off"
          aria-invalid={problem !== null}
          aria-describedby={problem ? 'learner-id-problem' : undefined}
        />
      </label>
      {problem && (
        <p id="learner-id-problem" className="text-red-400">
          {problem}
        </p>
      )}
      <label className="block space-y-1">
        <span className="text-slate-300">Learner name</span>
        <input
          className={inputClass}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Last, First"
          autoComplete="off"
        />
      </label>
      <div className="flex justify-end gap-1 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={problem !== null}>
          Save
        </Button>
      </div>
    </form>
  )
}

/** Header control for the learner identity reported to courses. */
export function LearnerMenu() {
  const name = useLearnerStore((s) => s.name)
  const id = useLearnerStore((s) => s.id)
  const label = name || id
  return (
    <Popover
      title="Learner"
      ariaLabel={label ? `Learner: ${label}` : 'Learner'}
      triggerTitle="The learner ID and name reported to courses"
      align="end"
      label={
        <>
          <UserRound aria-hidden />
          <span className="hidden max-w-28 truncate md:inline">{label || 'Learner'}</span>
        </>
      }
    >
      <LearnerForm />
    </Popover>
  )
}
