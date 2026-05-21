import { useMemo } from 'react'
import GlassCard from '../ui/GlassCard'
import { statKpis } from '../../lib/orders'
import { formatCHF, monthNameFr } from '../../lib/format'
import type { Order } from '../../lib/types'

function Stat({
  label,
  value,
  unit,
  badge,
}: {
  label: string
  value: string
  unit?: string
  badge?: 'orange' | 'red'
}) {
  return (
    <GlassCard variant="stat" className="p-6 relative">
      {badge && (
        <span
          className={`absolute top-5 right-5 h-2 w-2 rounded-full ${
            badge === 'red' ? 'bg-red-400' : 'bg-orange-400'
          }`}
        />
      )}
      <div className="text-[11px] tracking-[0.3em] uppercase text-white/40 mb-3">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[36px] font-extralight text-white leading-none">{value}</span>
        {unit && <span className="text-[14px] text-white/50">{unit}</span>}
      </div>
    </GlassCard>
  )
}

export default function StatsRow({ orders }: { orders: Order[] }) {
  const { monthName, ca, monthCount, todo, unpaid } = useMemo(() => {
    const now = new Date()
    const k = statKpis(orders, now)
    return { monthName: monthNameFr(now), ...k }
  }, [orders])

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Stat label={`CA · ${monthName}`} value={formatCHF(ca)} unit="CHF" />
      <Stat label="Commandes" value={String(monthCount)} />
      <Stat label="À traiter" value={String(todo)} badge={todo > 0 ? 'orange' : undefined} />
      <Stat label="Impayé" value={formatCHF(unpaid)} unit="CHF" badge={unpaid > 0 ? 'red' : undefined} />
    </div>
  )
}
