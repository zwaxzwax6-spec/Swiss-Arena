import { describe, it, expect } from 'vitest'
import { nextAction, applyAction, needsAction, isPaid, countsForRevenue, statKpis, echeanceInfo } from './orders'
import type { Order } from './types'

function makeOrder(over: Partial<Order>): Order {
  return {
    id: 'id', order_ref: 'SA-2026-00001', status: 'new', payment_method: 'stripe',
    first_name: 'Jean', last_name: 'Dupont', email: 'j@d.ch', phone: '+41790000000',
    company_name: null, address: 'Rue 1', postal_code: '1000', city: 'Lausanne',
    canton: 'VD', google_business_url: 'https://g.page/x', product: 'plaque-nfc-v1',
    quantity: 1, amount_chf: 69, stripe_payment_link_used: true,
    invoice_pdf_url: null, invoice_due_date: null, invoice_paid_at: null,
    relance_count: 0, last_relance_at: null, confirmed_at: null, invoiced_at: null,
    configured_at: null, shipped_at: null, tracking_number: null, notes: null,
    confirmation_email_sent: false, confirmation_email_error: null,
    created_at: '2026-05-21T12:00:00Z', updated_at: '2026-05-21T12:00:00Z',
    ...over,
  }
}

describe('nextAction', () => {
  it('new + stripe → configure (Stripe is already paid)', () => {
    expect(nextAction(makeOrder({ status: 'new', payment_method: 'stripe' }))?.type).toBe('configure')
  })
  it('new + invoice → mark_invoiced (générer la facture)', () => {
    expect(nextAction(makeOrder({ status: 'new', payment_method: 'invoice_30d' }))?.type).toBe('mark_invoiced')
  })
  it('invoiced → configure', () => {
    expect(nextAction(makeOrder({ status: 'invoiced', payment_method: 'invoice_30d' }))?.type).toBe('configure')
  })
  it('configured → ship', () => {
    expect(nextAction(makeOrder({ status: 'configured' }))?.type).toBe('ship')
  })
  it('shipped (stripe) → complete', () => {
    expect(nextAction(makeOrder({ status: 'shipped', payment_method: 'stripe' }))?.type).toBe('complete')
  })
  it('awaiting_payment → pay', () => {
    expect(nextAction(makeOrder({ status: 'awaiting_payment', payment_method: 'invoice_30d' }))?.type).toBe('pay')
  })
  it('paid → null (no further required action)', () => {
    expect(nextAction(makeOrder({ status: 'paid', payment_method: 'invoice_30d' }))).toBeNull()
  })
  it('overdue → relance', () => {
    expect(nextAction(makeOrder({ status: 'overdue', payment_method: 'invoice_30d' }))?.type).toBe('relance')
  })
  it('completed → null', () => {
    expect(nextAction(makeOrder({ status: 'completed' }))).toBeNull()
  })
  it('recovery → null', () => {
    expect(nextAction(makeOrder({ status: 'recovery' }))).toBeNull()
  })
})

describe('applyAction', () => {
  const now = '2026-05-21T12:00:00.000Z'
  it('mark_invoiced sets invoiced_at + due date +30d', () => {
    const p = applyAction('mark_invoiced', makeOrder({}), { now })
    expect(p.status).toBe('invoiced')
    expect(p.invoiced_at).toBe(now)
    expect(new Date(p.invoice_due_date as string).getTime()).toBe(new Date(now).getTime() + 30 * 86400000)
  })
  it('pay sets invoice_paid_at + status paid', () => {
    expect(applyAction('pay', makeOrder({ status: 'awaiting_payment' }), { now })).toEqual({ status: 'paid', invoice_paid_at: now })
  })
  it('configure sets configured_at', () => {
    expect(applyAction('configure', makeOrder({}), { now })).toEqual({ status: 'configured', configured_at: now })
  })
  it('ship on invoice → awaiting_payment + shipped_at + tracking', () => {
    expect(applyAction('ship', makeOrder({ payment_method: 'invoice_30d' }), { now, tracking: 'T1' }))
      .toEqual({ status: 'awaiting_payment', shipped_at: now, tracking_number: 'T1' })
  })
  it('ship on stripe → shipped + shipped_at, null tracking when empty', () => {
    expect(applyAction('ship', makeOrder({ payment_method: 'stripe' }), { now, tracking: '' }))
      .toEqual({ status: 'shipped', shipped_at: now, tracking_number: null })
  })
  it('complete sets status only', () => {
    expect(applyAction('complete', makeOrder({ status: 'shipped' }), { now })).toEqual({ status: 'completed' })
  })
  it('relance increments count + sets last_relance_at, no status change', () => {
    expect(applyAction('relance', makeOrder({ relance_count: 1 }), { now })).toEqual({ relance_count: 2, last_relance_at: now })
  })
  it('escalate → recovery', () => {
    expect(applyAction('escalate', makeOrder({ status: 'overdue' }), { now })).toEqual({ status: 'recovery' })
  })
})

describe('echeanceInfo', () => {
  const future = (days: number) => new Date(Date.now() + days * 86400000).toISOString()
  it('stripe orders show no échéance', () => {
    expect(echeanceInfo(makeOrder({ payment_method: 'stripe', status: 'paid' })).label).toBe('—')
  })
  it('paid invoice shows Réglé', () => {
    expect(echeanceInfo(makeOrder({ payment_method: 'invoice_30d', status: 'paid' })).label).toBe('Réglé ✓')
  })
  it('past-due invoiced order shows ÉCHU and pulses', () => {
    const e = echeanceInfo(makeOrder({ payment_method: 'invoice_30d', status: 'awaiting_payment', invoice_due_date: future(-1) }))
    expect(e.label).toBe('ÉCHU')
    expect(e.pulse).toBe(true)
  })
  it('imminent due date (<=2d) is red and pulses', () => {
    const e = echeanceInfo(makeOrder({ payment_method: 'invoice_30d', status: 'awaiting_payment', invoice_due_date: future(1) }))
    expect(e.label).toBe('J-1')
    expect(e.pulse).toBe(true)
  })
  it('comfortable due date (>15d) is not pulsing', () => {
    const e = echeanceInfo(makeOrder({ payment_method: 'invoice_30d', status: 'invoiced', invoice_due_date: future(25) }))
    expect(e.label).toBe('J-25')
    expect(e.pulse).toBeUndefined()
  })
})

describe('predicates + stats', () => {
  it('needsAction is false for completed/recovery', () => {
    expect(needsAction(makeOrder({ status: 'completed' }))).toBe(false)
    expect(needsAction(makeOrder({ status: 'recovery' }))).toBe(false)
    expect(needsAction(makeOrder({ status: 'new' }))).toBe(true)
  })
  it('isPaid covers paid + completed', () => {
    expect(isPaid(makeOrder({ status: 'paid' }))).toBe(true)
    expect(isPaid(makeOrder({ status: 'completed' }))).toBe(true)
    expect(isPaid(makeOrder({ status: 'awaiting_payment' }))).toBe(false)
  })
  it('countsForRevenue: Stripe always, Facture only when paid/completed', () => {
    expect(countsForRevenue(makeOrder({ payment_method: 'stripe', status: 'new' }))).toBe(true)
    expect(countsForRevenue(makeOrder({ payment_method: 'stripe', status: 'shipped' }))).toBe(true)
    expect(countsForRevenue(makeOrder({ payment_method: 'invoice_30d', status: 'new' }))).toBe(false)
    expect(countsForRevenue(makeOrder({ payment_method: 'invoice_30d', status: 'awaiting_payment' }))).toBe(false)
    expect(countsForRevenue(makeOrder({ payment_method: 'invoice_30d', status: 'paid' }))).toBe(true)
    expect(countsForRevenue(makeOrder({ payment_method: 'invoice_30d', status: 'completed' }))).toBe(true)
  })
  it('CA counts every Stripe order (paid at checkout) + only paid/completed Facture orders', () => {
    const ref = new Date('2026-05-21T12:00:00Z')
    const orders = [
      // Stripe — count regardless of status (money already collected at checkout)
      makeOrder({ payment_method: 'stripe', status: 'new', amount_chf: 79, created_at: '2026-05-02T00:00:00Z' }),
      makeOrder({ payment_method: 'stripe', status: 'shipped', amount_chf: 79, created_at: '2026-05-03T00:00:00Z' }),
      makeOrder({ payment_method: 'stripe', status: 'completed', amount_chf: 79, created_at: '2026-05-04T00:00:00Z' }),
      // Facture — count only when paid or completed
      makeOrder({ payment_method: 'invoice_30d', status: 'paid', amount_chf: 79, created_at: '2026-05-10T00:00:00Z' }),
      makeOrder({ payment_method: 'invoice_30d', status: 'completed', amount_chf: 79, created_at: '2026-05-11T00:00:00Z' }),
      makeOrder({ payment_method: 'invoice_30d', status: 'awaiting_payment', amount_chf: 79, created_at: '2026-05-12T00:00:00Z' }),
      makeOrder({ payment_method: 'invoice_30d', status: 'overdue', amount_chf: 79, created_at: '2026-04-01T00:00:00Z' }),
      // Out-of-month Stripe — excluded from this month's CA
      makeOrder({ payment_method: 'stripe', status: 'completed', amount_chf: 79, created_at: '2026-04-15T00:00:00Z' }),
    ]
    const k = statKpis(orders, ref)
    expect(k.ca).toBe(395) // 3 Stripe (May) + 2 Facture paid/completed (May) = 5 × 79
    expect(k.monthCount).toBe(6) // orders created in May
    expect(k.todo).toBe(5) // needsAction: new, shipped, paid, awaiting_payment, overdue
    expect(k.unpaid).toBe(158) // awaiting_payment + overdue = 2 × 79
  })
})
