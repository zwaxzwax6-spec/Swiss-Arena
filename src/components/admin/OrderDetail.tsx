import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { formatCHF, formatDateFr } from '../../lib/format'
import { PAYMENT_LABELS, PRODUCT_NAME, type Order } from '../../lib/types'

interface Props {
  order: Order
  onClose: () => void
  onSaveNotes: (id: string, notes: string) => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <div className="text-[10px] tracking-[0.25em] uppercase text-white/40 mb-3">{title}</div>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-1.5 text-[14px] font-light">
      <span className="text-white/45">{label}</span>
      <span className="text-white/85 text-right">{value}</span>
    </div>
  )
}

interface TimelineEvent {
  label: string
  date: string
}

function buildTimeline(order: Order): TimelineEvent[] {
  const events: TimelineEvent[] = [{ label: 'Commande créée', date: order.created_at }]
  if (order.payment_method === 'invoice_30d')
    events.push({ label: 'Facture émise', date: order.created_at })
  if (order.invoice_paid_at) events.push({ label: 'Paiement reçu', date: order.invoice_paid_at })
  if (order.shipped_at) events.push({ label: 'Expédiée', date: order.shipped_at })
  return events
}

export default function OrderDetail({ order, onClose, onSaveNotes }: Props) {
  const [notes, setNotes] = useState(order.notes ?? '')
  const timer = useRef<number>()
  const firstRender = useRef(true)

  useEffect(() => {
    setNotes(order.notes ?? '')
    firstRender.current = true
  }, [order.id, order.notes])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => onSaveNotes(order.id, notes), 500)
    return () => window.clearTimeout(timer.current)
  }, [notes, order.id, onSaveNotes])

  const timeline = buildTimeline(order)

  return (
    <div className="fixed inset-0 z-[80]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" style={{ backdropFilter: 'blur(2px)' }} />
      <aside
        className="absolute right-0 top-0 h-full w-full md:w-[480px] overflow-y-auto animate-slide-in"
        style={{
          background: 'linear-gradient(180deg, rgba(14,16,22,0.99), rgba(8,9,13,0.99))',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-5 border-b border-white/[0.08] bg-black/40 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <h2 className="font-mono text-[15px] text-white/90">{order.order_ref}</h2>
            <StatusBadge status={order.status} />
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-6">
          <Section title="Client">
            <Field label="Nom" value={`${order.first_name} ${order.last_name}`} />
            {order.company_name && <Field label="Entreprise" value={order.company_name} />}
            <Field label="Email" value={order.email} />
            <Field label="Téléphone" value={order.phone} />
            <Field
              label="Adresse"
              value={
                <>
                  {order.address}
                  <br />
                  {order.postal_code} {order.city}, {order.canton}
                </>
              }
            />
          </Section>

          <Section title="Commande">
            <Field label="Produit" value={PRODUCT_NAME} />
            <Field label="Quantité" value={order.quantity} />
            <Field label="Montant" value={`${formatCHF(order.amount_chf)} CHF`} />
            <Field label="Méthode" value={PAYMENT_LABELS[order.payment_method]} />
          </Section>

          {order.payment_method === 'invoice_30d' && (
            <Section title="Facture">
              <Field label="Émise le" value={formatDateFr(order.created_at)} />
              <Field label="Échéance" value={formatDateFr(order.invoice_due_date)} />
              <Field label="Payée le" value={formatDateFr(order.invoice_paid_at)} />
              {order.invoice_pdf_url && (
                <Field
                  label="PDF"
                  value={<span className="text-emerald-400/70">Générée ✓</span>}
                />
              )}
            </Section>
          )}

          <Section title="Expédition">
            <Field label="Expédiée le" value={formatDateFr(order.shipped_at)} />
            <Field label="Suivi" value={order.tracking_number || '—'} />
          </Section>

          <Section title="Timeline">
            <div className="relative pl-5">
              {timeline.map((e, i) => (
                <div key={i} className="relative pb-5 last:pb-0">
                  <span className="absolute -left-5 top-1 h-2 w-2 rounded-full bg-glacier-400" />
                  {i < timeline.length - 1 && (
                    <span className="absolute -left-[15px] top-3 h-full w-px bg-white/10" />
                  )}
                  <div className="text-[14px] font-light text-white/80">{e.label}</div>
                  <div className="text-[12px] text-white/40">{formatDateFr(e.date)}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Ajouter une note interne..."
              className="field-input resize-none"
            />
          </Section>
        </div>
      </aside>
    </div>
  )
}
