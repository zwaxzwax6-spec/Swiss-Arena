import { CreditCard, FileText } from 'lucide-react'
import Button from '../ui/Button'
import type { PaymentMethod } from '../../lib/types'

interface Props {
  selected: PaymentMethod | null
  onSelect: (method: PaymentMethod) => void
  onContinue: () => void
}

interface CardProps {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  subtitle: string
  footnote: string
  topRight?: React.ReactNode
}

function PaymentCard({ active, onClick, icon, title, subtitle, footnote, topRight }: CardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card-glass card-glass-hover rounded-card p-7 text-left flex flex-col h-full ${
        active ? 'card-selected' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-8">
        <span className="text-white/60">{icon}</span>
        {topRight}
      </div>
      <h3 className="text-[20px] font-extralight text-white mb-2">{title}</h3>
      <p className="text-[14px] font-light text-white/60 leading-relaxed mb-6">{subtitle}</p>
      <span className="text-[12px] font-light text-white/35 mt-auto">{footnote}</span>
    </button>
  )
}

export default function StepPayment({ selected, onSelect, onContinue }: Props) {
  return (
    <div className="w-full max-w-[720px] mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <PaymentCard
          active={selected === 'stripe'}
          onClick={() => onSelect('stripe')}
          icon={<CreditCard className="h-6 w-6" />}
          title="Payer maintenant"
          subtitle="Paiement sécurisé par carte ou TWINT"
          footnote="Vous serez redirigé vers Stripe"
          topRight={
            <div className="flex items-center gap-2 text-[10px] tracking-[0.15em] uppercase text-white/45 font-light">
              <span>Visa</span>
              <span className="text-white/15">·</span>
              <span>Mastercard</span>
              <span className="text-white/15">·</span>
              <span>TWINT</span>
            </div>
          }
        />
        <PaymentCard
          active={selected === 'invoice_30d'}
          onClick={() => onSelect('invoice_30d')}
          icon={<FileText className="h-6 w-6" />}
          title="Facture 30 jours"
          subtitle="Recevez votre plaque, payez sous 30 jours"
          footnote="Virement bancaire via QR-facture"
        />
      </div>

      <div className="mt-8 flex justify-center">
        <Button
          type="button"
          withArrow
          disabled={!selected}
          onClick={onContinue}
          className="w-full md:w-auto md:px-10"
        >
          Continuer vers le récapitulatif
        </Button>
      </div>
    </div>
  )
}
