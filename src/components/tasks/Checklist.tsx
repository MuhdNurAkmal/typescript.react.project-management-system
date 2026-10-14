import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Percent, Plus, SquareCheck, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { checklistPercent } from '@/lib/checklist'
import { supabase } from '@/lib/supabase'
import type { ChecklistItem, ChecklistKind, Task } from '@/types/database'

interface Props {
  task: Task
  items: ChecklistItem[]
  canEdit: boolean
}

/** A Trello-style checklist: add, rename and delete items; each is a tick box or a percentage. */
export function Checklist({ task, items, canEdit }: Props) {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<ChecklistKind>('check')
  const percent = checklistPercent(items)

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['tasks', task.project_id] })
    await qc.invalidateQueries({ queryKey: ['milestones', task.project_id] })
    await qc.invalidateQueries({ queryKey: ['my-tasks'] })
  }
  const onError = (e: Error) => toast.error(e.message)

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('task_checklist_items').insert({ task_id: task.id, title: title.trim(), kind })
      if (error) throw error
    },
    onSuccess: async () => {
      setTitle('')
      await refresh()
    },
    onError,
  })
  const change = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<Pick<ChecklistItem, 'title' | 'kind' | 'progress'>> }) => {
      const { error } = await supabase.from('task_checklist_items').update(patch).eq('id', id)
      if (error) throw error
    },
    onSettled: refresh,
    onError,
  })
  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('task_checklist_items').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: refresh,
    onError,
  })

  return (
    <section className="space-y-3 border-t pt-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Checklist {items.length > 0 && `(${items.filter((i) => i.progress === 100).length}/${items.length})`}</h3>
        {items.length > 0 && <span className="text-xs text-muted-foreground tabular-nums">{percent}%</span>}
      </div>
      {items.length > 0 && (
        <div className="h-1.5 rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Checklist progress">
          <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
      )}
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">Optional. Break the task into steps; the task's progress becomes the average of the steps.</p>
      )}

      <ul className="space-y-1">
        {items.map((item) => (
          <Row
            key={item.id}
            item={item}
            canEdit={canEdit}
            onRename={(t) => change.mutate({ id: item.id, patch: { title: t } })}
            onProgress={(p) => change.mutate({ id: item.id, patch: { progress: p } })}
            onKind={(k) => change.mutate({ id: item.id, patch: { kind: k, progress: k === 'check' ? (item.progress === 100 ? 100 : 0) : item.progress } })}
            onDelete={() => remove.mutate(item.id)}
          />
        ))}
      </ul>

      {canEdit && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (title.trim()) add.mutate()
          }}
        >
          <Input className="min-w-40 flex-1" aria-label="New checklist item" placeholder="Add an item…" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="flex rounded-lg border p-0.5" role="group" aria-label="Item type">
            <KindButton active={kind === 'check'} onClick={() => setKind('check')} label="Tick box">
              <SquareCheck className="size-4" />
            </KindButton>
            <KindButton active={kind === 'percent'} onClick={() => setKind('percent')} label="Percentage">
              <Percent className="size-4" />
            </KindButton>
          </div>
          <Button type="submit" variant="success" disabled={add.isPending || !title.trim()}>
            <Plus /> Add
          </Button>
        </form>
      )}
    </section>
  )
}

function KindButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-md px-2 ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
    >
      {children}
    </button>
  )
}

function Row({
  item,
  canEdit,
  onRename,
  onProgress,
  onKind,
  onDelete,
}: {
  item: ChecklistItem
  canEdit: boolean
  onRename: (title: string) => void
  onProgress: (p: number) => void
  onKind: (k: ChecklistKind) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(item.title)
  const [value, setValue] = useState(String(item.progress))
  const done = item.progress === 100

  function saveName() {
    const t = name.trim()
    if (!t) return setName(item.title)
    if (t !== item.title) onRename(t)
  }
  function saveValue() {
    const p = Math.min(100, Math.max(0, Math.round(Number(value) || 0)))
    setValue(String(p))
    if (p !== item.progress) onProgress(p)
  }

  return (
    <li className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-muted/60">
      {item.kind === 'check' ? (
        <input
          type="checkbox"
          aria-label={`Done: ${item.title}`}
          className="size-4 shrink-0 accent-primary"
          checked={done}
          disabled={!canEdit}
          onChange={(e) => onProgress(e.target.checked ? 100 : 0)}
        />
      ) : (
        <span className="flex shrink-0 items-center">
          <Input
            type="number"
            min={0}
            max={100}
            aria-label={`Percent: ${item.title}`}
            className="h-7 w-16 px-2 text-xs tabular-nums"
            disabled={!canEdit}
            value={canEdit ? value : item.progress}
            onChange={(e) => setValue(e.target.value)}
            onBlur={saveValue}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
          <span className="ml-1 text-xs text-muted-foreground">%</span>
        </span>
      )}
      <input
        aria-label="Item text"
        value={name}
        readOnly={!canEdit}
        maxLength={200}
        onChange={(e) => setName(e.target.value)}
        onBlur={saveName}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className={`min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm outline-none focus:border-ring read-only:cursor-default ${done ? 'text-muted-foreground line-through' : ''}`}
      />
      {canEdit && (
        <>
          <button
            type="button"
            title={item.kind === 'check' ? 'Change to a percentage' : 'Change to a tick box'}
            aria-label={item.kind === 'check' ? 'Change to a percentage' : 'Change to a tick box'}
            onClick={() => onKind(item.kind === 'check' ? 'percent' : 'check')}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {item.kind === 'check' ? <Percent className="size-3.5" /> : <SquareCheck className="size-3.5" />}
          </button>
          <button type="button" aria-label="Delete item" title="Delete item" onClick={onDelete} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive">
            <X className="size-3.5" />
          </button>
        </>
      )}
    </li>
  )
}
