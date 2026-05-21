import { useEffect, useRef, useState } from 'react'
import { X, Copy, ExternalLink, Download } from 'lucide-react'
import StatusBadge from './StatusBadge'
import PrimaryActionButton from './PrimaryActionButton'
import { formatCHF, formatDateFr, formatDateTimeFr, formatAddressOneLine } from '../../lib/format'
import { echeanceInfo, type AdminActionType } from '../../lib/orders'
import { copyText } from '../../lib/clipboard'
import { daysUntil } from '../../lib/format'
import { PAYMENT_LABELS, PRODUCT_NAME, type Order } from '../../lib/types'
import { useToast } from '../ui/Toast'

interface Props {
  order: Order
  onClose: () => void
  onSaveNotes: (id: string, notes: string) => void
  onAction: (order: Order, type: AdminActionType) => void
  onDownloadInvoice: (order: Order) => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <div className="text-[10px] tracking-[0.25em] uppercase text-white/40 mb-3">{title}</div>
      {children}
    </div>
  )
}

function CopyRow({ label, value, copy }: { label: string; value: React.ReactNode; copy?: string }) {
  const { toast } = useToast()
  return (
    <div className="flex justify-between items-center gap-3 py-1.5 text-[14px] font-light">
      <span className="text-white/45 shrink-0">{label}</span>
      <span className="text-white/85 text-right flex items-center gap-2 min-w-0">
        <span className="truncate">{value}</span>
        {copy != null && (
          <button onClick={async () => { if (await copyText(copy)) toast(`${label} copié ✓`) }}
            className="text-white/35 hover:text-white shrink-0"><Copy className="h-3.5 w-3.5" /></button>
        )}
      </span>
    </div>
  )
}

interface TLEvent { label: string; date: string | null; dot: string }

function buildTimeline(o: Order): TLEvent[] {
  const ev: TLEvent[] = [{ label: 'Commande reçue', date: o.created_at, dot: 'bg-yellow-400' }]
  if (o.payment_method === 'invoice_30d') {
    ev.push({ label: 'Confirmation envoyée', date: o.confirmed_at, dot: 'bg-blue-400' })
    ev.push({ label: 'Facture générée', date: o.invoiced_at, dot: 'bg-indigo-400' })
  }
  ev.push({ label: 'Plaque configurée', date: o.configured_at, dot: 'bg-cyan-400' })
  ev.push({ label: 'Expédiée', date: o.shipped_at, dot: 'bg-violet-400' })
  ev.push({ label: 'Paiement reçu', date: o.invoice_paid_at, dot: 'bg-emerald-400' })
  ev.push({ label: 'Terminée', date: o.status === 'completed' ? o.updated_at : null, dot: 'bg-white/60' })
  return ev
}

export default function OrderDetail({ order, onClose, onSaveNotes, onAction, onDownloadInvoice }: Props) {
  const [notes, setNotes] = useState(order.notes ?? '')
  const timer = useRef<number>()
  const firstRender = useRef(true)
  const { toast } = useToast()

  useEffect(() => { setNotes(order.notes ?? ''); firstRender.current = true }, [order.id, order.notes])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => onSaveNotes(order.id, notes), 500)
    return () => window.clearTimeout(timer.current)
  }, [notes, order.id, onSaveNotes])

  const timeline = buildTimeline(order)
  const ech = echeanceInfo(order)
  const due = daysUntil(order.invoice_due_date)

  return (
    <div className="fixed inset-0 z-[80]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" style={{ backdropFilter: 'blur(2px)' }} />
      <aside className="absolute right-0 top-0 h-full w-full md:w-[480px] overflow-y-auto animate-slide-in"
        style={{ background: 'linear-gradient(180deg, rgba(14,16,22,0.99), rgba(8,9,13,0.99))', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-5 border-b border-white/[0.08] bg-black/40 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <h2 className="font-mono text-[15px] text-white/90">{order.order_ref}</h2>
            <StatusBadge status={order.status} />
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><X className="h-5 w-5" /></button>
        </div>

        <div className="px-6 py-6">
          <Section title="Client">
            <div className="text-[16px] text-white/90 mb-2">{order.first_name} {order.last_name}</div>
            <CopyRow label="Email" value={order.email} copy={order.email} />
            <CopyRow label="Téléphone" value={order.phone} copy={order.phone} />
            {order.company_name && <CopyRow label="Entreprise" value={order.company_name} />}
            <CopyRow label="Adresse" value={`${order.address}, ${order.postal_code} ${order.city}`} copy={formatAddressOneLine(order)} />
            <CopyRow label="Canton" value={order.canton} />
          </Section>

          <Section title="Fiche Google">
            <div className="flex items-center gap-2">
              <a href={order.google_business_url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] text-blue-300 underline underline-offset-2 break-all">
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />{order.google_business_url || '—'}
              </a>
              <button onClick={async () => { if (await copyText(order.google_business_url)) toast('Lien copié ✓') }}
                className="text-white/35 hover:text-white shrink-0"><Copy className="h-3.5 w-3.5" /></button>
            </div>
          </Section>

          <Section title="Commande">
            <CopyRow label="Produit" value={`1× ${PRODUCT_NAME}`} />
            <CopyRow label="Montant" value={`${formatCHF(order.amount_chf)} CHF`} />
            <CopyRow label="Méthode" value={PAYMENT_LABELS[order.payment_method]} />
          </Section>

          {order.payment_method === 'invoice_30d' && (
            <Section title="Facture">
              <CopyRow label="Émise le" value={order.invoiced_at ? formatDateFr(order.invoiced_at) : 'Pas encore générée'} />
              <CopyRow label="Échéance" value={formatDateFr(order.invoice_due_date)} />
              {due !== null && order.status !== 'paid' && order.status !== 'completed' && (
                <div className="flex justify-between py-1.5 text-[14px] font-light">
                  <span className="text-white/45">Décompte</span>
                  <span className={ech.className}>{ech.label}</span>
                </div>
              )}
              <CopyRow label="Relances" value={`Relancé ${order.relance_count} fois`} />
              {order.last_relance_at && <CopyRow label="Dernière relance" value={formatDateFr(order.last_relance_at)} />}
              {order.invoice_pdf_url && (
                <button onClick={() => onDownloadInvoice(order)}
                  className="mt-3 inline-flex items-center gap-2 rounded-full py-2 px-4 text-[13px] font-light bg-white/[0.04] text-white/75 border border-white/12 hover:bg-white/[0.08]">
                  <Download className="h-4 w-4" /> Télécharger la facture
                </button>
              )}
            </Section>
          )}

          <Section title="Timeline">
            <div className="relative pl-5">
              {timeline.map((e, i) => {
                const done = !!e.date
                return (
                  <div key={i} className="relative pb-5 last:pb-0">
                    <span className={`absolute -left-5 top-1 h-2 w-2 rounded-full ${done ? e.dot : 'bg-white/15'}`} />
                    {i < timeline.length - 1 && (
                      <span className={`absolute -left-[15px] top-3 h-full w-px ${done ? 'bg-white/15' : 'bg-white/[0.06] border-l border-dashed border-white/15'}`} />
                    )}
                    <div className={`text-[14px] font-light ${done ? 'text-white/80' : 'text-white/35'}`}>{e.label}</div>
                    <div className="text-[12px] text-white/40">
                      {done ? formatDateTimeFr(e.date) : 'En attente…'}
                      {e.label === 'Expédiée' && order.tracking_number ? ` · suivi ${order.tracking_number}` : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>

          <Section title="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4}
              placeholder="Notes internes (ex: client appelé le 12 mai, dit qu'il paie vendredi...)"
              className="field-input resize-none" />
          </Section>

          <Section title="Actions">
            <PrimaryActionButton order={order} size="lg" onAction={onAction} />
            <div className="flex flex-wrap gap-2 mt-3">
              <SecBtn label="Copier email" onClick={async () => { if (await copyText(order.email)) toast('Email copié ✓') }} />
              <SecBtn label="Copier adresse" onClick={async () => { if (await copyText(formatAddressOneLine(order))) toast('Adresse copiée ✓') }} />
              {order.invoice_pdf_url && <SecBtn label="Télécharger facture" onClick={() => onDownloadInvoice(order)} />}
            </div>
          </Section>
        </div>
      </aside>
    </div>
  )
}

function SecBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="rounded-full py-2 px-4 text-[12px] font-light bg-white/[0.04] text-white/70 border border-white/12 hover:bg-white/[0.08] transition-colors">
      {label}
    </button>
  )
}
