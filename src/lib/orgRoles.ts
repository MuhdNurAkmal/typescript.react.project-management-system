import type { Tone } from '@/components/Pill'

/** Badge colour for a company role, chosen by what the role can do so custom roles get a sensible colour too. */
export function orgRoleTone(role: { is_owner: boolean; is_admin: boolean }): Tone {
  if (role.is_owner) return 'violet'
  if (role.is_admin) return 'blue'
  return 'slate'
}
