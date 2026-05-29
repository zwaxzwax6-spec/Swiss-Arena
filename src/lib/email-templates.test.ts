import { describe, it, expect } from 'vitest'
import type { Order } from './types'
import { formatCHF, formatDateFr } from './format'
import {
  confirmationEmail,
  invoiceEmail,
  paymentReceivedEmail,
  shippedEmail,
  relanceEmail,
  fullEmailText,
  emailForAction,
} from './email-templates'

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'id-1',
    order_ref: 'SA-2026-00005',
    status: 'new',
    payment_method: 'stripe',
    first_name: 'Marc',
    last_name: 'Dupont',
    email: 'marc.dupont@email.ch',
    phone: '0791234567',
    company_name: null,
    address: 'Rue du Lac 1',
    postal_code: '1000',
    city: 'Lausanne',
    canton: 'VD',
    google_business_url: 'https://g.page/x',
    product: 'plaque',
    quantity: 1,
    amount_chf: 69,
    stripe_payment_link_used: true,
    invoice_pdf_url: null,
    invoice_due_date: '2026-06-28T10:00:00.000Z',
    invoice_paid_at: null,
    relance_count: 0,
    last_relance_at: null,
    confirmed_at: null,
    invoiced_at: null,
    configured_at: null,
    shipped_at: null,
    tracking_number: null,
    notes: null,
    confirmation_email_sent: false,
    confirmation_email_error: null,
    created_at: '2026-05-29T10:00:00.000Z',
    updated_at: '2026-05-29T10:00:00.000Z',
    ...overrides,
  }
}

describe('confirmationEmail', () => {
  it('stripe variant: payment received, ships in 24h', () => {
    const { subject, body } = confirmationEmail(makeOrder({ payment_method: 'stripe' }))
    expect(subject).toContain('SA-2026-00005')
    expect(subject).toContain('confirmée')
    expect(body).toContain('Marc')
    expect(body).toMatch(/paiement/i)
    expect(body).toMatch(/24h/i)
  })

  it('invoice_30d variant: order registered, verification in progress', () => {
    const { subject, body } = confirmationEmail(makeOrder({ payment_method: 'invoice_30d' }))
    expect(subject).toContain('SA-2026-00005')
    expect(subject).toContain('enregistrée')
    expect(body).toContain('Marc')
    expect(body).toMatch(/24h/i)
  })
})

describe('invoiceEmail', () => {
  it('includes ref, amount and due date', () => {
    const { subject, body } = invoiceEmail(makeOrder({ payment_method: 'invoice_30d' }))
    expect(subject).toContain('SA-2026-00005')
    expect(body).toContain(formatCHF(69))
    expect(body).toContain(formatDateFr('2026-06-28T10:00:00.000Z'))
  })

  it('falls back to a +30d deadline when invoice_due_date is null (modal preview)', () => {
    const { body } = invoiceEmail(makeOrder({ payment_method: 'invoice_30d', invoice_due_date: null }))
    // Deadline must never render as the empty placeholder.
    expect(body).not.toContain('au plus tard le —')
    expect(body).toMatch(/au plus tard le \d/)
  })
})

describe('paymentReceivedEmail', () => {
  it('confirms payment with amount', () => {
    const { subject, body } = paymentReceivedEmail(makeOrder())
    expect(subject).toMatch(/paiement reçu/i)
    expect(body).toContain(formatCHF(69))
    expect(body).toContain('SA-2026-00005')
  })
})

describe('shippedEmail', () => {
  it('mentions tracking number when present', () => {
    const { body } = shippedEmail(makeOrder({ tracking_number: '99.00.123456' }))
    expect(body).toContain('99.00.123456')
    expect(body).toMatch(/suivi/i)
  })

  it('omits tracking line when absent', () => {
    const { body } = shippedEmail(makeOrder({ tracking_number: null }))
    expect(body).not.toMatch(/suivi/i)
  })
})

describe('relanceEmail', () => {
  it('first relance (relance_count 0): courteous tone', () => {
    const { subject, body } = relanceEmail(makeOrder({ payment_method: 'invoice_30d', relance_count: 0 }))
    expect(subject).toMatch(/^Rappel — /)
    expect(body).toMatch(/Sauf erreur de notre part/)
    expect(body).toContain(formatCHF(69))
    expect(body).toContain(formatDateFr('2026-06-28T10:00:00.000Z'))
  })

  it('escalates to a firmer "dernier rappel" when relance_count >= 1', () => {
    const { subject, body } = relanceEmail(makeOrder({ payment_method: 'invoice_30d', relance_count: 1 }))
    expect(subject).toMatch(/dernier rappel/i)
    expect(subject).toContain('échéance proche')
    expect(body).toContain('contact@swiss-arena-avis.ch')
    expect(body).toContain(formatCHF(69))
  })
})

describe('fullEmailText', () => {
  it('prefixes the subject and separates the body', () => {
    const text = fullEmailText({ subject: 'Sujet', body: 'Corps' })
    expect(text).toBe('Objet : Sujet\n\nCorps')
  })
})

describe('emailForAction', () => {
  it('maps each emailing action to a template, others to null', () => {
    const o = makeOrder()
    expect(emailForAction('mark_invoiced', o)).not.toBeNull()
    expect(emailForAction('pay', o)).not.toBeNull()
    expect(emailForAction('ship', o)).not.toBeNull()
    expect(emailForAction('relance', o)).not.toBeNull()
    expect(emailForAction('configure', o)).toBeNull()
    expect(emailForAction('complete', o)).toBeNull()
    expect(emailForAction('escalate', o)).toBeNull()
  })
})
