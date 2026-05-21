import { describe, it, expect } from 'vitest'
import { nextAction, applyAction, needsAction, isPaid, statKpis } from './orders'
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
    created_at: '2026-05-21T12:00:00Z', updated_at: '2026-05-21T12:00:00Z',
    ...over,
  }
}

describe('nextAction', () => {
  it('new + stripe → pay', () => {
    expect(nextAction(makeOrder({ status: 'new', payment_method: 'stripe' }))?.type).toBe('pay')
  })
  it('new + invoice → confirm', () => {
    expect(nextAction(makeOrder({ status: 'new', payment_method: 'invoice_30d' }))?.type).toBe('confirm')
  })
  it('confirmed without PDF → generate_invoice', () => {
    expect(nextAction(makeOrder({ status: 'confirmed', payment_method: 'invoice_30d' }))?.type).toBe('generate_invoice')
  })
  it('confirmed with PDF → mark_invoiced', () => {
    expect(nextAction(makeOrder({ status: 'confirmed', payment_method: 'invoice_30d', invoice_pdf_url: 'x.pdf' }))?.type).toBe('mark_invoiced')
  })
  it('invoiced → configure', () => {
    expect(nextAction(makeOrder({ status: 'invoiced', payment_method: 'invoice_30d' }))?.type).toBe('configure')
  })
  it('paid + not shipped (stripe) → configure', () => {
    expect(nextAction(makeOrder({ status: 'paid', payment_method: 'stripe' }))?.type).toBe('configure')
  })
  it('paid + shipped (invoice) → complete', () => {
    expect(nextAction(makeOrder({ status: 'paid', payment_method: 'invoice_30d', shipped_at: '2026-05-22T00:00:00Z' }))?.type).toBe('complete')
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
  it('confirm sets confirmed_at + status', () => {
    expect(applyAction('confirm', makeOrder({}), { now })).toEqual({ status: 'confirmed', confirmed_at: now })
  })
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
  it('statKpis sums CA from paid+completed this month and unpaid from awaiting+overdue', () => {
    const ref = new Date('2026-05-21T12:00:00Z')
    const orders = [
      makeOrder({ status: 'completed', amount_chf: 69, created_at: '2026-05-02T00:00:00Z' }),
      makeOrder({ status: 'paid', amount_chf: 69, created_at: '2026-05-10T00:00:00Z' }),
      makeOrder({ status: 'awaiting_payment', amount_chf: 69, created_at: '2026-05-11T00:00:00Z' }),
      makeOrder({ status: 'overdue', amount_chf: 69, created_at: '2026-04-01T00:00:00Z' }),
      makeOrder({ status: 'new', amount_chf: 69, created_at: '2026-05-12T00:00:00Z' }),
    ]
    const k = statKpis(orders, ref)
    expect(k.ca).toBe(138)
    expect(k.monthCount).toBe(4)
    expect(k.todo).toBe(4) // new + paid + awaiting_payment + overdue (needsAction = not in completed/recovery)
    expect(k.unpaid).toBe(138)
  })
})
