import { useState, type KeyboardEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'

/** Password field with a show/hide button and a Caps Lock hint. */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  minLength,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  autoComplete: 'current-password' | 'new-password'
  minLength?: number
}) {
  const [show, setShow] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const watchCaps = (e: KeyboardEvent) => setCapsLock(e.getModifierState('CapsLock'))

  return (
    <div>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          minLength={minLength}
          required
          className="h-11 pr-11 pl-3"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyUp={watchCaps}
          onKeyDown={watchCaps}
          onBlur={() => setCapsLock(false)}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
          className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {capsLock && (
        <p role="status" className="mt-1.5 text-xs text-warning-foreground">
          Caps Lock is on.
        </p>
      )}
    </div>
  )
}
