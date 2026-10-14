import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useConfirm } from '@/hooks/useConfirm'
import { errorMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

/** The company's invitation link: share it, turn it off, or replace it (which kills the old link). Admins only. */
export function InviteLinkCard({ orgId, orgName }: { orgId: number; orgName: string }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const key = ['org-invite', orgId]

  const invite = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from('organization_invites').select('*').eq('organization_id', orgId).maybeSingle()
      if (error) throw error
      return data
    },
  })

  const toggle = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.from('organization_invites').update({ enabled }).eq('organization_id', orgId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e) => toast.error(errorMessage(e, 'Could not update the link')),
  })

  const reset = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('reset_invite_code', { p_org_id: orgId })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('New link created. The old one no longer works.')
      return qc.invalidateQueries({ queryKey: key })
    },
    onError: (e) => toast.error(errorMessage(e, 'Could not create a new link')),
  })

  const link = invite.data ? `${window.location.origin}/join/${invite.data.code}` : ''

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy. Select the link and copy it by hand.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="size-4" /> Invitation link
        </CardTitle>
        <CardDescription>
          Anyone with this link can register and join {orgName} as a member. Send it only to people you want in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {invite.isLoading && <p className="text-muted-foreground">Loading…</p>}
        {invite.error && <p className="text-danger-foreground">Could not load the link: {invite.error.message}</p>}
        {invite.data && (
          <>
            <div className="flex gap-2">
              <Input
                readOnly
                value={link}
                aria-label="Invitation link"
                className={invite.data.enabled ? '' : 'text-muted-foreground line-through'}
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button onClick={copy} disabled={!invite.data.enabled}>
                <Copy /> Copy
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" disabled={toggle.isPending} onClick={() => toggle.mutate(!invite.data!.enabled)}>
                {invite.data.enabled ? 'Turn link off' : 'Turn link on'}
              </Button>
              <Button
               
                size="sm"
                disabled={reset.isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Create a new link?',
                    description: 'The current link stops working straight away. People already in the company are not affected.',
                    confirmLabel: 'Create new link',
                  })
                  if (ok) reset.mutate()
                }}
              >
                Create a new link
              </Button>
              <span className="text-sm text-muted-foreground">
                {invite.data.enabled ? 'The link is on.' : 'The link is off: nobody can join with it.'}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
