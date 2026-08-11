export interface FieldDisplayConfig {
  path: string
  label: string
  category: 'cmi' | 'manifest' | 'runtime' | 'validation' | 'package' | 'other'
  description?: string
}

const fieldDisplayConfig: Readonly<FieldDisplayConfig[]> = [
  {
    path: 'cmi.core.lesson_location',
    label: 'Lesson Location',
    category: 'cmi',
  },
  {
    path: 'cmi.location',
    label: 'Lesson Location',
    category: 'cmi',
  },
  {
    path: 'cmi.core.lesson_status',
    label: 'Lesson Status',
    category: 'cmi',
  },
  {
    path: 'cmi.completion_status',
    label: 'Completion Status',
    category: 'cmi',
  },
  {
    path: 'cmi.success_status',
    label: 'Success Status',
    category: 'cmi',
  },
  {
    path: 'cmi.core.score.raw',
    label: 'Score (Raw)',
    category: 'cmi',
  },
  {
    path: 'cmi.score.raw',
    label: 'Score (Raw)',
    category: 'cmi',
  },
  {
    path: 'cmi.core.score.scaled',
    label: 'Score (Scaled)',
    category: 'cmi',
  },
  {
    path: 'cmi.score.scaled',
    label: 'Score (Scaled)',
    category: 'cmi',
  },
  {
    path: 'cmi.core.total_time',
    label: 'Total Time',
    category: 'cmi',
  },
  {
    path: 'cmi.total_time',
    label: 'Total Time',
    category: 'cmi',
  },
]

const fieldDisplayMap = Object.fromEntries(
  fieldDisplayConfig.map((field) => [field.path, field]),
) as Record<string, FieldDisplayConfig>

export function getFieldLabel(path: string): string {
  return fieldDisplayMap[path]?.label ?? path
}

export function getFieldDescription(path: string): string | undefined {
  return fieldDisplayMap[path]?.description
}

export function getFieldCategory(path: string): string {
  return fieldDisplayMap[path]?.category ?? 'other'
}
