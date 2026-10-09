export const MIN_PASSWORD_LENGTH = 8

/** Returns a message describing the first problem, or null when the change can go ahead. */
export function validatePasswordChange(current: string, next: string, confirm: string): string | null {
  if (!current) return 'Enter your current password'
  if (next.length < MIN_PASSWORD_LENGTH) return `The new password must be at least ${MIN_PASSWORD_LENGTH} characters`
  if (next === current) return 'The new password must be different from the current one'
  if (next !== confirm) return 'The new password and its confirmation do not match'
  return null
}

export type PasswordStrength = 'weak' | 'fair' | 'strong'

/** A rough guide for the strength meter (length plus variety of characters). It is a hint, not a security rule. */
export function passwordStrength(password: string): PasswordStrength {
  if (password.length < MIN_PASSWORD_LENGTH) return 'weak'
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length
  if (password.length >= 12 && kinds >= 3) return 'strong'
  if (kinds >= 3 || password.length >= 14) return 'strong'
  return kinds >= 2 ? 'fair' : 'weak'
}
