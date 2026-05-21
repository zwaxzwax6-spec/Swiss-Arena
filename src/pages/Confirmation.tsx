import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Copy } from 'lucide-react'
import AppNavBar from '../components/layout/AppNavBar'
import AppFooter from '../components/layout/AppFooter'
import GlassCard from '../components/ui/GlassCard'
import Button from '../components/ui/Button'
import { useToast } from '../components/ui/Toast'
import { supabase } from '../lib/supabase'
import type { Order } from '../lib/types'
import { formatCHF, formatDateShort } from '../lib/format'

function AnimatedCheck() {
  return (
    <div className="flex justify-center mb-8">
      <svg width="84" height="84" viewBox="0 0 84 84" fill="none">
        <circle
          cx="42"
          cy="42"
          r="40"
          stroke="rgba(52,211,153,0.35)"
          strokeWidth="2"
          strokeDasharray="251"
          strokeDashoffset="251"
          style={{ animation: 'drawCheck 0.8s cubic-bezier(0.22,1,0.36,1) forwards' }}
        />
        <path
          d="M26 43l11 11 21-23"
          stroke="rgb(52,211,153)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="50"
          strokeDashoffset="50"
          style={{ animation: 'drawCheck 0.5s cubic-bezier(0.22,1,0.36,1) 0.55s forwards' }}
        />
      </svg>
    </div>
  )
}

export default function Confirmation() {
  const [params] = useSearchParams()
  const { toast } = useToast()
  const ref = params.get('ref') ?? ''
  const method = params.get('method') === 'invoice' ? 'invoice' : 'stripe'

  const [order, setOrder] = useState<Order | null>(null)

  useEffect(() => {
    if (!ref) return
    supabase
      .from('orders')
      .select('*')
      .eq('order_ref', ref)
      .maybeSingle()
      .then(({ data }) => setOrder((data as Order) ?? null))
  }, [ref])

  function copyRef() {
    navigator.clipboard.writeText(ref).then(() => toast('Référence copiée'))
  }

  const isInvoice = method === 'invoice'

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <AppNavBar />
      <main className="flex-1 w-full max-w-[560px] mx-auto px-5 py-16 md:py-24">
        <AnimatedCheck />

        <h1 className="text-center text-[28px] md:text-[32px] font-extralight headline-glow mb-3">
          {isInvoice ? 'Commande enregistrée' : 'Merci pour votre commande'}
        </h1>
        <p className="text-center text-[15px] font-light text-white/65 mb-10">
          {isInvoice
            ? 'Votre facture sera disponible sous 24h.'
            : 'Votre paiement est en cours de traitement.'}
        </p>

        <GlassCard className="p-7">
          <div className="flex items-center justify-between">
            <span className="text-[12px] tracking-[0.2em] uppercase text-white/40">Référence</span>
            <button
              onClick={copyRef}
              className="flex items-center gap-2 text-white/85 hover:text-white transition-colors group"
            >
              <span className="font-mono text-[14px]">{ref || '—'}</span>
              <Copy className="h-3.5 w-3.5 text-white/40 group-hover:text-white/70" />
            </button>
          </div>

          {order && (
            <>
              <div className="divider-h my-5" />
              <div className="flex items-center justify-between text-[14px] font-light">
                <span className="text-white/55">Email</span>
                <span className="text-white/85">{order.email}</span>
              </div>
              <div className="flex items-center justify-between text-[14px] font-light mt-3">
                <span className="text-white/55">Montant</span>
                <span className="text-white/85">{formatCHF(order.amount_chf)} CHF</span>
              </div>
              {isInvoice && order.invoice_due_date && (
                <div className="flex items-center justify-between text-[14px] font-light mt-3">
                  <span className="text-white/55">Échéance</span>
                  <span className="text-white/85">
                    à régler avant le {formatDateShort(order.invoice_due_date)}
                  </span>
                </div>
              )}
            </>
          )}
        </GlassCard>

        <div className="mt-8 space-y-2 text-center">
          {isInvoice ? (
            <>
              <p className="text-[15px] font-light text-white/75">
                Vous recevrez votre facture et votre plaque NFC par courrier.
              </p>
              <p className="text-[13px] font-light text-white/55 max-w-md mx-auto">
                Vous disposez de 30 jours pour régler par virement bancaire via la QR-facture
                jointe.
              </p>
            </>
          ) : (
            <p className="text-[15px] font-light text-white/75">
              Votre plaque NFC sera expédiée sous 24h.
            </p>
          )}
        </div>

        <div className="mt-10 flex justify-center">
          <a href="/">
            <Button variant="ghost">Retour à l'accueil</Button>
          </a>
        </div>
      </main>
      <AppFooter />
    </div>
  )
}
