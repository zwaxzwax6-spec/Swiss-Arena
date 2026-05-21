export type OrderStatus =
  | 'pending'
  | 'paid_stripe'
  | 'invoiced'
  | 'paid_invoice'
  | 'shipped'
  | 'overdue'
  | 'recovery'

export type PaymentMethod = 'stripe' | 'invoice_30d'

export interface Order {
  id: string
  order_ref: string
  status: OrderStatus
  payment_method: PaymentMethod

  first_name: string
  last_name: string
  email: string
  phone: string
  company_name: string | null
  address: string
  postal_code: string
  city: string
  canton: string

  product: string
  quantity: number
  amount_chf: number

  stripe_payment_link_used: boolean

  invoice_pdf_url: string | null
  invoice_due_date: string | null
  invoice_paid_at: string | null

  shipped_at: string | null
  tracking_number: string | null
  notes: string | null

  created_at: string
  updated_at: string
}

/** Payload inserted by the public funnel (DB fills order_ref, timestamps, defaults). */
export interface NewOrder {
  status: OrderStatus
  payment_method: PaymentMethod
  first_name: string
  last_name: string
  email: string
  phone: string
  company_name: string | null
  address: string
  postal_code: string
  city: string
  canton: string
  amount_chf: number
  invoice_due_date: string | null
}

export const PRODUCT_NAME = 'Plaque NFC Swiss Arena'
export const PRODUCT_PRICE = 69
export const PRODUCT_PRICE_OLD = 119
export const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/bJefZjb5qbUf0YH8rO4Ni01'

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  stripe: 'Stripe',
  invoice_30d: 'Facture 30j',
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'En attente',
  paid_stripe: 'Payé',
  invoiced: 'Facturé',
  paid_invoice: 'Payé',
  shipped: 'Expédié',
  overdue: 'En retard',
  recovery: 'Recouvrement',
}

/** Tailwind classes for each status badge. */
export const STATUS_BADGE: Record<OrderStatus, string> = {
  pending: 'bg-white/10 text-white/60',
  paid_stripe: 'bg-emerald-500/15 text-emerald-400',
  invoiced: 'bg-blue-500/15 text-blue-400',
  paid_invoice: 'bg-emerald-500/15 text-emerald-400',
  shipped: 'bg-violet-500/15 text-violet-400',
  overdue: 'bg-red-500/15 text-red-400',
  recovery: 'bg-red-500/25 text-red-300',
}
