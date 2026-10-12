export interface RoleLike {
  name: string
  is_pm: boolean
  /** Can create and edit cards. Missing means yes, so older role objects keep working. */
  can_edit?: boolean
  /** Can delete cards. Missing means yes, like can_edit. */
  can_delete?: boolean
}

/** Permission flags for a project role (null = not a member). Pure, so it can be unit tested. */
export function permissionsFor(role: RoleLike | null) {
  const isPm = role?.is_pm ?? false
  const canEdit = role !== null && (isPm || (role.can_edit ?? true))
  const canDelete = role !== null && (isPm || ((role.can_delete ?? true) && canEdit))
  return {
    isMember: role !== null,
    roleName: role?.name ?? null,
    isPm,
    canManageProject: isPm,
    canManageMembers: isPm,
    /** Edit milestones, delete other people's comments. */
    canManageTasks: isPm,
    /** Delete cards (on for every role by default; a team can switch it off for a role). */
    canDeleteTasks: canDelete,
    /** Create, edit, move and assign cards (Trello style). Everyone but read-only roles. */
    canEditTasks: canEdit,
  }
}
