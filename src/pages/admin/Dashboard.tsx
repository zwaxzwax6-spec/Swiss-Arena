import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useOrders } from '../../hooks/useOrders'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import StatsRow from '../../components/admin/StatsRow'
import OrdersTable from '../../components/admin/OrdersTable'
import TodoSections from '../../components/admin/TodoSections'
import FilterBar, { type SortKey, type StatusFilter } from '../../components/admin/FilterBar'
import ActionModals, { type AdminAction } from '../../components/admin/ActionModals'
import OrderDetail from '../../components/admin/OrderDetail'
import { applyAction, type AdminActionType } from '../../lib/orders'
import { daysUntil } from '../../lib/format'
import { downloadCsv } from '../../lib/csv'
import { generateInvoicePdf } from '../../lib/qrbill'
import type { Order, OrderStatus } from '../../lib/types'

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
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !session) navigate('/admin', { replace: true })
  }, [session, authLoading, navigate])

  const selectedLive = selected ? (orders.find((o) => o.id === selected.id) ?? selected) : null

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/admin', { replace: true })
  }

  // Generate the QR-bill PDF, upload it, store its path. No status change here.
  async function handleGenerateInvoice(order: Order) {
    setBusyId(order.id)
    try {
      const blob = await generateInvoicePdf(order)
      const path = `${order.order_ref}.pdf`
      const { error: upErr } = await supabase.storage
        .from('invoices')
        .upload(path, blob, { contentType: 'application/pdf', upsert: true })
      if (upErr) throw upErr
      await update(order.id, { invoice_pdf_url: path })
      toast('Facture générée ✓ — cliquez « Envoyée » pour facturer')
    } catch (e) {
      console.error('invoice generation failed:', e)
      toast('Échec de la génération de la facture')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDownloadInvoice(order: Order) {
    if (!order.invoice_pdf_url) return
    const { data, error } = await supabase.storage.from('invoices').createSignedUrl(order.invoice_pdf_url, 120)
    if (error || !data) { toast('Lien de téléchargement indisponible'); return }
    window.open(data.signedUrl, '_blank')
  }

  // Primary-action dispatcher: generate_invoice runs immediately; everything else opens a modal.
  function executeAction(order: Order, type: AdminActionType) {
    if (type === 'generate_invoice') { handleGenerateInvoice(order); return }
    setAction({ type, order })
  }

  async function confirmAction(a: AdminAction, tracking?: string) {
    setActionBusy(true)
    try {
      const patch = applyAction(a.type, a.order, { tracking })
      await update(a.order.id, patch)
      toast('Commande mise à jour ✓')
      setAction(null)
    } catch {
      toast('Erreur lors de la mise à jour')
    } finally {
      setActionBusy(false)
    }
  }

  async function changeStatus(order: Order, status: OrderStatus) {
    try {
      await update(order.id, { status })
      toast('Statut modifié ✓')
    } catch {
      toast('Erreur lors de la mise à jour')
    }
  }

  const saveNotes = useCallback(
    (id: string, notes: string) => {
      update(id, { notes }).catch(() => toast('Erreur sauvegarde note'))
    },
    [update, toast],
  )

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
        case 'date_asc': return +new Date(a.created_at) - +new Date(b.created_at)
        case 'amount_desc': return Number(b.amount_chf) - Number(a.amount_chf)
        case 'due_asc': {
          const da = daysUntil(a.invoice_due_date) ?? Infinity
          const db = daysUntil(b.invoice_due_date) ?? Infinity
          return da - db
        }
        default: return +new Date(b.created_at) - +new Date(a.created_at)
      }
    })
    return sorted
  }, [orders, statusFilter, search, sort])

  const handlers = {
    highlightId: selected?.id,
    busyId,
    onRowClick: setSelected,
    onAction: executeAction,
    onDownloadInvoice: handleDownloadInvoice,
    onEscalate: (o: Order) => setAction({ type: 'escalate', order: o }),
    onChangeStatus: changeStatus,
  }

  if (authLoading || !session) return <div className="min-h-screen bg-black" />

  return (
    <div className="min-h-screen bg-black">
      <header className="sticky top-0 z-50 glass-pill rounded-none border-0 border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-5 md:px-8 py-4">
          <img src="/LogoSwiss.png" alt="Swiss Arena" className="h-8 w-auto" />
          <div className="flex items-center gap-2.5">
            <span className="text-[15px] font-light tracking-tight text-white/85">Dashboard</span>
            {newCount > 0 && (
              <button
                onClick={() => { resetNewCount(); setTab('todo'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                className="h-5 min-w-5 px-1.5 rounded-full bg-glacier-200 flex items-center justify-center text-[11px] font-medium animate-soft-pulse"
                style={{ color: 'rgb(180,220,255)' }} title="Nouvelles commandes">
                {newCount}
              </button>
            )}
          </div>
          <button onClick={handleLogout} className="text-white/50 hover:text-white transition-colors" title="Déconnexion">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 md:px-8 py-8">
        <StatsRow orders={orders} />

        <div className="flex items-center gap-1 mt-8 mb-6 border-b border-white/[0.08]">
          {(['todo', 'all'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`relative px-4 py-3 text-[14px] font-light transition-colors ${tab === t ? 'text-white' : 'text-white/40 hover:text-white/70'}`}>
              {t === 'todo' ? 'À traiter' : 'Toutes les commandes'}
              {tab === t && <span className="absolute bottom-0 left-0 right-0 h-px bg-glacier-400" />}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-white/40 font-light">Chargement…</div>
        ) : tab === 'todo' ? (
          <TodoSections orders={orders} {...handlers} />
        ) : (
          <>
            <FilterBar status={statusFilter} onStatus={setStatusFilter} search={search} onSearch={setSearch}
              sort={sort} onSort={setSort} onExport={() => downloadCsv(filtered)} />
            <OrdersTable orders={filtered} {...handlers} />
          </>
        )}
      </main>

      <ActionModals action={action} busy={actionBusy} onClose={() => setAction(null)} onConfirm={confirmAction} />
      {selectedLive && (
        <OrderDetail order={selectedLive} onClose={() => setSelected(null)} onSaveNotes={saveNotes}
          onAction={executeAction} onDownloadInvoice={handleDownloadInvoice} />
      )}
    </div>
  )
}
