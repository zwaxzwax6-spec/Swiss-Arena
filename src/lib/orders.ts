import type { Order, OrderStatus } from './types'
import { daysUntil } from './format'

function assertNever(x: never): never {
  throw new Error(`Unhandled order status: ${x}`)
}

// ─── Predicates ──────────────────────────────────────────────────────────────
const TERMINAL: OrderStatus[] = ['completed', 'recovery']
export const isPaid = (o: Order) => o.status === 'paid' || o.status === 'completed'
export const needsAction = (o: Order) => !TERMINAL.includes(o.status)
export const canEscalate = (o: Order) =>
  o.status === 'awaiting_payment' || o.status === 'overdue'

// ─── Action descriptors ──────────────────────────────────────────────────────
export type AdminActionType =
  | 'confirm'
  | 'generate_invoice'
  | 'mark_invoiced'
  | 'pay'
  | 'configure'
  | 'ship'
  | 'complete'
  | 'relance'
  | 'escalate'

export interface ActionDescriptor {
  type: AdminActionType
  label: string
  /** Tailwind classes for the pill-style primary button. */
  className: string
}

type StyleKey = 'emerald' | 'blue' | 'indigo' | 'cyan' | 'violet' | 'gray' | 'red'
const STYLE: Record<StyleKey, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/25',
  blue: 'bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 border border-blue-500/25',
  indigo: 'bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 border border-indigo-500/25',
  cyan: 'bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/25',
  violet: 'bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 border border-violet-500/25',
  gray: 'bg-white/10 text-white/60 hover:bg-white/15 border border-white/15',
  red: 'bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/25',
}

/** The single primary "next action" for an order, or null when terminal. */
export function nextAction(o: Order): ActionDescriptor | null {
  switch (o.status) {
    case 'new':
      return o.payment_method === 'stripe'
        ? { type: 'pay', label: '✓ Payée', className: STYLE.emerald }
        : { type: 'confirm', label: '✉️ Confirmée', className: STYLE.blue }
    case 'confirmed':
      return o.invoice_pdf_url
        ? { type: 'mark_invoiced', label: '📤 Envoyée', className: STYLE.indigo }
        : { type: 'generate_invoice', label: '📄 Facture', className: STYLE.indigo }
    case 'invoiced':
      return { type: 'configure', label: '⚙️ Config', className: STYLE.cyan }
    case 'paid':
      return o.shipped_at
        ? { type: 'complete', label: '✅ Terminer', className: STYLE.gray }
        : { type: 'configure', label: '⚙️ Config', className: STYLE.cyan }
    case 'configured':
      return { type: 'ship', label: '📦 Expédier', className: STYLE.violet }
    case 'shipped':
      return { type: 'complete', label: '✅ Terminer', className: STYLE.gray }
    case 'awaiting_payment':
      return { type: 'pay', label: '✓ Payée', className: STYLE.emerald }
    case 'overdue':
      return { type: 'relance', label: 'Relancer', className: STYLE.red }
    case 'completed':
    case 'recovery':
      return null
    default:
      return assertNever(o.status)
  }
}

// ─── Transition patch builder ────────────────────────────────────────────────
const DAY = 86400000

interface ApplyCtx {
  now?: string
  tracking?: string
}

/** Returns the Supabase patch for an action. Pure — caller persists it. */
export function applyAction(
  type: AdminActionType,
  order: Order,
  ctx: ApplyCtx = {},
): Partial<Order> {
  const now = ctx.now ?? new Date().toISOString()
  switch (type) {
    case 'confirm':
      return { status: 'confirmed', confirmed_at: now }
    case 'mark_invoiced':
      return {
        status: 'invoiced',
        invoiced_at: now,
        invoice_due_date: new Date(new Date(now).getTime() + 30 * DAY).toISOString(),
      }
    case 'pay':
      return { status: 'paid', invoice_paid_at: now }
    case 'configure':
      return { status: 'configured', configured_at: now }
    case 'ship':
      return {
        status: order.payment_method === 'invoice_30d' ? 'awaiting_payment' : 'shipped',
        shipped_at: now,
        tracking_number: ctx.tracking?.trim() || null,
      }
    case 'complete':
      return { status: 'completed' }
    case 'relance':
      return { relance_count: order.relance_count + 1, last_relance_at: now }
    case 'escalate':
      return { status: 'recovery' }
    case 'generate_invoice':
      return {} // handled out-of-band (PDF generation), no status change here
  }
}

// ─── Échéance display ────────────────────────────────────────────────────────
export interface EcheanceInfo {
  label: string
  className: string
  pulse?: boolean
}

const HAS_DUE: OrderStatus[] = ['invoiced', 'configured', 'shipped', 'awaiting_payment', 'overdue']

export function echeanceInfo(order: Order): EcheanceInfo {
  if (order.payment_method === 'stripe') return { label: '—', className: 'text-white/30' }
  if (order.status === 'paid' || order.status === 'completed')
    return { label: 'Réglé ✓', className: 'text-emerald-400/60' }
  if (!HAS_DUE.includes(order.status)) return { label: '—', className: 'text-white/30' }

  const d = daysUntil(order.invoice_due_date)
  if (d === null) return { label: '—', className: 'text-white/30' }
  if (d < 0) return { label: 'ÉCHU', className: 'text-red-400 bg-red-500/10 rounded-full px-2 py-0.5', pulse: true }
  if (d <= 2) return { label: `J-${d}`, className: 'text-red-400 font-medium', pulse: true }
  if (d <= 7) return { label: `J-${d}`, className: 'text-orange-400 font-medium' }
  if (d <= 15) return { label: `J-${d}`, className: 'text-orange-300/80' }
  return { label: `J-${d}`, className: 'text-emerald-400/70' }
}

// ─── Stats ───────────────────────────────────────────────────────────────────
// Local-time month bucketing is intentional: the admin reasons about CA in local (Swiss) calendar months.
export function isSameMonth(iso: string, ref: Date): boolean {
  const d = new Date(iso)
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
}

export interface StatKpis {
  ca: number
  monthCount: number
  todo: number
  unpaid: number
}

export function statKpis(orders: Order[], ref: Date): StatKpis {
  // CA bucketed by order creation month (not payment date) — volume proxy for a single-SKU product.
  const ca = orders
    .filter((o) => isPaid(o) && isSameMonth(o.created_at, ref))
    .reduce((s, o) => s + Number(o.amount_chf), 0)
  const monthCount = orders.filter((o) => isSameMonth(o.created_at, ref)).length
  const todo = orders.filter(needsAction).length
  const unpaid = orders
    .filter((o) => o.status === 'awaiting_payment' || o.status === 'overdue')
    .reduce((s, o) => s + Number(o.amount_chf), 0)
  return { ca, monthCount, todo, unpaid }
}
