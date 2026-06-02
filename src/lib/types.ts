export type OrderStatus =
  | 'new'
  | 'invoiced'
  | 'paid'
  | 'configured'
  | 'shipped'
  | 'awaiting_payment'
  | 'overdue'
  | 'recovery'
  | 'completed'

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
  google_business_url: string

  product: string
  quantity: number
  amount_chf: number

  stripe_payment_link_used: boolean

  invoice_pdf_url: string | null
  invoice_due_date: string | null
  invoice_paid_at: string | null

  relance_count: number
  last_relance_at: string | null
  confirmed_at: string | null
  invoiced_at: string | null
  configured_at: string | null

  shipped_at: string | null
  tracking_number: string | null
  notes: string | null

  /** Set true by the send-confirmation-email Edge Function once the auto email is delivered. */
  confirmation_email_sent: boolean
  /** Last SMTP error from the auto confirmation send, if any (null when sent OK). */
  confirmation_email_error: string | null

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
}

export const PRODUCT_NAME = 'Plaque NFC Swiss Arena'
export const PRODUCT_PRICE = 79
export const PRODUCT_PRICE_OLD = 119
export const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/6oU14pa1mcYjbDl8rO4Ni03'

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  stripe: 'Stripe',
  invoice_30d: 'Facture 30j',
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Nouvelle',
  invoiced: 'Facturée',
  paid: 'Payée',
  configured: 'Configurée',
  shipped: 'Expédiée',
  awaiting_payment: 'En attente paiement',
  overdue: 'En retard',
  recovery: 'Recouvrement',
  completed: 'Terminée',
}

/** Tailwind classes for each status badge. */
export const STATUS_BADGE: Record<OrderStatus, string> = {
  new: 'bg-yellow-500/15 text-yellow-400',
  invoiced: 'bg-indigo-500/15 text-indigo-400',
  paid: 'bg-emerald-500/15 text-emerald-400',
  configured: 'bg-cyan-500/15 text-cyan-400',
  shipped: 'bg-violet-500/15 text-violet-400',
  awaiting_payment: 'bg-orange-500/15 text-orange-400',
  overdue: 'bg-red-500/15 text-red-400',
  recovery: 'bg-red-500/25 text-red-300',
  completed: 'bg-white/10 text-white/50',
}
