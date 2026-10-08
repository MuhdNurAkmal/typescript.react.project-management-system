export interface ProjectFormValues {
  name: string
  description: string
  type: 'grant' | 'industrial'
  sponsor: string
  start_date: string
  end_date: string
  budget: string
}

export const emptyProjectForm: ProjectFormValues = {
  name: '',
  description: '',
  type: 'grant',
  sponsor: '',
  start_date: '',
  end_date: '',
  budget: '',
}

/** Returns an error message, or null if the values are valid. */
export function validateProjectForm(v: ProjectFormValues): string | null {
  if (!v.name.trim()) return 'Project name is required'
  if (v.start_date && v.end_date && v.end_date < v.start_date) return 'End date cannot be before start date'
  if (v.budget !== '') {
    const n = Number(v.budget)
    if (!Number.isFinite(n) || n < 0) return 'Budget must be a positive number'
  }
  return null
}

export function formToPayload(v: ProjectFormValues) {
  return {
    name: v.name.trim(),
    description: v.description.trim() || null,
    type: v.type,
    sponsor: v.sponsor.trim() || null,
    start_date: v.start_date || null,
    end_date: v.end_date || null,
    budget: v.budget === '' ? null : Number(v.budget),
  }
}
