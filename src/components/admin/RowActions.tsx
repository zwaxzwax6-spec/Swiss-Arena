import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal, Eye, Mail, MapPin, Download, AlertTriangle, RefreshCw } from 'lucide-react'
import { canEscalate } from '../../lib/orders'
import { copyText } from '../../lib/clipboard'
import { formatAddressOneLine } from '../../lib/format'
import { STATUS_LABELS, type Order, type OrderStatus } from '../../lib/types'
import { useToast } from '../ui/Toast'

interface Props {
  order: Order
  onOpenDetail: (order: Order) => void
  onDownloadInvoice: (order: Order) => void
  onEscalate: (order: Order) => void
  onChangeStatus: (order: Order, status: OrderStatus) => void
}

export default function RowActions({ order, onOpenDetail, onDownloadInvoice, onEscalate, onChangeStatus }: Props) {
  const [open, setOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setStatusOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  function close() { setOpen(false); setStatusOpen(false) }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        className="h-8 w-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/60 transition-colors"
        aria-label="Plus d'actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-10 z-30 w-60 rounded-2xl p-1.5 animate-modal-in"
          style={{
            background: 'linear-gradient(180deg, rgba(20,22,30,0.98), rgba(12,14,20,0.98))',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 20px 60px rgba(0,5,20,0.6)',
            backdropFilter: 'blur(20px)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <MenuItem icon={<Eye className="h-3.5 w-3.5" />} label="Voir détail" onClick={() => { close(); onOpenDetail(order) }} />
          <MenuItem icon={<Mail className="h-3.5 w-3.5" />} label="Copier l'adresse email"
            onClick={async () => { close(); if (await copyText(order.email)) toast('Adresse email copiée ✓') }} />
          <MenuItem icon={<MapPin className="h-3.5 w-3.5" />} label="Copier l'adresse postale"
            onClick={async () => { close(); if (await copyText(formatAddressOneLine(order))) toast('Adresse postale copiée ✓') }} />
          {order.invoice_pdf_url && (
            <MenuItem icon={<Download className="h-3.5 w-3.5" />} label="Télécharger facture"
              onClick={() => { close(); onDownloadInvoice(order) }} />
          )}
          <MenuItem icon={<RefreshCw className="h-3.5 w-3.5" />} label="Changer statut"
            onClick={() => setStatusOpen((s) => !s)} />
          {statusOpen && (
            <div className="ml-2 my-1 max-h-56 overflow-y-auto border-l border-white/10 pl-1">
              {(Object.keys(STATUS_LABELS) as OrderStatus[]).map((s) => (
                <button key={s}
                  onClick={() => { close(); onChangeStatus(order, s) }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[12px] font-light transition-colors hover:bg-white/[0.06] ${s === order.status ? 'text-white' : 'text-white/60'}`}>
                  {STATUS_LABELS[s]}{s === order.status ? ' ·' : ''}
                </button>
              ))}
            </div>
          )}
          {canEscalate(order) && (
            <MenuItem icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Escalader recouvrement"
              danger onClick={() => { close(); onEscalate(order) }} />
          )}
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-light transition-colors text-left hover:bg-white/[0.06] ${danger ? 'text-red-300/80' : 'text-white/75'}`}>
      <span className={danger ? 'text-red-300/70' : 'text-white/50'}>{icon}</span>
      {label}
    </button>
  )
}
