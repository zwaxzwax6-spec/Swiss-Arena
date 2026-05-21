import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useOrders } from '../../hooks/useOrders'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import StatsRow from '../../components/admin/StatsRow'
import OrdersTable from '../../components/admin/OrdersTable'
import FilterBar, { type SortKey, type StatusFilter } from '../../components/admin/FilterBar'
import ActionModals, { type AdminAction } from '../../components/admin/ActionModals'
import OrderDetail from '../../components/admin/OrderDetail'
import GlassCard from '../../components/ui/GlassCard'
import { canMarkShipped } from '../../lib/orders'
import { daysUntil } from '../../lib/format'
import { downloadCsv } from '../../lib/csv'
import { generateInvoicePdf } from '../../lib/qrbill'
import type { Order } from '../../lib/types'

type Tab = 'todo' | 'all'

export default function Dashboard() {
  const navigate = useNavigate()
  const { session, loading: authLoading } = useAuth()
  const { orders, loading, newCount, resetNewCount, update } = useOrders()
  const { toast } = useToast()

  const [tab, setTab] = useState<Tab>('todo')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('date_desc')
  const [selected, setSelected] = useState<Order | null>(null)
  const [action, setAction] = useState<AdminAction | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [generatingId, setGeneratingId] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !session) navigate('/admin', { replace: true })
  }, [session, authLoading, navigate])

  // Derive the live order from the canonical list so the detail panel always
  // reflects realtime/optimistic updates without duplicating order state.
  const selectedLive = selected ? (orders.find((o) => o.id === selected.id) ?? selected) : null

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/admin', { replace: true })
  }

  async function confirmAction(a: AdminAction, tracking?: string) {
    setActionBusy(true)
    try {
      if (a.type === 'pay') {
        const nextStatus = a.order.status === 'pending' ? 'paid_stripe' : 'paid_invoice'
        await update(a.order.id, { status: nextStatus, invoice_paid_at: new Date().toISOString() })
        toast('Commande marquée payée')
      } else if (a.type === 'ship') {
        await update(a.order.id, {
          status: 'shipped',
          shipped_at: new Date().toISOString(),
          tracking_number: tracking?.trim() || null,
        })
        toast('Commande expédiée')
      } else {
        await update(a.order.id, { status: 'recovery' })
        toast('Escaladée en recouvrement')
      }
      setAction(null)
    } catch {
      toast('Erreur lors de la mise à jour')
    } finally {
      setActionBusy(false)
    }
  }

  async function handleGenerateInvoice(order: Order) {
    setGeneratingId(order.id)
    try {
      const blob = await generateInvoicePdf(order)
      const path = `${order.order_ref}.pdf`
      const { error: upErr } = await supabase.storage
        .from('invoices')
        .upload(path, blob, { contentType: 'application/pdf', upsert: true })
      if (upErr) throw upErr
      await update(order.id, { invoice_pdf_url: path })
      toast('Facture générée ✓')
    } catch (e) {
      console.error('invoice generation failed:', e)
      toast('Échec de la génération de la facture')
    } finally {
      setGeneratingId(null)
    }
  }

  async function handleDownloadInvoice(order: Order) {
    if (!order.invoice_pdf_url) return
    const { data, error } = await supabase.storage
      .from('invoices')
      .createSignedUrl(order.invoice_pdf_url, 120)
    if (error || !data) {
      toast('Lien de téléchargement indisponible')
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  function saveNotes(id: string, notes: string) {
    update(id, { notes }).catch(() => toast('Erreur sauvegarde note'))
  }

  const filtered = useMemo(() => {
    let list = orders
    if (statusFilter !== 'all') list = list.filter((o) => o.status === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (o) =>
          `${o.first_name} ${o.last_name}`.toLowerCase().includes(q) ||
          o.email.toLowerCase().includes(q) ||
          o.order_ref.toLowerCase().includes(q),
      )
    }
    const sorted = [...list]
    sorted.sort((a, b) => {
      switch (sort) {
        case 'date_asc':
          return +new Date(a.created_at) - +new Date(b.created_at)
        case 'amount_desc':
          return Number(b.amount_chf) - Number(a.amount_chf)
        case 'due_asc': {
          const da = daysUntil(a.invoice_due_date) ?? Infinity
          const db = daysUntil(b.invoice_due_date) ?? Infinity
          return da - db
        }
        default:
          return +new Date(b.created_at) - +new Date(a.created_at)
      }
    })
    return sorted
  }, [orders, statusFilter, search, sort])

  const todo = useMemo(() => {
    const nouvelles = orders
      .filter((o) => o.status === 'pending')
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    const aExpedier = orders.filter(canMarkShipped)
    const facturesUrgentes = orders
      .filter((o) => {
        if (o.status !== 'invoiced') return false
        const d = daysUntil(o.invoice_due_date)
        return d !== null && d < 7
      })
      .sort((a, b) => (daysUntil(a.invoice_due_date) ?? 0) - (daysUntil(b.invoice_due_date) ?? 0))
    const enRetard = orders.filter((o) => o.status === 'overdue')
    return { nouvelles, aExpedier, facturesUrgentes, enRetard }
  }, [orders])

  const tableProps = {
    generatingId,
    highlightId: selected?.id,
    onRowClick: setSelected,
    onMarkPaid: (o: Order) => setAction({ type: 'pay', order: o }),
    onMarkShipped: (o: Order) => setAction({ type: 'ship', order: o }),
    onEscalate: (o: Order) => setAction({ type: 'escalate', order: o }),
    onGenerateInvoice: handleGenerateInvoice,
    onDownloadInvoice: handleDownloadInvoice,
  }

  if (authLoading || !session) {
    return <div className="min-h-screen bg-black" />
  }

  const todoEmpty =
    todo.nouvelles.length === 0 &&
    todo.aExpedier.length === 0 &&
    todo.facturesUrgentes.length === 0 &&
    todo.enRetard.length === 0

  return (
    <div className="min-h-screen bg-black">
      {/* Top bar */}
      <header className="sticky top-0 z-50 glass-pill rounded-none border-0 border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-5 md:px-8 py-4">
          <img src="/LogoSwiss.png" alt="Swiss Arena" className="h-8 w-auto" />
          <div className="flex items-center gap-2.5">
            <span className="text-[15px] font-light tracking-tight text-white/85">Dashboard</span>
            {newCount > 0 && (
              <button
                onClick={() => {
                  resetNewCount()
                  setTab('todo')
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="h-5 min-w-5 px-1.5 rounded-full bg-glacier-200 text-glacier flex items-center justify-center text-[11px] font-medium animate-soft-pulse"
                style={{ color: 'rgb(180,220,255)' }}
                title="Nouvelles commandes"
              >
                {newCount}
              </button>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="text-white/50 hover:text-white transition-colors"
            title="Déconnexion"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 md:px-8 py-8">
        <StatsRow orders={orders} />

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-8 mb-6 border-b border-white/[0.08]">
          {(['todo', 'all'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-4 py-3 text-[14px] font-light transition-colors ${
                tab === t ? 'text-white' : 'text-white/40 hover:text-white/70'
              }`}
            >
              {t === 'todo' ? 'À traiter' : 'Toutes les commandes'}
              {tab === t && (
                <span className="absolute bottom-0 left-0 right-0 h-px bg-glacier-400" />
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-white/40 font-light">Chargement…</div>
        ) : tab === 'todo' ? (
          todoEmpty ? (
            <GlassCard className="p-12 text-center">
              <div className="text-[18px] font-extralight text-white/80">Tout est à jour ✓</div>
            </GlassCard>
          ) : (
            <div className="space-y-10">
              <TodoSection title="Nouvelles commandes" orders={todo.nouvelles} {...tableProps} />
              <TodoSection title="À expédier" orders={todo.aExpedier} {...tableProps} />
              <TodoSection title="Factures urgentes" orders={todo.facturesUrgentes} {...tableProps} />
              <TodoSection title="En retard" orders={todo.enRetard} {...tableProps} />
            </div>
          )
        ) : (
          <>
            <FilterBar
              status={statusFilter}
              onStatus={setStatusFilter}
              search={search}
              onSearch={setSearch}
              sort={sort}
              onSort={setSort}
              onExport={() => downloadCsv(filtered)}
            />
            <OrdersTable orders={filtered} {...tableProps} />
          </>
        )}
      </main>

      <ActionModals
        action={action}
        busy={actionBusy}
        onClose={() => setAction(null)}
        onConfirm={confirmAction}
      />
      {selectedLive && (
        <OrderDetail order={selectedLive} onClose={() => setSelected(null)} onSaveNotes={saveNotes} />
      )}
    </div>
  )
}

function TodoSection({
  title,
  orders,
  ...tableProps
}: { title: string; orders: Order[] } & Omit<
  Parameters<typeof OrdersTable>[0],
  'orders'
>) {
  if (orders.length === 0) return null
  return (
    <section>
      <h2 className="text-[15px] font-light text-white/80 mb-4">
        {title} <span className="text-white/40">({orders.length})</span>
      </h2>
      <GlassCard className="p-4 md:p-5">
        <OrdersTable orders={orders} {...tableProps} />
      </GlassCard>
    </section>
  )
}
