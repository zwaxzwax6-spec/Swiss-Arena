import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppNavBar from '../components/layout/AppNavBar'
import AppFooter from '../components/layout/AppFooter'
import Stepper from '../components/tunnel/Stepper'
import MiniCart from '../components/tunnel/MiniCart'
import StepCoordinates from '../components/tunnel/StepCoordinates'
import StepPayment from '../components/tunnel/StepPayment'
import StepRecap from '../components/tunnel/StepRecap'
import { EMPTY_FORM, type FormErrors, type OrderForm, type TunnelStep } from '../components/tunnel/types'
import { validateForm } from '../components/tunnel/validate'
import { supabase } from '../lib/supabase'
import { PRODUCT_PRICE, STRIPE_PAYMENT_LINK, type NewOrder, type PaymentMethod } from '../lib/types'
import { useToast } from '../components/ui/Toast'

export default function Commander() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [step, setStep] = useState<TunnelStep>(0)
  const [maxReached, setMaxReached] = useState<TunnelStep>(0)
  const [form, setForm] = useState<OrderForm>(EMPTY_FORM)
  const [payment, setPayment] = useState<PaymentMethod | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  function goTo(next: TunnelStep) {
    setStep(next)
    setMaxReached((m) => (next > m ? next : m))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleChange(field: keyof OrderForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e))
  }

  function continueFromCoordinates() {
    const errs = validateForm(form)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    goTo(1)
  }

  async function handleConfirm() {
    if (!payment) return
    setSubmitting(true)

    const isInvoice = payment === 'invoice_30d'
    const payload: NewOrder = {
      status: 'new',
      payment_method: payment,
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      company_name: form.companyName.trim() || null,
      address: form.address.trim(),
      postal_code: form.postalCode.trim(),
      city: form.city.trim(),
      canton: form.canton,
      amount_chf: PRODUCT_PRICE,
    }

    const insertData = isInvoice ? payload : { ...payload, stripe_payment_link_used: true }

    const { data, error } = await supabase
      .from('orders')
      .insert(insertData)
      .select('order_ref')
      .single()

    if (error || !data) {
      setSubmitting(false)
      toast('Une erreur est survenue. Réessayez.')
      return
    }

    const ref = data.order_ref as string

    if (isInvoice) {
      navigate(`/confirmation?ref=${encodeURIComponent(ref)}&method=invoice`)
    } else {
      const url = new URL(STRIPE_PAYMENT_LINK)
      url.searchParams.set('client_reference_id', ref)
      url.searchParams.set('prefilled_email', form.email.trim())
      window.location.href = url.toString()
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <AppNavBar />
      <MiniCart form={form} payment={payment} variant="banner" />

      <main className="flex-1 w-full max-w-6xl mx-auto px-5 md:px-10 py-10 md:py-16">
        <div className="text-center mb-2">
          <h1 className="text-[26px] md:text-[34px] font-extralight headline-glow">
            Finaliser votre <span className="font-serif italic">commande</span>
          </h1>
        </div>

        <div className="flex gap-10 mt-10">
          <div className="flex-1 min-w-0">
            <Stepper current={step} maxReached={maxReached} onStepClick={goTo} />

            {step === 0 && (
              <StepCoordinates
                form={form}
                errors={errors}
                onChange={handleChange}
                onContinue={continueFromCoordinates}
              />
            )}
            {step === 1 && (
              <StepPayment
                selected={payment}
                onSelect={setPayment}
                onContinue={() => payment && goTo(2)}
              />
            )}
            {step === 2 && payment && (
              <StepRecap
                form={form}
                payment={payment}
                submitting={submitting}
                onEdit={goTo}
                onConfirm={handleConfirm}
              />
            )}
          </div>

          <MiniCart form={form} payment={payment} variant="sidebar" />
        </div>
      </main>

      <AppFooter />
    </div>
  )
}
