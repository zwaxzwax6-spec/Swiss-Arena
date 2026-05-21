import { CREDITOR } from './creditor'
import { PRODUCT_NAME, type Order } from './types'

// The swissqrbill browser bundle relies on PDFKit + blob-stream loaded as globals.
// We lazy-load the CDN scripts on first use to avoid bundling pdfkit into the SPA.
declare global {
  interface Window {
    PDFDocument?: any
    SwissQRBill?: any
  }
}

const PDFKIT_SRC = 'https://cdn.jsdelivr.net/npm/pdfkit@0.15.0/js/pdfkit.standalone.js'
const SWISSQRBILL_SRC = 'https://cdn.jsdelivr.net/npm/swissqrbill@4.2.0/lib/bundle/swissqrbill.js'

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`Échec du chargement: ${src}`))
    document.head.appendChild(s)
  })
}

let loaded = false
async function ensureLibs(): Promise<void> {
  if (loaded) return
  // PDFKit must be present before the swissqrbill bundle reads it.
  await loadScript(PDFKIT_SRC)
  await loadScript(SWISSQRBILL_SRC)
  loaded = true
}

/** Builds a Swiss QR-bill invoice PDF for an order and returns it as a Blob. */
export async function generateInvoicePdf(order: Order): Promise<Blob> {
  await ensureLibs()
  const PDFDocument = window.PDFDocument
  const SwissQRBill = window.SwissQRBill
  if (!PDFDocument || !SwissQRBill) {
    throw new Error('Librairies QR-facture indisponibles')
  }

  const data = {
    currency: 'CHF' as const,
    amount: Number(order.amount_chf),
    creditor: {
      account: CREDITOR.account,
      address: CREDITOR.address,
      city: CREDITOR.city,
      country: CREDITOR.country,
      name: CREDITOR.name,
      zip: CREDITOR.zip,
    },
    debtor: {
      address: order.address,
      city: order.city,
      country: 'CH',
      name: `${order.first_name} ${order.last_name}`,
      zip: Number(order.postal_code) || 0,
    },
    message: `Commande ${order.order_ref}`,
  }

  const pdf = new PDFDocument({ size: 'A4', margin: 50 })
  const chunks: BlobPart[] = []
  pdf.on('data', (c: BlobPart) => chunks.push(c))

  // Invoice header
  pdf.fontSize(20).fillColor('#000').text(CREDITOR.name, 50, 60)
  pdf
    .fontSize(10)
    .fillColor('#555')
    .text(`${CREDITOR.address}, ${CREDITOR.zip} ${CREDITOR.city}`)
  pdf.moveDown(2)

  pdf.fontSize(16).fillColor('#000').text(`Facture ${order.order_ref}`)
  pdf.moveDown(0.5)
  pdf
    .fontSize(10)
    .fillColor('#555')
    .text(`Date : ${new Date().toLocaleDateString('fr-CH')}`)
  pdf.moveDown(1.5)

  pdf.fontSize(11).fillColor('#000').text('Adressé à :')
  pdf
    .fontSize(10)
    .fillColor('#333')
    .text(`${order.first_name} ${order.last_name}`)
  if (order.company_name) pdf.text(order.company_name)
  pdf.text(order.address)
  pdf.text(`${order.postal_code} ${order.city}, ${order.canton}`)
  pdf.moveDown(2)

  pdf
    .fontSize(11)
    .fillColor('#000')
    .text(`1 × ${PRODUCT_NAME}`, { continued: true })
    .text(`${Number(order.amount_chf).toFixed(2)} CHF`, { align: 'right' })
  pdf.moveDown(0.5)
  pdf
    .fontSize(12)
    .text('Total', { continued: true })
    .text(`${Number(order.amount_chf).toFixed(2)} CHF`, { align: 'right' })

  // QR bill payment part at the bottom of the page
  const QrBillClass = SwissQRBill.pdf?.SwissQRBill ?? SwissQRBill.PDF?.SwissQRBill
  const qrBill = new QrBillClass(data)
  qrBill.attachTo(pdf)

  return new Promise<Blob>((resolve, reject) => {
    pdf.on('end', () => resolve(new Blob(chunks, { type: 'application/pdf' })))
    pdf.on('error', reject)
    pdf.end()
  })
}
