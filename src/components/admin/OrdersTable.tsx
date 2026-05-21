import StatusBadge from './StatusBadge'
import RowActions from './RowActions'
import PrimaryActionButton from './PrimaryActionButton'
import Badge from '../ui/Badge'
import { echeanceInfo } from '../../lib/orders'
import { formatCHF, formatDateFr } from '../../lib/format'
import type { AdminActionType } from '../../lib/orders'
import type { Order, OrderStatus } from '../../lib/types'
import { useToast } from '../ui/Toast'
import { copyText } from '../../lib/clipboard'

export interface TableHandlers {
  highlightId?: string | null
  busyId?: string | null
  onRowClick: (order: Order) => void
  onAction: (order: Order, type: AdminActionType) => void
  onDownloadInvoice: (order: Order) => void
  onEscalate: (order: Order) => void
  onChangeStatus: (order: Order, status: OrderStatus) => void
}

interface Props extends TableHandlers {
  orders: Order[]
}

function MethodPill({ order }: { order: Order }) {
  return order.payment_method === 'stripe' ? (
    <Badge className="bg-blue-500/10 text-blue-300">Stripe</Badge>
  ) : (
    <Badge className="bg-violet-500/10 text-violet-300">Facture</Badge>
  )
}

function Cluster({ order, h }: { order: Order; h: TableHandlers }) {
  return (
    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
      <PrimaryActionButton order={order} busy={h.busyId === order.id} onAction={h.onAction} />
      <RowActions
        order={order}
        onOpenDetail={h.onRowClick}
        onDownloadInvoice={h.onDownloadInvoice}
        onEscalate={h.onEscalate}
        onChangeStatus={h.onChangeStatus}
      />
    </div>
  )
}

export default function OrdersTable(props: Props) {
  const { orders, highlightId, onRowClick } = props
  const { toast } = useToast()

  function copyRef(e: React.MouseEvent, ref: string) {
    e.stopPropagation()
    copyText(ref).then((ok) => { if (ok) toast('Référence copiée') })
  }

  if (orders.length === 0) {
    return <div className="text-center py-16 text-white/40 font-light">Aucune commande.</div>
  }

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-[10px] tracking-[0.2em] uppercase text-white/35">
              <th className="font-light pb-3 px-3">Étape</th>
              <th className="font-light pb-3 px-3">Réf</th>
              <th className="font-light pb-3 px-3">Client</th>
              <th className="font-light pb-3 px-3">Méthode</th>
              <th className="font-light pb-3 px-3">Montant</th>
              <th className="font-light pb-3 px-3">Échéance</th>
              <th className="font-light pb-3 px-3">Date</th>
              <th className="font-light pb-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const ech = echeanceInfo(o)
              return (
                <tr key={o.id} onClick={() => onRowClick(o)}
                  className={`border-t border-white/[0.06] hover:bg-white/[0.025] cursor-pointer transition-colors ${highlightId === o.id ? 'bg-glacier-50' : ''}`}>
                  <td className="py-4 px-3"><StatusBadge status={o.status} /></td>
                  <td className="py-4 px-3">
                    <button onClick={(e) => copyRef(e, o.order_ref)}
                      className="font-mono text-[13px] text-white/70 hover:text-white transition-colors">{o.order_ref}</button>
                  </td>
                  <td className="py-4 px-3">
                    <div className="text-[14px] text-white/85">{o.first_name} {o.last_name}</div>
                    <div className="text-[12px] text-white/40">{o.email}</div>
                  </td>
                  <td className="py-4 px-3"><MethodPill order={o} /></td>
                  <td className="py-4 px-3 text-[14px] font-medium text-white/90">{formatCHF(o.amount_chf)} CHF</td>
                  <td className="py-4 px-3">
                    <span className={`text-[13px] ${ech.className} ${ech.pulse ? 'animate-soft-pulse' : ''}`}>{ech.label}</span>
                  </td>
                  <td className="py-4 px-3 text-[13px] text-white/50">{formatDateFr(o.created_at)}</td>
                  <td className="py-4 px-3"><Cluster order={o} h={props} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-3">
        {orders.map((o) => {
          const ech = echeanceInfo(o)
          return (
            <div key={o.id} onClick={() => onRowClick(o)}
              className={`card-glass rounded-card p-4 cursor-pointer ${highlightId === o.id ? 'card-selected' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <StatusBadge status={o.status} />
                <button onClick={(e) => copyRef(e, o.order_ref)} className="font-mono text-[12px] text-white/60">{o.order_ref}</button>
              </div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[14px] text-white/85">{o.first_name} {o.last_name}</div>
                  <div className="text-[12px] text-white/40">{o.email}</div>
                </div>
                <div className="text-[15px] font-medium text-white/90">{formatCHF(o.amount_chf)} CHF</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MethodPill order={o} />
                  <span className={`text-[12px] ${ech.className}`}>{ech.label}</span>
                </div>
                <Cluster order={o} h={props} />
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
