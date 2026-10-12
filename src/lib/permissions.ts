export interface RoleLike {
  name: string
  is_pm: boolean
  /** Can create and edit cards. Missing means yes, so older role objects keep working. */
  can_edit?: boolean
}

/** Permission flags for a project role (null = not a member). Pure, so it can be unit tested. */
export function permissionsFor(role: RoleLike | null) {
  const isPm = role?.is_pm ?? false
  const canEdit = role !== null && (isPm || (role.can_edit ?? true))
  return {
    isMember: role !== null,
    roleName: role?.name ?? null,
    isPm,
    canManageProject: isPm,
    canManageMembers: isPm,
    /** Delete any card, edit milestones. */
    canManageTasks: isPm,
    /** Create, edit, move and assign cards (Trello style). Everyone but read-only roles. */
    canEditTasks: canEdit,
  }
}
