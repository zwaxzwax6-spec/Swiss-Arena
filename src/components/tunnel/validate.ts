import { isValidSwissPostalCode } from '../../hooks/usePostalCode'
import type { FormErrors, OrderForm } from './types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^(0|\+41)[\d\s]{8,}$/

export function validateForm(form: OrderForm): FormErrors {
  const e: FormErrors = {}

  if (!form.firstName.trim()) e.firstName = 'Prénom requis'
  if (!form.lastName.trim()) e.lastName = 'Nom requis'

  if (!form.email.trim()) e.email = 'Email requis'
  else if (!EMAIL_RE.test(form.email.trim())) e.email = 'Email invalide'

  const phoneDigits = form.phone.replace(/[\s]/g, '')
  if (!form.phone.trim()) e.phone = 'Téléphone requis'
  else if (!PHONE_RE.test(form.phone.trim()) || phoneDigits.replace(/\D/g, '').length < 10)
    e.phone = 'Numéro invalide (0... ou +41...)'

  if (!form.address.trim()) e.address = 'Adresse requise'

  if (!form.postalCode.trim()) e.postalCode = 'NPA requis'
  else if (!isValidSwissPostalCode(form.postalCode.trim())) e.postalCode = 'NPA invalide'

  if (!form.city.trim()) e.city = 'Ville requise'
  if (!form.canton.trim()) e.canton = 'Canton requis'

  return e
}

export function isFormValid(form: OrderForm): boolean {
  return Object.keys(validateForm(form)).length === 0
}
