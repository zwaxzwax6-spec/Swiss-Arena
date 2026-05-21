import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal, FileText, Download, AlertTriangle, Loader2 } from 'lucide-react'
import { canEscalate, canGenerateInvoice } from '../../lib/orders'
import type { Order } from '../../lib/types'

interface Props {
  order: Order
  generatingId: string | null
  onGenerateInvoice: (order: Order) => void
  onDownloadInvoice: (order: Order) => void
  onEscalate: (order: Order) => void
}

export default function RowActions({
  order,
  generatingId,
  onGenerateInvoice,
  onDownloadInvoice,
  onEscalate,
}: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const items: { label: string; icon: React.ReactNode; onClick: () => void }[] = []
  if (canGenerateInvoice(order))
    items.push({
      label: 'Générer facture PDF',
      icon:
        generatingId === order.id ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileText className="h-3.5 w-3.5" />
        ),
      onClick: () => onGenerateInvoice(order),
    })
  if (order.invoice_pdf_url)
    items.push({
      label: 'Télécharger facture',
      icon: <Download className="h-3.5 w-3.5" />,
      onClick: () => onDownloadInvoice(order),
    })
  if (canEscalate(order))
    items.push({
      label: 'Escalader recouvrement',
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      onClick: () => onEscalate(order),
    })

  if (items.length === 0) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className="h-8 w-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/60 transition-colors"
        aria-label="Plus d'actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-10 z-20 w-56 rounded-2xl p-1.5 animate-modal-in"
          style={{
            background: 'linear-gradient(180deg, rgba(20,22,30,0.98), rgba(12,14,20,0.98))',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 20px 60px rgba(0,5,20,0.6)',
            backdropFilter: 'blur(20px)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => {
                setOpen(false)
                it.onClick()
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-light text-white/75 hover:bg-white/[0.06] transition-colors text-left"
            >
              <span className="text-white/50">{it.icon}</span>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
