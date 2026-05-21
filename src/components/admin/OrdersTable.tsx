import { Check, Package } from 'lucide-react'
import StatusBadge from './StatusBadge'
import RowActions from './RowActions'
import Badge from '../ui/Badge'
import { canMarkPaid, canMarkShipped, echeanceInfo } from '../../lib/orders'
import { formatCHF, formatDateFr } from '../../lib/format'
import type { Order } from '../../lib/types'
import { useToast } from '../ui/Toast'

interface Props {
  orders: Order[]
  generatingId: string | null
  highlightId?: string | null
  onRowClick: (order: Order) => void
  onMarkPaid: (order: Order) => void
  onMarkShipped: (order: Order) => void
  onEscalate: (order: Order) => void
  onGenerateInvoice: (order: Order) => void
  onDownloadInvoice: (order: Order) => void
}

function MethodPill({ order }: { order: Order }) {
  return order.payment_method === 'stripe' ? (
    <Badge className="bg-blue-500/10 text-blue-300">Stripe</Badge>
  ) : (
    <Badge className="bg-violet-500/10 text-violet-300">Facture</Badge>
  )
}

function PayBtn({ order, onClick }: { order: Order; onClick: () => void }) {
  if (!canMarkPaid(order)) return null
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      title="Marquer payée"
      className="h-8 w-8 rounded-full flex items-center justify-center bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 transition-colors"
    >
      <Check className="h-4 w-4" strokeWidth={2.5} />
    </button>
  )
}

function ShipBtn({ order, onClick }: { order: Order; onClick: () => void }) {
  if (!canMarkShipped(order)) return null
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      title="Marquer expédiée"
      className="h-8 w-8 rounded-full flex items-center justify-center bg-violet-500/15 hover:bg-violet-500/25 text-violet-400 transition-colors"
    >
      <Package className="h-4 w-4" />
    </button>
  )
}

function ActionCluster({ order, props }: { order: Order; props: Props }) {
  return (
    <>
      <PayBtn order={order} onClick={() => props.onMarkPaid(order)} />
      <ShipBtn order={order} onClick={() => props.onMarkShipped(order)} />
      <RowActions
        order={order}
        generatingId={props.generatingId}
        onGenerateInvoice={props.onGenerateInvoice}
        onDownloadInvoice={props.onDownloadInvoice}
        onEscalate={props.onEscalate}
      />
    </>
  )
}

export default function OrdersTable(props: Props) {
  const { orders, highlightId, onRowClick } = props
  const { toast } = useToast()

  function copyRef(e: React.MouseEvent, ref: string) {
    e.stopPropagation()
    navigator.clipboard.writeText(ref).then(() => toast('Référence copiée'))
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-16 text-white/40 font-light">Aucune commande.</div>
    )
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-[10px] tracking-[0.2em] uppercase text-white/35">
              <th className="font-light pb-3 px-3">Statut</th>
              <th className="font-light pb-3 px-3">Réf</th>
              <th className="font-light pb-3 px-3">Client</th>
              <th className="font-light pb-3 px-3">Montant</th>
              <th className="font-light pb-3 px-3">Méthode</th>
              <th className="font-light pb-3 px-3">Échéance</th>
              <th className="font-light pb-3 px-3">Date</th>
              <th className="font-light pb-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const ech = echeanceInfo(o)
              return (
                <tr
                  key={o.id}
                  onClick={() => onRowClick(o)}
                  className={`border-t border-white/[0.06] hover:bg-white/[0.025] cursor-pointer transition-colors ${
                    highlightId === o.id ? 'bg-glacier-50' : ''
                  }`}
                >
                  <td className="py-4 px-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="py-4 px-3">
                    <button
                      onClick={(e) => copyRef(e, o.order_ref)}
                      className="font-mono text-[13px] text-white/70 hover:text-white transition-colors"
                    >
                      {o.order_ref}
                    </button>
                  </td>
                  <td className="py-4 px-3">
                    <div className="text-[14px] text-white/85">
                      {o.first_name} {o.last_name}
                    </div>
                    <div className="text-[12px] text-white/40">{o.email}</div>
                  </td>
                  <td className="py-4 px-3 text-[14px] font-medium text-white/90">
                    {formatCHF(o.amount_chf)} CHF
                  </td>
                  <td className="py-4 px-3">
                    <MethodPill order={o} />
                  </td>
                  <td className="py-4 px-3">
                    <span className={`text-[13px] ${ech.className} ${ech.pulse ? 'animate-soft-pulse' : ''}`}>
                      {ech.label}
                    </span>
                  </td>
                  <td className="py-4 px-3 text-[13px] text-white/50">{formatDateFr(o.created_at)}</td>
                  <td className="py-4 px-3">
                    <div className="flex items-center justify-end gap-2">
                      <ActionCluster order={o} props={props} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {orders.map((o) => {
          const ech = echeanceInfo(o)
          return (
            <div
              key={o.id}
              onClick={() => onRowClick(o)}
              className={`card-glass rounded-card p-4 cursor-pointer ${
                highlightId === o.id ? 'card-selected' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <StatusBadge status={o.status} />
                <button
                  onClick={(e) => copyRef(e, o.order_ref)}
                  className="font-mono text-[12px] text-white/60"
                >
                  {o.order_ref}
                </button>
              </div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[14px] text-white/85">
                    {o.first_name} {o.last_name}
                  </div>
                  <div className="text-[12px] text-white/40">{o.email}</div>
                </div>
                <div className="text-[15px] font-medium text-white/90">
                  {formatCHF(o.amount_chf)} CHF
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MethodPill order={o} />
                  <span className={`text-[12px] ${ech.className}`}>{ech.label}</span>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <ActionCluster order={o} props={props} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
