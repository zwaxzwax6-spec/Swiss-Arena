import { useEffect, useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Input from '../ui/Input'
import { formatCHF } from '../../lib/format'
import type { Order } from '../../lib/types'

export type AdminAction =
  | { type: 'pay'; order: Order }
  | { type: 'ship'; order: Order }
  | { type: 'escalate'; order: Order }

interface Props {
  action: AdminAction | null
  busy: boolean
  onClose: () => void
  onConfirm: (action: AdminAction, tracking?: string) => void
}

function OrderRecap({ order }: { order: Order }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/8 px-4 py-3 my-4 space-y-1">
      <div className="flex justify-between">
        <span className="text-white/45 text-[13px]">Réf</span>
        <span className="font-mono text-[13px] text-white/85">{order.order_ref}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-white/45 text-[13px]">Client</span>
        <span className="text-[13px] text-white/85">
          {order.first_name} {order.last_name}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-white/45 text-[13px]">Montant</span>
        <span className="text-[13px] text-white/85">{formatCHF(order.amount_chf)} CHF</span>
      </div>
    </div>
  )
}

export default function ActionModals({ action, busy, onClose, onConfirm }: Props) {
  const [tracking, setTracking] = useState('')

  useEffect(() => {
    setTracking('')
  }, [action])

  if (!action) return null
  const { order } = action

  if (action.type === 'pay') {
    return (
      <Modal
        open
        onClose={onClose}
        title="Confirmer la réception du paiement ?"
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Annuler
            </Button>
            <Button
              variant="ghost"
              loading={busy}
              onClick={() => onConfirm(action)}
              className="!bg-emerald-500/15 !text-emerald-300 !border-emerald-500/25 hover:!bg-emerald-500/25"
            >
              Confirmer
            </Button>
          </>
        }
      >
        <OrderRecap order={order} />
        Le statut passera à « Payé ».
      </Modal>
    )
  }

  if (action.type === 'ship') {
    return (
      <Modal
        open
        onClose={onClose}
        title="Marquer comme expédiée ?"
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Annuler
            </Button>
            <Button variant="ghost" loading={busy} onClick={() => onConfirm(action, tracking)}>
              Confirmer
            </Button>
          </>
        }
      >
        <OrderRecap order={order} />
        <Input
          label="Numéro de suivi"
          name="tracking"
          optional
          placeholder="ex: 99.00.123456.78901234"
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
        />
      </Modal>
    )
  }

  // escalate
  return (
    <Modal
      open
      danger
      onClose={onClose}
      title="⚠️ Escalader en recouvrement ?"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button variant="danger" loading={busy} onClick={() => onConfirm(action)}>
            Confirmer l'escalade
          </Button>
        </>
      }
    >
      <OrderRecap order={order} />
      Cette action signale la commande comme impayée et devra être traitée manuellement.
    </Modal>
  )
}
