import { describe, expect, it } from 'vitest'
import { errorMessage } from '@/lib/errors'

describe('errorMessage', () => {
  it('reads Error instances', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
  })
  it('reads Supabase style error objects, adding details and hint', () => {
    expect(errorMessage({ message: 'new row violates row-level security policy', details: null, hint: null })).toBe('new row violates row-level security policy')
    expect(errorMessage({ message: 'bad', details: 'Key is not present', hint: 'Check ids' })).toBe('bad (Key is not present. Check ids)')
  })
  it('accepts a string', () => {
    expect(errorMessage('plain')).toBe('plain')
  })
  it('falls back for anything else', () => {
    expect(errorMessage(null)).toBe('Something went wrong')
    expect(errorMessage({}, 'custom')).toBe('custom')
  })
})
