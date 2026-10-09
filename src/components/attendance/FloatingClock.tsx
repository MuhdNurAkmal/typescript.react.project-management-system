import { useEffect, useState } from 'react'
import { Clock, LogIn, LogOut } from 'lucide-react'
import { useClock } from '@/hooks/useClock'
import { useOrg } from '@/hooks/useOrg'
import { formatElapsed } from '@/lib/attendanceUtils'

/** Fixed bottom-right button: shows Clock out while clocked in, otherwise Clock in (for the current company). */
export function FloatingClock() {
  const { open, others, loading, pending, canClock, toggle } = useClock()
  const { current } = useOrg()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!open) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [open])

  if (loading || !canClock) return null

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:right-8 sm:bottom-8">
      <span className="max-w-60 truncate rounded-full bg-background px-3 py-1 text-xs shadow ring-1 ring-border">
        {open ? (
          <span className="flex items-center gap-1">
            <Clock className="size-3 shrink-0" />
            <span className="font-mono tabular-nums">{formatElapsed(now - new Date(open.clock_in).getTime())}</span>
            <span className="truncate text-muted-foreground">at {current?.org.name}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">{current?.org.name}</span>
        )}
      </span>
      {others.length > 0 && (
        <span className="max-w-60 truncate rounded-full bg-background px-3 py-1 text-xs text-muted-foreground shadow ring-1 ring-border">
          Also clocked in at {others.map((o) => o.orgName).join(', ')}
        </span>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={toggle}
        aria-label={open ? 'Clock out' : 'Clock in'}
        className={`flex size-20 flex-col items-center justify-center gap-0.5 rounded-full text-xs font-medium text-white shadow-lift transition-transform hover:scale-105 active:scale-95 disabled:opacity-60 ${
          open ? 'bg-danger hover:bg-danger/90' : 'bg-primary hover:bg-primary/90'
        }`}
      >
        {open ? <LogOut className="size-6" /> : <LogIn className="size-6" />}
        {pending ? 'Wait…' : open ? 'Clock out' : 'Clock in'}
      </button>
    </div>
  )
}
