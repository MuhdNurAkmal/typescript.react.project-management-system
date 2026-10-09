import { useEffect, useState } from 'react'
import { Clock, LogIn, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useClock } from '@/hooks/useClock'
import { useOrg } from '@/hooks/useOrg'
import { formatElapsed } from '@/lib/attendanceUtils'

/** Fixed bottom-right button: shows Clock out while clocked in, otherwise Clock in (for the current company). */
export function FloatingClock() {
  const { open, openOrgName, loading, pending, canClock, toggle } = useClock()
  const { current } = useOrg()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!open) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [open])

  if (loading || !canClock) return null

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-1">
      <span className="max-w-60 truncate rounded-full bg-background px-3 py-1 text-xs shadow ring-1 ring-border">
        {open ? (
          <span className="flex items-center gap-1">
            <Clock className="size-3 shrink-0" />
            <span className="font-mono tabular-nums">{formatElapsed(now - new Date(open.clock_in).getTime())}</span>
            <span className="truncate text-muted-foreground">at {openOrgName}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">{current?.org.name}</span>
        )}
      </span>
      <Button size="lg" className="h-12 rounded-full px-6 shadow-lg" variant={open ? 'destructive' : 'default'} disabled={pending} onClick={toggle}>
        {open ? <LogOut /> : <LogIn />}
        {pending ? 'Please wait…' : open ? 'Clock out' : 'Clock in'}
      </Button>
    </div>
  )
}
