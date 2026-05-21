import { Nfc, Check } from 'lucide-react'
import GlassCard from '../ui/GlassCard'
import Button from '../ui/Button'
import { PRODUCT_NAME, PRODUCT_PRICE, type PaymentMethod } from '../../lib/types'
import { formatCHF } from '../../lib/format'
import type { OrderForm, TunnelStep } from './types'

interface Props {
  form: OrderForm
  payment: PaymentMethod
  submitting: boolean
  onEdit: (step: TunnelStep) => void
  onConfirm: () => void
}

function SectionLabel({ children, onEdit }: { children: React.ReactNode; onEdit?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <span className="text-[10px] tracking-[0.25em] uppercase text-white/40">{children}</span>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="text-[12px] font-light text-white/50 hover:text-white/85 underline underline-offset-2 transition-colors"
        >
          Modifier
        </button>
      )}
    </div>
  )
}

export default function StepRecap({ form, payment, submitting, onEdit, onConfirm }: Props) {
  return (
    <GlassCard variant="offer" premium className="w-full max-w-[560px] mx-auto p-7 md:p-9">
      <div className="label-marker mb-7 flex items-center justify-center gap-3">
        <span className="h-px w-8 bg-white/25" />
        Récapitulatif de votre commande
        <span className="h-px w-8 bg-white/25" />
      </div>

      {/* Product */}
      <div className="flex items-center gap-4">
        <div
          className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            background: 'linear-gradient(140deg, rgba(180,210,255,0.14), rgba(255,255,255,0.03))',
            border: '1px solid rgba(160,210,255,0.18)',
          }}
        >
          <Nfc className="h-6 w-6 text-white/70" />
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-light text-white/90">1× {PRODUCT_NAME}</div>
          <div className="text-[13px] font-light text-white/50">Livraison 24h incluse</div>
        </div>
        <div className="text-[15px] font-light text-white">{formatCHF(PRODUCT_PRICE)} CHF</div>
      </div>

      <div className="divider-h my-6" />

      {/* Delivery */}
      <SectionLabel onEdit={() => onEdit(0)}>Livraison</SectionLabel>
      <div className="text-[14px] font-light text-white/75 leading-relaxed">
        <div>
          {form.firstName} {form.lastName}
        </div>
        {form.companyName && <div className="text-white/55">{form.companyName}</div>}
        <div>{form.address}</div>
        <div>
          {form.postalCode} {form.city}, {form.canton}
        </div>
        <div className="text-white/55 mt-1">
          {form.email} · {form.phone}
        </div>
      </div>

      <div className="divider-h my-6" />

      {/* Payment */}
      <SectionLabel onEdit={() => onEdit(1)}>Paiement</SectionLabel>
      <div className="flex items-center gap-2.5 text-[14px] font-light text-white/75">
        <span className="h-1.5 w-1.5 rounded-full bg-glacier-400" />
        {payment === 'stripe' ? 'Payer maintenant (Stripe)' : 'Facture 30 jours (virement bancaire)'}
      </div>

      <div className="divider-h my-6" />

      {/* Total */}
      <div className="flex items-end justify-between mb-8">
        <span className="text-[15px] font-light text-white/85">Total</span>
        <div className="text-right">
          <div className="text-[26px] font-extralight text-white headline-glow leading-none">
            {formatCHF(PRODUCT_PRICE)} CHF
          </div>
          <div className="text-[11px] text-white/40 font-light mt-1.5">Livraison 24h incluse</div>
        </div>
      </div>

      <Button
        type="button"
        withArrow
        loading={submitting}
        onClick={onConfirm}
        className="w-full !py-4 !text-[16px]"
      >
        Confirmer ma commande
      </Button>

      <div className="mt-5 flex items-center justify-center gap-2 text-white/45">
        <Check className="h-3.5 w-3.5" />
        <span className="text-[12px] font-light">Paiement sécurisé · Fabrication suisse</span>
      </div>
    </GlassCard>
  )
}
