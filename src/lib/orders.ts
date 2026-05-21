import type { Order } from './types'
import { daysUntil } from './format'

export interface EcheanceInfo {
  label: string
  className: string
  pulse?: boolean
}

/** Due-date display for the orders table. */
export function echeanceInfo(order: Order): EcheanceInfo {
  if (order.payment_method === 'stripe') return { label: '—', className: 'text-white/30' }
  if (order.status === 'paid_invoice' || order.status === 'shipped')
    return { label: 'Réglé ✓', className: 'text-emerald-400/60' }

  const d = daysUntil(order.invoice_due_date)
  if (d === null) return { label: '—', className: 'text-white/30' }
  if (d < 0) return { label: 'ÉCHU', className: 'text-red-400 bg-red-500/10 rounded-full px-2 py-0.5' }
  if (d <= 3) return { label: `J-${d}`, className: 'text-red-400 font-medium', pulse: true }
  if (d <= 7) return { label: `J-${d}`, className: 'text-orange-400 font-medium' }
  return { label: `J-${d}`, className: 'text-white/60' }
}

// pending (Stripe, owner confirms payment) → paid_stripe
// invoiced (owner receives wire transfer) → paid_invoice
export const isPaid = (o: Order) => o.status === 'paid_stripe' || o.status === 'paid_invoice'
export const canMarkPaid = (o: Order) => o.status === 'pending' || o.status === 'invoiced'
export const canMarkShipped = (o: Order) => isPaid(o) && !o.shipped_at
export const canGenerateInvoice = (o: Order) => o.payment_method === 'invoice_30d'
export const canEscalate = (o: Order) => o.status === 'invoiced' || o.status === 'overdue'

export function isSameMonth(iso: string, ref: Date): boolean {
  const d = new Date(iso)
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
}
