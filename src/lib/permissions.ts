export interface RoleLike {
  name: string
  is_pm: boolean
}

/** Permission flags for a project role (null = not a member). Pure, so it can be unit tested. */
export function permissionsFor(role: RoleLike | null) {
  const isPm = role?.is_pm ?? false
  return {
    isMember: role !== null,
    roleName: role?.name ?? null,
    isPm,
    canManageProject: isPm,
    canManageMembers: isPm,
    canManageTasks: isPm,
  }
}
