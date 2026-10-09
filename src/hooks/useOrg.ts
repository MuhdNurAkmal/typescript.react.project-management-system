import { useContext } from 'react'
import { OrgContext } from '@/lib/org-context'

export function useOrg() {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used inside <OrgProvider>')
  return ctx
}
