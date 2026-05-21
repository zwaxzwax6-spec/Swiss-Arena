import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  danger?: boolean
}

export default function Modal({ open, onClose, title, children, footer, danger }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-5"
      style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', background: 'rgba(0,5,20,0.55)' }}
      onClick={onClose}
    >
      <div
        className={`w-full max-w-[440px] rounded-card p-7 animate-modal-in ${
          danger
            ? 'border border-red-500/20'
            : 'border border-white/10'
        }`}
        style={{
          background: danger
            ? 'linear-gradient(180deg, rgba(248,113,113,0.06) 0%, rgba(255,255,255,0.015) 100%)'
            : 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
          backdropFilter: 'blur(32px) saturate(160%)',
          WebkitBackdropFilter: 'blur(32px) saturate(160%)',
          boxShadow: '0 40px 120px rgba(0,10,40,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <h3 className="text-[19px] font-extralight text-white leading-snug pr-4">{title}</h3>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors shrink-0 mt-0.5"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="text-[14px] font-light text-white/70 leading-relaxed">{children}</div>
        {footer && <div className="mt-7 flex items-center justify-end gap-3">{footer}</div>}
      </div>
    </div>
  )
}
