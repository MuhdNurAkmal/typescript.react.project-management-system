import { describe, expect, it } from 'vitest'
import { permissionsFor } from '@/lib/permissions'

describe('permissionsFor', () => {
  it('gives a PM role full management rights', () => {
    const p = permissionsFor({ name: 'pm', is_pm: true })
    expect(p).toMatchObject({ isMember: true, isPm: true, canManageProject: true, canManageMembers: true, canManageTasks: true })
  })

  it('treats any custom role flagged is_pm as a manager', () => {
    expect(permissionsFor({ name: 'lead', is_pm: true }).canManageTasks).toBe(true)
  })

  it('gives a developer membership but no management rights', () => {
    const p = permissionsFor({ name: 'developer', is_pm: false })
    expect(p).toMatchObject({ isMember: true, roleName: 'developer', isPm: false, canManageProject: false, canManageMembers: false, canManageTasks: false })
  })

  it('gives non-members nothing', () => {
    expect(permissionsFor(null)).toMatchObject({ isMember: false, roleName: null, isPm: false, canManageTasks: false })
  })
})
