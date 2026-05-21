import type { PaymentMethod } from '../../lib/types'

export interface OrderForm {
  firstName: string
  lastName: string
  email: string
  phone: string
  companyName: string
  address: string
  postalCode: string
  city: string
  canton: string
}

export type FormErrors = Partial<Record<keyof OrderForm, string>>

export const EMPTY_FORM: OrderForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  companyName: '',
  address: '',
  postalCode: '',
  city: '',
  canton: '',
}

export type TunnelStep = 0 | 1 | 2 // coordinates, payment, recap

export interface TunnelState {
  form: OrderForm
  payment: PaymentMethod | null
}
