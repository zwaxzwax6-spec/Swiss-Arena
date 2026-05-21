const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

export function monthNameFr(date: Date): string {
  return MONTHS_FR[date.getMonth()]
}

export function formatCHF(amount: number): string {
  return amount.toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** "15 mai 2026" */
export function formatDateFr(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
}

/** "15.05.2026" */
export function formatDateShort(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

/** Whole days from now until the due date (negative = past due). */
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const due = new Date(iso).getTime()
  const now = Date.now()
  return Math.ceil((due - now) / (1000 * 60 * 60 * 24))
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** "15 mai 2026 à 14:32" */
export function formatDateTimeFr(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()} à ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "Prénom Nom, Adresse, NPA Ville" — one-line copyable address. */
export function formatAddressOneLine(o: {
  first_name: string
  last_name: string
  address: string
  postal_code: string
  city: string
}): string {
  return `${o.first_name} ${o.last_name}, ${o.address}, ${o.postal_code} ${o.city}`
}
