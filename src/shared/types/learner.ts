/**
 * The learner an LMS reports to the course. Owned by the learner feature;
 * the type lives in shared so the app layer can hand it to the runtime.
 */
export interface LearnerInfo {
  /** `cmi.core.student_id` (1.2) / `cmi.learner_id` (2004). No whitespace. */
  id: string
  /** `cmi.core.student_name` (1.2) / `cmi.learner_name` (2004), conventionally "Last, First". */
  name: string
}
