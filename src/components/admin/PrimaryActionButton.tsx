import { nextAction } from '../../lib/orders'
import type { Order } from '../../lib/types'

interface Props {
  order: Order
  busy?: boolean
  size?: 'sm' | 'lg'
  onAction: (order: Order, type: NonNullable<ReturnType<typeof nextAction>>['type']) => void
}

export default function PrimaryActionButton({ order, busy, size = 'sm', onAction }: Props) {
  const action = nextAction(order)
  if (!action) return <span className="text-[14px] text-white/40">✅</span>
  const pad = size === 'lg' ? 'py-3 px-5 text-[15px] w-full justify-center' : 'py-1.5 px-3 text-[12px]'
  return (
    <button
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation()
        onAction(order, action.type)
      }}
      className={`inline-flex items-center gap-1.5 rounded-full font-light transition-colors disabled:opacity-50 ${pad} ${action.className}`}
    >
      {action.label}
    </button>
  )
}
