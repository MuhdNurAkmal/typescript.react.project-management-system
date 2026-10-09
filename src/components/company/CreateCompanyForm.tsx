import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useOrg } from '@/hooks/useOrg'
import { supabase } from '@/lib/supabase'

/** Creates a company; the creator becomes its owner and the app switches to it. */
export function CreateCompanyForm({ onDone, submitLabel = 'Create company' }: { onDone?: () => void; submitLabel?: string }) {
  const { refresh, setCurrentId } = useOrg()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    const { data, error } = await supabase.from('organizations').insert({ name: trimmed }).select('id').single()
    if (error) {
      setBusy(false)
      toast.error(error.message)
      return
    }
    await refresh()
    setCurrentId(data.id)
    setBusy(false)
    toast.success(`Company "${trimmed}" created`)
    setName('')
    onDone?.()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="company-name">Company or group name</Label>
        <Input id="company-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Faculty Research Group" />
      </div>
      <Button type="submit" disabled={busy || !name.trim()}>
        {busy ? 'Creating…' : submitLabel}
      </Button>
    </form>
  )
}
