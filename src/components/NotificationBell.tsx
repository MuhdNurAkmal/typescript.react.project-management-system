import { Bell } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useNotifications } from '@/hooks/useNotifications'

export function NotificationBell() {
  const { data, unread, markRead } = useNotifications()
  const navigate = useNavigate()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative" aria-label={`Notifications, ${unread.length} unread`} />}>
        <Bell />
        {unread.length > 0 && (
          <span className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 w-80 overflow-y-auto">
        <div className="flex items-center justify-between px-2 py-1.5 text-sm font-medium">
          Notifications
          {unread.length > 0 && (
            <button className="text-xs font-normal text-primary hover:underline" onClick={() => markRead(unread.map((n) => n.id))}>
              Mark all read
            </button>
          )}
        </div>
        {data && data.length === 0 && <div className="px-2 py-6 text-center text-sm text-muted-foreground">You are all caught up.</div>}
        {data?.map((n) => (
          <DropdownMenuItem
            key={n.id}
            className="flex-col items-start gap-0.5"
            onClick={() => {
              if (!n.read) markRead([n.id])
              if (n.link) navigate(n.link)
            }}
          >
            <span className="flex w-full items-start gap-2">
              {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
              <span className="min-w-0 flex-1">
                <span className={`block text-sm ${n.read ? '' : 'font-medium'}`}>{n.title}</span>
                {n.body && <span className="block truncate text-xs text-muted-foreground">{n.body}</span>}
                <span className="block text-xs text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
              </span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
