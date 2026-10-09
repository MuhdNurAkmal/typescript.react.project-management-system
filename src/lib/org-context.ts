import { createContext } from 'react'
import type { Organization, OrgRole } from '@/types/database'

export interface OrgEntry {
  org: Organization
  role: OrgRole
  /** False when the superadmin is looking at a company they do not belong to. */
  member: boolean
}

export interface OrgContextValue {
  /** Every company the user belongs to. */
  orgs: OrgEntry[]
  /** The company the app is currently showing (null until the user has one). */
  current: OrgEntry | null
  setCurrentId: (id: number) => void
  /** Owner or admin of the current company. */
  isAdmin: boolean
  isOwner: boolean
  loading: boolean
  refresh: () => Promise<void>
}

export const OrgContext = createContext<OrgContextValue | null>(null)
