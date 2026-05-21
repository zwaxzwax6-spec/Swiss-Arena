import { useMemo } from 'react'
import GlassCard from '../ui/GlassCard'
import { isPaid, isSameMonth } from '../../lib/orders'
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
  const { monthName, ca, monthCount, pending, unpaid } = useMemo(() => {
    const now = new Date()
    const ca = orders
      .filter((o) => isPaid(o) && isSameMonth(o.created_at, now))
      .reduce((sum, o) => sum + Number(o.amount_chf), 0)
    const monthCount = orders.filter((o) => isSameMonth(o.created_at, now)).length
    const pending = orders.filter((o) => o.status === 'invoiced').length
    const unpaid = orders
      .filter((o) => o.status === 'invoiced' || o.status === 'overdue')
      .reduce((sum, o) => sum + Number(o.amount_chf), 0)
    return { monthName: monthNameFr(now), ca, monthCount, pending, unpaid }
  }, [orders])

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Stat label={`CA · ${monthName}`} value={formatCHF(ca)} unit="CHF" />
      <Stat label="Commandes" value={String(monthCount)} />
      <Stat label="En attente" value={String(pending)} badge={pending > 0 ? 'orange' : undefined} />
      <Stat
        label="Impayé"
        value={formatCHF(unpaid)}
        unit="CHF"
        badge={unpaid > 0 ? 'red' : undefined}
      />
    </div>
  )
}
