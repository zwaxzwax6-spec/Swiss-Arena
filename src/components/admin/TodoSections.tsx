import { useMemo } from 'react'
import { AlertTriangle, Inbox, FileText, Settings, Package, Clock, ExternalLink } from 'lucide-react'
import GlassCard from '../ui/GlassCard'
import StatusBadge from './StatusBadge'
import PrimaryActionButton from './PrimaryActionButton'
import Badge from '../ui/Badge'
import { echeanceInfo } from '../../lib/orders'
import { copyText } from '../../lib/clipboard'
import { formatDateFr, formatAddressOneLine } from '../../lib/format'
import type { TableHandlers } from './OrdersTable'
import type { Order } from '../../lib/types'
import { useToast } from '../ui/Toast'

interface Props extends TableHandlers {
  orders: Order[]
}

interface Group {
  key: string
  icon: React.ReactNode
  title: string
  tint?: string
  orders: Order[]
  /** Optional per-card extra content (address, google link, countdown…). */
  extra?: (o: Order) => React.ReactNode
}

export default function TodoSections(props: Props) {
  const { orders } = props
  const { toast } = useToast()

  const groups = useMemo<Group[]>(() => {
    const by = (f: (o: Order) => boolean) =>
      orders.filter(f).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))

    const googleLink = (o: Order) => (
      <div className="flex items-center gap-2 mt-1">
        <a href={o.google_business_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-[12px] text-blue-300 underline underline-offset-2 break-all">
          <ExternalLink className="h-3 w-3 shrink-0" />{o.google_business_url || '—'}
        </a>
        <CopyBtn text={o.google_business_url} label="Lien copié ✓" toast={toast} />
      </div>
    )
    const address = (o: Order) => (
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[12px] text-white/55">{formatAddressOneLine(o)}</span>
        <CopyBtn text={formatAddressOneLine(o)} label="Adresse copiée ✓" toast={toast} />
      </div>
    )
    const countdown = (o: Order) => {
      const ech = echeanceInfo(o)
      return (
        <div className="flex items-center gap-3 mt-1">
          <span className={`text-[12px] ${ech.className} ${ech.pulse ? 'animate-soft-pulse' : ''}`}>{ech.label}</span>
          {o.relance_count > 0 && (
            <span className="text-[11px] text-white/45">Relancé {o.relance_count} fois</span>
          )}
        </div>
      )
    }
    const overdueExtra = (o: Order) => (
      <div className="flex items-center gap-3 mt-1 text-[12px]">
        <span className="text-red-400">{lateLabel(o)}</span>
        <span className="text-white/45">Relancé {o.relance_count} fois</span>
        {o.last_relance_at && <span className="text-white/35">dernière : {formatDateFr(o.last_relance_at)}</span>}
      </div>
    )

    return [
      { key: 'overdue', icon: <AlertTriangle className="h-4 w-4 text-red-400" />, title: 'En retard', tint: 'bg-red-500/[0.03]', orders: by((o) => o.status === 'overdue'), extra: overdueExtra },
      { key: 'new', icon: <Inbox className="h-4 w-4 text-yellow-400" />, title: 'Nouvelles commandes', orders: by((o) => o.status === 'new') },
      { key: 'confirmed', icon: <FileText className="h-4 w-4 text-indigo-400" />, title: 'Factures à générer', orders: by((o) => o.status === 'confirmed') },
      { key: 'configure', icon: <Settings className="h-4 w-4 text-cyan-400" />, title: 'À configurer', orders: by((o) => o.status === 'invoiced' || (o.status === 'paid' && !o.shipped_at)), extra: googleLink },
      { key: 'ship', icon: <Package className="h-4 w-4 text-violet-400" />, title: 'À expédier', orders: by((o) => o.status === 'configured'), extra: address },
      { key: 'await', icon: <Clock className="h-4 w-4 text-orange-400" />, title: 'En attente de paiement', orders: by((o) => o.status === 'awaiting_payment'), extra: countdown },
    ].filter((g) => g.orders.length > 0)
  }, [orders, toast])

  if (groups.length === 0) {
    return (
      <GlassCard className="p-12 text-center">
        <div className="text-[18px] font-extralight text-white/80">Tout est à jour ✓</div>
        <div className="text-[13px] text-white/40 mt-1">Aucune action requise</div>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.key}>
          <div className="flex items-center gap-2 mb-3">
            {g.icon}
            <h2 className="text-[15px] font-light text-white/85">{g.title}</h2>
            <span className="text-[11px] text-white/45 bg-white/[0.06] rounded-full px-2 py-0.5">{g.orders.length}</span>
          </div>
          <div className={`rounded-card ${g.tint ?? ''} space-y-2`}>
            {g.orders.map((o) => (
              <MiniCard key={o.id} order={o} h={props} extra={g.extra} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function MiniCard({ order, h, extra }: { order: Order; h: TableHandlers; extra?: (o: Order) => React.ReactNode }) {
  const { toast } = useToast()
  return (
    <div onClick={() => h.onRowClick(order)}
      className="card-glass rounded-card p-4 cursor-pointer flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(order.order_ref).then(() => toast('Référence copiée')) }}
            className="font-mono text-[12px] text-white/60 hover:text-white">{order.order_ref}</button>
          <Badge className={order.payment_method === 'stripe' ? 'bg-blue-500/10 text-blue-300' : 'bg-violet-500/10 text-violet-300'}>
            {order.payment_method === 'stripe' ? 'Stripe' : 'Facture'}
          </Badge>
          <StatusBadge status={order.status} />
        </div>
        <div className="text-[14px] text-white/85 mt-1">{order.first_name} {order.last_name}</div>
        <div className="text-[12px] text-white/40">{formatDateFr(order.created_at)}</div>
        {extra?.(order)}
      </div>
      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
        <PrimaryActionButton order={order} busy={h.busyId === order.id} onAction={h.onAction} />
      </div>
    </div>
  )
}

function CopyBtn({ text, label, toast }: { text: string; label: string; toast: (m: string) => void }) {
  return (
    <button onClick={async (e) => { e.stopPropagation(); if (await copyText(text)) toast(label) }}
      className="text-[11px] text-white/40 hover:text-white/80 underline underline-offset-2">copier</button>
  )
}

/** "J+5 de retard" from invoice_due_date. */
function lateLabel(o: Order): string {
  if (!o.invoice_due_date) return 'En retard'
  const days = Math.floor((Date.now() - new Date(o.invoice_due_date).getTime()) / 86400000)
  return days > 0 ? `J+${days} de retard` : 'Échéance dépassée'
}
