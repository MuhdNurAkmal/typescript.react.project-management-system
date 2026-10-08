import { useEffect, useState } from 'react'
import { Clock, LogIn, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useClock } from '@/hooks/useClock'
import { formatElapsed } from '@/lib/attendanceUtils'

/** Fixed bottom-right button: shows Clock out while clocked in, otherwise Clock in. */
export function FloatingClock() {
  const { open, loading, pending, toggle } = useClock()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!open) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [open])

  if (loading) return null

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-1">
      {open && (
        <span className="flex items-center gap-1 rounded-full bg-background px-3 py-1 text-xs shadow ring-1 ring-border">
          <Clock className="size-3" />
          <span className="font-mono tabular-nums">{formatElapsed(now - new Date(open.clock_in).getTime())}</span>
        </span>
      )}
      <Button size="lg" className="h-12 rounded-full px-6 shadow-lg" variant={open ? 'destructive' : 'default'} disabled={pending} onClick={toggle}>
        {open ? <LogOut /> : <LogIn />}
        {pending ? 'Please wait…' : open ? 'Clock out' : 'Clock in'}
      </Button>
    </div>
  )
}
