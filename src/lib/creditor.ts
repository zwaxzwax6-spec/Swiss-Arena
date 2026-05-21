// Swiss Arena legal / creditor info for the QR-bill.
// TODO: client to fill real values before issuing real invoices.
// `account` is a CONVENTIONAL IBAN (no reference required — order ref travels in the
// message field). If the client switches to a QR-IBAN (IID 30000–31999), a QR reference
// becomes mandatory and qrbill.ts must be updated to generate one.
export const CREDITOR = {
  name: 'RAISON_SOCIALE_ICI', // ex: "Swiss Arena Sàrl"
  address: 'ADRESSE_ICI', // ex: "Rue du Lac 12"
  zip: 1003, // ex: 1003
  city: 'VILLE_ICI', // ex: "Lausanne"
  account: 'CH9300762011623852957', // valid conventional Swiss IBAN (placeholder)
  country: 'CH' as const,
}

export const IDE_TVA = 'CHE-000.000.000' // optional

export const CONTACT_EMAIL = 'contact@swissarena.ch'
