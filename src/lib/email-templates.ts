import type { Order } from './types'
import type { AdminActionType } from './orders'
import { formatCHF, formatDateFr } from './format'
import { CONTACT_EMAIL } from './creditor'

/** A copyable email: subject line + plain-text body. */
export interface EmailContent {
  subject: string
  body: string
}

const SIGNATURE = 'Swiss Arena'

/**
 * Order-confirmation email — the ONE email sent automatically by the
 * `send-confirmation-email` Edge Function. This frontend copy is the manual
 * re-send fallback (used only when `confirmation_email_sent === false`).
 *
 * NOTE: the wording here MUST stay in sync with the Edge Function template
 * (supabase/functions/send-confirmation-email/index.ts) — different runtimes,
 * no shared import, so the two copies are duplicated intentionally.
 */
export function confirmationEmail(o: Order): EmailContent {
  if (o.payment_method === 'stripe') {
    return {
      subject: `Commande ${o.order_ref} confirmée — Swiss Arena`,
      body: [
        `Bonjour ${o.first_name},`,
        `Votre paiement a bien été reçu. Merci.`,
        `Votre plaque NFC Swiss Arena sera expédiée sous 24h. Vous recevrez un email dès l'expédition.`,
        SIGNATURE,
      ].join('\n\n'),
    }
  }
  return {
    subject: `Commande ${o.order_ref} enregistrée — Swiss Arena`,
    body: [
      `Bonjour ${o.first_name},`,
      `Votre commande ${o.order_ref} est bien enregistrée.`,
      `Nous vérifions votre éligibilité à la facture 30 jours et revenons vers vous sous 24h avec votre facture et les détails de livraison.`,
      SIGNATURE,
    ].join('\n\n'),
  }
}

/** Facture envoyée — invoice with QR-bill is attached, 30-day deadline starts. */
export function invoiceEmail(o: Order): EmailContent {
  // invoice_due_date is only persisted when the admin confirms "Facture envoyée".
  // For the modal preview (order still 'new', before mark_invoiced applies)
  // fall back to the date applyAction will set (now + 30 days) so it's never blank.
  const dueIso = o.invoice_due_date ?? new Date(Date.now() + 30 * 86_400_000).toISOString()
  return {
    subject: `Votre facture ${o.order_ref} — Swiss Arena`,
    body: [
      `Bonjour ${o.first_name},`,
      `Vous trouverez en pièce jointe votre facture pour la commande ${o.order_ref}, d'un montant de ${formatCHF(o.amount_chf)} CHF.`,
      `Le paiement est dû sous 30 jours, soit au plus tard le ${formatDateFr(dueIso)}. Le bulletin de versement QR figure sur la facture.`,
      `Votre plaque NFC est en préparation et vous sera expédiée prochainement.`,
      SIGNATURE,
    ].join('\n\n'),
  }
}

/** Paiement reçu — confirmation of received payment. */
export function paymentReceivedEmail(o: Order): EmailContent {
  return {
    subject: `Paiement reçu — Commande ${o.order_ref} — Swiss Arena`,
    body: [
      `Bonjour ${o.first_name},`,
      `Nous confirmons la bonne réception de votre paiement de ${formatCHF(o.amount_chf)} CHF pour la commande ${o.order_ref}. Merci.`,
      SIGNATURE,
    ].join('\n\n'),
  }
}

/** Expédiée — shipping notification, with tracking number when available. */
export function shippedEmail(o: Order): EmailContent {
  const lines = [
    `Bonjour ${o.first_name},`,
    `Bonne nouvelle : votre plaque NFC Swiss Arena (commande ${o.order_ref}) a été expédiée.`,
  ]
  if (o.tracking_number) {
    lines.push(`Numéro de suivi : ${o.tracking_number}`)
  }
  lines.push(`Vous devriez la recevoir sous 24h.`)
  lines.push(SIGNATURE)
  return {
    subject: `Votre commande ${o.order_ref} a été expédiée — Swiss Arena`,
    body: lines.join('\n\n'),
  }
}

/**
 * Relance — payment reminder, escalating on `relance_count`:
 *   0  → first, courteous reminder
 *   ≥1 → firmer "dernier rappel" insisting on the imminent deadline.
 * (relance_count is the count BEFORE this send, so 0 = the 1st relance.)
 */
export function relanceEmail(o: Order): EmailContent {
  const due = formatDateFr(o.invoice_due_date)
  if (o.relance_count >= 1) {
    return {
      subject: `Dernier rappel — Facture ${o.order_ref} · échéance proche — Swiss Arena`,
      body: [
        `Bonjour ${o.first_name},`,
        `Malgré notre précédent rappel, la facture ${o.order_ref} d'un montant de ${formatCHF(o.amount_chf)} CHF demeure impayée, et son échéance (${due}) est désormais imminente.`,
        `Nous vous invitons à procéder au règlement dans les meilleurs délais. En cas de difficulté, contactez-nous à ${CONTACT_EMAIL}.`,
        SIGNATURE,
      ].join('\n\n'),
    }
  }
  return {
    subject: `Rappel — Facture ${o.order_ref} en attente — Swiss Arena`,
    body: [
      `Bonjour ${o.first_name},`,
      `Sauf erreur de notre part, la facture ${o.order_ref} d'un montant de ${formatCHF(o.amount_chf)} CHF reste en attente de règlement (échéance : ${due}).`,
      `Nous vous remercions de bien vouloir procéder au paiement. Si vous l'avez déjà effectué, merci d'ignorer ce message.`,
      SIGNATURE,
    ].join('\n\n'),
  }
}

/** "Objet : ...\n\n<body>" — ready to paste into a mail client. */
export function fullEmailText({ subject, body }: EmailContent): string {
  return `Objet : ${subject}\n\n${body}`
}

/** Maps an admin action to its email template, or null for non-emailing actions. */
export function emailForAction(type: AdminActionType, o: Order): EmailContent | null {
  switch (type) {
    case 'mark_invoiced':
      return invoiceEmail(o)
    case 'pay':
      return paymentReceivedEmail(o)
    case 'ship':
      return shippedEmail(o)
    case 'relance':
      return relanceEmail(o)
    default:
      return null
  }
}
