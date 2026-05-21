import { lookupPostalCode, type PostalEntry } from '../lib/postal-codes'

export function isValidSwissPostalCode(code: string): boolean {
  return /^[1-9]\d{3}$/.test(code)
}

/** Returns matching towns for a 4-digit code, or [] if invalid/unknown. */
export function usePostalLookup(code: string): PostalEntry[] {
  if (!isValidSwissPostalCode(code)) return []
  return lookupPostalCode(code)
}
