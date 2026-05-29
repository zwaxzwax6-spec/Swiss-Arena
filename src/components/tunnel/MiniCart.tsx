import { Nfc } from 'lucide-react'
import {
  PRODUCT_NAME,
  PRODUCT_PRICE,
  PRODUCT_PRICE_OLD,
  type PaymentMethod,
} from '../../lib/types'
import { formatCHF } from '../../lib/format'
import type { OrderForm } from './types'

function PlaqueThumb({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  const dim = size === 'lg' ? 'h-16 w-16' : 'h-11 w-11'
  return (
    <div
      className={`${dim} rounded-2xl flex items-center justify-center shrink-0`}
      style={{
        background:
          'linear-gradient(140deg, rgba(180,210,255,0.14) 0%, rgba(255,255,255,0.03) 100%)',
        border: '1px solid rgba(160,210,255,0.18)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
      }}
    >
      <Nfc className={size === 'lg' ? 'h-7 w-7 text-white/70' : 'h-5 w-5 text-white/70'} />
    </div>
  )
}

function PriceTag() {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[18px] font-light text-white">{formatCHF(PRODUCT_PRICE)} CHF</span>
      <span className="text-[12px] text-white/35 line-through font-light">
        {PRODUCT_PRICE_OLD} CHF
      </span>
      <span className="text-[10px] tracking-[0.15em] uppercase text-white/55 border border-white/15 rounded-full px-1.5 py-0.5">
        −34%
      </span>
    </div>
  )
}

function clientLines(form: OrderForm): string[] {
  const lines: string[] = []
  const name = `${form.firstName} ${form.lastName}`.trim()
  if (name) lines.push(name)
  if (form.companyName.trim()) lines.push(form.companyName.trim())
  if (form.address.trim()) lines.push(form.address.trim())
  const cityLine = [form.postalCode, form.city].filter(Boolean).join(' ')
  const cityCanton = [cityLine, form.canton].filter(Boolean).join(', ')
  if (cityCanton.trim()) lines.push(cityCanton)
  if (form.email.trim()) lines.push(form.email.trim())
  if (form.phone.trim()) lines.push(form.phone.trim())
  return lines
}

interface MiniCartProps {
  form: OrderForm
  payment?: PaymentMethod | null
  variant: 'sidebar' | 'banner'
}

export default function MiniCart({ form, payment, variant }: MiniCartProps) {
  if (variant === 'banner') {
    return (
      <div className="lg:hidden sticky top-[57px] z-30 glass-pill rounded-none border-0 border-b border-white/[0.08]">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <PlaqueThumb size="sm" />
            <span className="text-[13px] font-light text-white/85">
              1× Plaque NFC
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] font-light text-white">{formatCHF(PRODUCT_PRICE)} CHF</span>
            <span className="text-[11px] text-white/35 line-through font-light">
              {PRODUCT_PRICE_OLD}
            </span>
          </div>
        </div>
      </div>
    )
  }

  const lines = clientLines(form)

  return (
    <aside className="hidden lg:block w-[320px] shrink-0">
      <div className="sticky top-[89px] card-glass rounded-card p-6">
        <div className="label-marker mb-5 flex items-center gap-3">
          <span className="h-px w-8 bg-white/25" />
          Votre commande
        </div>

        <div className="flex items-start gap-4">
          <PlaqueThumb />
          <div className="flex flex-col gap-1.5">
            <span className="text-[14px] font-light text-white/90 leading-snug">
              1× {PRODUCT_NAME}
            </span>
            <PriceTag />
          </div>
        </div>

        <div className="divider-h my-6" />

        {lines.length > 0 ? (
          <div className="space-y-1">
            <div className="text-[10px] tracking-[0.25em] uppercase text-white/40 mb-2.5">
              Livraison
            </div>
            {lines.map((l, i) => (
              <div
                key={i}
                className="text-[13px] font-light text-white/65 leading-relaxed animate-fade-up"
              >
                {l}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[13px] font-light text-white/35 leading-relaxed">
            Vos informations de livraison apparaîtront ici.
          </div>
        )}

        {payment && (
          <>
            <div className="divider-h my-6" />
            <div className="text-[10px] tracking-[0.25em] uppercase text-white/40 mb-2">
              Paiement
            </div>
            <div className="text-[13px] font-light text-white/65">
              {payment === 'stripe' ? 'Carte / TWINT (Stripe)' : 'Facture 30 jours'}
            </div>
          </>
        )}

        <div className="divider-h my-6" />

        <div className="flex items-center justify-between">
          <span className="text-[13px] font-light text-white/55">Total</span>
          <span className="text-[18px] font-light text-white">{formatCHF(PRODUCT_PRICE)} CHF</span>
        </div>
        <div className="text-[11px] text-white/40 font-light mt-1 text-right">
          Livraison 24h incluse
        </div>
      </div>
    </aside>
  )
}
