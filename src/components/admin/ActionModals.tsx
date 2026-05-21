import { useEffect, useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Input from '../ui/Input'
import { formatCHF, formatDateFr, formatAddressOneLine } from '../../lib/format'
import type { AdminActionType } from '../../lib/orders'
import type { Order } from '../../lib/types'

// Action types that open a confirmation modal (generate_invoice excluded).
export type ModalActionType = Exclude<AdminActionType, 'generate_invoice'>

export interface AdminAction {
  type: ModalActionType
  order: Order
}

interface Props {
  action: AdminAction | null
  busy: boolean
  onClose: () => void
  onConfirm: (action: AdminAction, tracking?: string) => void
}

function Recap({ order }: { order: Order }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/8 px-4 py-3 my-4 space-y-1">
      <Row label="Réf" value={<span className="font-mono">{order.order_ref}</span>} />
      <Row label="Client" value={`${order.first_name} ${order.last_name}`} />
      <Row label="Méthode" value={order.payment_method === 'stripe' ? 'Stripe' : 'Facture 30j'} />
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-white/45 text-[13px]">{label}</span>
      <span className="text-[13px] text-white/85 text-right">{value}</span>
    </div>
  )
}

export default function ActionModals({ action, busy, onClose, onConfirm }: Props) {
  const [tracking, setTracking] = useState('')
  useEffect(() => setTracking(''), [action])
  if (!action) return null
  const { order, type } = action
  const cancel = (
    <Button variant="ghost" onClick={onClose} disabled={busy}>Annuler</Button>
  )

  if (type === 'confirm') {
    return (
      <Modal open onClose={onClose} title="Confirmation envoyée ?"
        footer={<>{cancel}<Button variant="ghost" loading={busy} onClick={() => onConfirm(action)}
          className="!bg-blue-500/15 !text-blue-300 !border-blue-500/25 hover:!bg-blue-500/25">Oui, c'est fait</Button></>}>
        Vous avez envoyé l'email de confirmation à <span className="text-white/90">{order.email}</span> ?
        <Recap order={order} />
      </Modal>
    )
  }

  if (type === 'mark_invoiced') {
    return (
      <Modal open onClose={onClose} title="Facture envoyée ?"
        footer={<>{cancel}<Button variant="ghost" loading={busy} onClick={() => onConfirm(action)}
          className="!bg-indigo-500/15 !text-indigo-300 !border-indigo-500/25 hover:!bg-indigo-500/25">Oui, envoyée</Button></>}>
        La facture PDF a été envoyée à <span className="text-white/90">{order.email}</span> ? L'échéance 30 jours démarre maintenant.
        <Recap order={order} />
      </Modal>
    )
  }

  if (type === 'pay') {
    return (
      <Modal open onClose={onClose} title={`Confirmer la réception du paiement de ${formatCHF(order.amount_chf)} CHF ?`}
        footer={<>{cancel}<Button variant="ghost" loading={busy} onClick={() => onConfirm(action)}
          className="!bg-emerald-500/15 !text-emerald-300 !border-emerald-500/25 hover:!bg-emerald-500/25">Confirmer</Button></>}>
        <Recap order={order} />
      </Modal>
    )
  }

  if (type === 'configure') {
    return (
      <Modal open onClose={onClose} title="La plaque a été programmée avec le lien Google ?"
        footer={<>{cancel}<Button variant="ghost" loading={busy} onClick={() => onConfirm(action)}
          className="!bg-cyan-500/15 !text-cyan-300 !border-cyan-500/25 hover:!bg-cyan-500/25">Oui, c'est configuré</Button></>}>
        <a href={order.google_business_url} target="_blank" rel="noreferrer"
          className="block my-4 break-all text-[13px] text-blue-300 underline underline-offset-2">
          {order.google_business_url || '—'}
        </a>
      </Modal>
    )
  }

  if (type === 'ship') {
    return (
      <Modal open onClose={onClose} title="Marquer comme expédiée ?"
        footer={<>{cancel}<Button variant="ghost" loading={busy} onClick={() => onConfirm(action, tracking)}
          className="!bg-violet-500/15 !text-violet-300 !border-violet-500/25 hover:!bg-violet-500/25">Confirmer l'expédition</Button></>}>
        <div className="my-4 text-[13px] text-white/70">{formatAddressOneLine(order)}</div>
        <Input label="Numéro de suivi" name="tracking" optional placeholder="ex: 99.00.123456.78901234"
          value={tracking} onChange={(e) => setTracking(e.target.value)} />
      </Modal>
    )
  }

  if (type === 'complete') {
    return (
      <Modal open onClose={onClose} title="Marquer comme terminée ?"
        footer={<>{cancel}<Button variant="ghost" loading={busy} onClick={() => onConfirm(action)}>Terminer</Button></>}>
        <Recap order={order} />
        La commande sera archivée.
      </Modal>
    )
  }

  if (type === 'relance') {
    const n = order.relance_count + 1
    return (
      <Modal open onClose={onClose} title={`Relancer ${order.first_name} ${order.last_name} ?`}
        footer={<>{cancel}<Button variant="ghost" loading={busy} onClick={() => onConfirm(action)}
          className="!bg-orange-500/15 !text-orange-300 !border-orange-500/25 hover:!bg-orange-500/25">Relancer et copier email</Button></>}>
        Relance n°{n} — {order.last_relance_at ? `dernière relance le ${formatDateFr(order.last_relance_at)}` : 'première relance'}.
        <div className="my-3 text-[13px] text-white/60">L'email du client sera copié dans votre presse-papier.</div>
        <Recap order={order} />
      </Modal>
    )
  }

  // escalate
  return (
    <Modal open danger onClose={onClose} title="⚠️ Escalader en recouvrement ?"
      footer={<>{cancel}<Button variant="danger" loading={busy} onClick={() => onConfirm(action)}>Confirmer l'escalade</Button></>}>
      La commande {order.order_ref} sera marquée comme impayée et devra être traitée manuellement.
      <div className="my-3 text-[13px] text-white/60">Relances effectuées : {order.relance_count}</div>
    </Modal>
  )
}
