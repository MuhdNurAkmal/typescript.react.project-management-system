/**
 * Turns anything that was thrown into text for a toast.
 * Supabase returns plain objects ({ message, details, hint, code }), not Error instances,
 * so `instanceof Error` alone would hide the real reason.
 */
export function errorMessage(e: unknown, fallback = 'Something went wrong'): string {
  if (typeof e === 'string' && e) return e
  if (e && typeof e === 'object') {
    const { message, details, hint } = e as { message?: unknown; details?: unknown; hint?: unknown }
    if (typeof message === 'string' && message) {
      const extra = [details, hint].filter((x): x is string => typeof x === 'string' && x.length > 0)
      return extra.length ? `${message} (${extra.join('. ')})` : message
    }
  }
  return fallback
}
