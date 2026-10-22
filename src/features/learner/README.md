# features/learner

The learner identity SCORMite reports to courses — the ID and name an LMS
would supply (`cmi.core.student_id` / `student_name` in SCORM 1.2,
`cmi.learner_id` / `learner_name` in SCORM 2004). Remembered per browser
(`state/learnerStore.ts`); edited from the header (`components/LearnerMenu.tsx`).
The app layer hands it to the runtime with each launch; this feature never
imports the runtime.

## Public surface

Import from other features only via this folder's `index.ts` barrel. This
boundary is enforced by ESLint (`eslint-plugin-boundaries`).
