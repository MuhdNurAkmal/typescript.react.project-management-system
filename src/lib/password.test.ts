import { describe, expect, it } from 'vitest'
import { passwordStrength, validatePasswordChange } from '@/lib/password'

describe('validatePasswordChange', () => {
  it('accepts a valid change', () => {
    expect(validatePasswordChange('oldpassword', 'newpassword1', 'newpassword1')).toBeNull()
  })
  it('needs the current password', () => {
    expect(validatePasswordChange('', 'newpassword1', 'newpassword1')).toMatch(/current/i)
  })
  it('needs at least 8 characters', () => {
    expect(validatePasswordChange('oldpassword', 'short', 'short')).toMatch(/at least 8/)
  })
  it('rejects reusing the current password', () => {
    expect(validatePasswordChange('samepassword', 'samepassword', 'samepassword')).toMatch(/different/i)
  })
  it('rejects a mismatched confirmation', () => {
    expect(validatePasswordChange('oldpassword', 'newpassword1', 'newpassword2')).toMatch(/do not match/i)
  })
})

describe('passwordStrength', () => {
  it('is weak when short or one kind of character', () => {
    expect(passwordStrength('abc')).toBe('weak')
    expect(passwordStrength('abcdefgh')).toBe('weak')
  })
  it('is fair with two kinds of characters', () => {
    expect(passwordStrength('abcdefg1')).toBe('fair')
  })
  it('is strong when long or varied', () => {
    expect(passwordStrength('Abcdefg1')).toBe('strong')
    expect(passwordStrength('correcthorsebattery')).toBe('strong')
  })
})
