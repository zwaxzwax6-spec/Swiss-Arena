import { PAYMENT_LABELS, STATUS_LABELS, type Order } from './types'
import { formatDateShort } from './format'

const HEADERS = [
  'Réf', 'Statut', 'Prénom', 'Nom', 'Email', 'Téléphone', 'Entreprise',
  'Adresse', 'NPA', 'Ville', 'Canton', 'Fiche Google', 'Montant', 'Méthode',
  'Date création', 'Date échéance', 'Date paiement', 'Date expédition', 'Relances',
]

function escapeCell(value: string): string {
  if (/[";\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function ordersToCsv(orders: Order[]): string {
  const rows = orders.map((o) =>
    [
      o.order_ref,
      STATUS_LABELS[o.status],
      o.first_name,
      o.last_name,
      o.email,
      o.phone,
      o.company_name ?? '',
      o.address,
      o.postal_code,
      o.city,
      o.canton,
      o.google_business_url,
      Number(o.amount_chf).toFixed(2),
      PAYMENT_LABELS[o.payment_method],
      formatDateShort(o.created_at),
      formatDateShort(o.invoice_due_date),
      formatDateShort(o.invoice_paid_at),
      formatDateShort(o.shipped_at),
      String(o.relance_count),
    ]
      .map((c) => escapeCell(String(c)))
      .join(';'),
  )
  return [HEADERS.join(';'), ...rows].join('\n')
}

export function downloadCsv(orders: Order[]): void {
  const csv = '﻿' + ordersToCsv(orders) // BOM for Excel UTF-8
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `swiss-arena-commandes-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
