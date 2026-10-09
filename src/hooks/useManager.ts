import { useOrg } from '@/hooks/useOrg'

/** True if the user is an owner or admin of the current company (they review attendance and leave). */
export function useIsManager() {
  return useOrg().isAdmin
}
