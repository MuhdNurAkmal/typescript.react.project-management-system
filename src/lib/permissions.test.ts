import { describe, expect, it } from 'vitest'
import { permissionsFor } from '@/lib/permissions'

describe('permissionsFor', () => {
  it('gives a PM role full management rights', () => {
    const p = permissionsFor({ name: 'pm', is_pm: true })
    expect(p).toMatchObject({ isMember: true, isPm: true, canManageProject: true, canManageMembers: true, canManageTasks: true, canEditTasks: true, canDeleteTasks: true })
  })

  it('treats any custom role flagged is_pm as a manager', () => {
    expect(permissionsFor({ name: 'lead', is_pm: true }).canManageTasks).toBe(true)
  })

  it('lets any member edit and delete cards but not manage the project', () => {
    const p = permissionsFor({ name: 'developer', is_pm: false })
    expect(p).toMatchObject({ isMember: true, roleName: 'developer', isPm: false, canManageProject: false, canManageMembers: false, canManageTasks: false, canEditTasks: true, canDeleteTasks: true })
  })

  it('keeps a read-only role (can_edit false) from editing', () => {
    expect(permissionsFor({ name: 'viewer', is_pm: false, can_edit: false })).toMatchObject({ isMember: true, canEditTasks: false, canManageTasks: false })
  })

  it('lets a team switch deleting off for one role', () => {
    expect(permissionsFor({ name: 'intern', is_pm: false, can_edit: true, can_delete: false })).toMatchObject({ canEditTasks: true, canDeleteTasks: false, canManageTasks: false })
  })

  it('never lets a role delete cards it cannot edit', () => {
    expect(permissionsFor({ name: 'odd', is_pm: false, can_edit: false, can_delete: true }).canDeleteTasks).toBe(false)
  })

  it('a manager can always edit, even if the flag was cleared', () => {
    expect(permissionsFor({ name: 'pm', is_pm: true, can_edit: false }).canEditTasks).toBe(true)
  })

  it('gives non-members nothing', () => {
    expect(permissionsFor(null)).toMatchObject({ isMember: false, roleName: null, isPm: false, canManageTasks: false, canEditTasks: false })
  })
})
