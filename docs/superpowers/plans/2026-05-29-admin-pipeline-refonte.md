# Admin Dashboard Pipeline Refonte — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`). Run `npm test` for unit tests, `npm run build` for tsc. Live DB via Supabase MCP.

**Goal:** Strip the now-automatic "confirmation" step out of the admin pipeline and rebuild the dashboard around only the real manual actions, with zero phantom steps and the email-auto error demoted to a discreet footnote.

**Architecture:** Remove the `confirmed` status entirely; `new` flows straight to `configure` (Stripe) or `mark_invoiced` (Facture). `nextAction`/`applyAction` in `orders.ts` are the single source of truth for transitions; the to-do view, table, detail panel and modals all read from them.

**Tech Stack:** React 18 + TS + Vite + Vitest, Tailwind, Supabase.

---

## New pipeline (manual actions only)

- **Stripe** (already paid): `new →[configure]→ configured →[ship]→ shipped →[complete]→ completed`
- **Facture 30j**: `new →[mark_invoiced]→ invoiced →[configure]→ configured →[ship]→ awaiting_payment →[pay]→ paid →[complete? optional]→ completed`

`nextAction` table:

| status | stripe | invoice_30d |
|---|---|---|
| new | configure ⚙️ | mark_invoiced 📄 |
| invoiced | — (n/a) | configure ⚙️ |
| configured | ship 📦 | ship 📦 |
| shipped | complete ✅ | (n/a, ship→awaiting_payment) |
| awaiting_payment | — | pay ✓ |
| paid | null | null |
| overdue | — | relance |
| completed/recovery | null | null |

## Decisions (spec gaps)
- Timeline confirmation-email event uses `created_at` as its date (no dedicated timestamp column).
- No IDE field exists → detail panel shows a zefix.ch search-by-company_name link for Facture orders with a company_name; no IDE value line.
- `paid` and `completed` have no primary action (`null`); `shipped`-Stripe → complete. To-do view = the 5 specified sections only.
- `confirmed_at` column stays in DB/`Order` (dead, harmless); `'confirm'` action + `confirmed` status removed from code.

## File map
- Migration (MCP + committed): remap `confirmed → new`.
- `src/lib/types.ts`: drop `'confirmed'` from `OrderStatus`, `STATUS_LABELS`, `STATUS_BADGE`.
- `src/lib/orders.ts`: rewrite `nextAction`; drop `'confirm'` from `AdminActionType` + `applyAction`.
- `src/lib/orders.test.ts`: update to new pipeline.
- `src/components/admin/TodoSections.tsx`: 5 sections, drop google extra.
- `src/components/admin/OrderDetail.tsx`: action at top, timeline rebuild, email-error footnote at bottom, zefix link, drop bottom Actions section.
- `src/components/admin/ActionModals.tsx`: drop confirm modal; configure = no email; mark_invoiced = "Générer la facture" with embedded PDF-gen button.
- `src/pages/admin/Dashboard.tsx`: pass `onGenerateInvoice` to modals; executeAction no longer special-cases generate_invoice as a primary action.
- `src/components/admin/RowActions.tsx`: relabel copy CTAs ("adresse email"/"adresse postale").

---

## Task 1: Migration — remap confirmed → new
- [ ] MCP `apply_migration` `remap_confirmed_to_new`: `update orders set status='new' where status='confirmed';`
- [ ] Commit a matching `supabase/migrations/*_remap_confirmed_to_new.sql`.

## Task 2: types.ts — drop `confirmed` (TDD via tsc)
- [ ] Remove `| 'confirmed'` from `OrderStatus`; remove `confirmed:` lines from `STATUS_LABELS` and `STATUS_BADGE`.
- [ ] `npm run build` will surface every remaining reference (orders.ts switch, etc.) — fix in later tasks.

## Task 3: orders.ts nextAction + applyAction (TDD)
- [ ] Update `src/lib/orders.test.ts`:
  - `new + stripe → configure`; `new + invoice → mark_invoiced`
  - `invoiced → configure`; `configured → ship`
  - `shipped (stripe) → complete`; `awaiting_payment → pay`
  - `paid → null`; `overdue → relance`; `completed/recovery → null`
  - Remove the two `confirmed` nextAction tests and the `applyAction('confirm')` test.
- [ ] Run `npm test` → FAIL.
- [ ] Rewrite `nextAction` switch (remove `confirmed` case; `new` stripe→configure / invoice→mark_invoiced; `shipped`→complete; `paid`→null). Remove `'confirm'` from `AdminActionType` and its `applyAction` case.
- [ ] Run `npm test` → PASS. Commit.

## Task 4: TodoSections — 5 sections
- [ ] Replace `groups` with exactly: overdue / new / invoiced(à configurer) / configured(à expédier) / awaiting_payment(en attente paiement). Drop the `confirmed` and `paid&&!shipped` groups and the `googleLink` extra. Keep `overdueExtra`, `address`, `countdown`.
- [ ] Empty-state text: "Tout est à jour ✓ — aucune action requise".
- [ ] `npm run build`. Commit.

## Task 5: OrderDetail — action top, timeline, footnote, zefix
- [ ] Move `PrimaryActionButton` to a prominent block right under the header.
- [ ] Rebuild `buildTimeline`: Commande reçue (created_at) · Email de confirmation (created_at if sent, else grey "Email auto non envoyé") · Facture générée (invoiced_at, invoice only) · Plaque configurée (configured_at) · Expédiée (shipped_at + tracking) · Paiement reçu (invoice_paid_at, invoice only) · Terminée. No buttons.
- [ ] Client section: add zefix link for invoice_30d + company_name → `https://www.zefix.ch/fr/search/entity/list?name=<encoded>`.
- [ ] Remove the top amber email-error banner; add a bottom footnote: `ⓘ Email de confirmation auto non envoyé (quota serveur). Le client sera informé aux étapes suivantes.` in `text-[12px] text-white/35`, only when `!confirmation_email_sent`.
- [ ] Drop the bottom "Actions" section (action now at top; copies live in Client section). Keep "Copier l'adresse email"/"Copier l'adresse postale" labels.
- [ ] `npm run build`. Commit.

## Task 6: ActionModals — cleanup
- [ ] Remove the `confirm` modal branch entirely.
- [ ] `configure` modal: no email block — just "La plaque a-t-elle été programmée ?" + confirm "✓ Plaque configurée" (+ optional google link if present).
- [ ] `mark_invoiced` modal = "Générer la facture": email template (invoiceEmail) + copy CTAs + a "Générer le PDF" button (calls new `onGenerateInvoice` prop; shows ✓ when `invoice_pdf_url` set) + "⚠️ joindre le PDF" reminder + confirm "✓ Facture envoyée".
- [ ] `ship`/`pay`/`relance`: unchanged (already have email block; pay stays invoice-only via existing showEmail guard — but pay is now only reachable for invoice anyway).
- [ ] `npm run build`. Commit.

## Task 7: Dashboard wiring
- [ ] Pass `onGenerateInvoice={handleGenerateInvoice}` to `<ActionModals>`.
- [ ] `executeAction`: keep generate_invoice immediate path for safety, but primary actions no longer emit it.
- [ ] `npm run build`. Commit.

## Task 8: RowActions labels
- [ ] "Copier email" → "Copier l'adresse email" (toast "Adresse email copiée ✓"); "Copier adresse" → "Copier l'adresse postale" (toast "Adresse postale copiée ✓").
- [ ] `npm run build`. Commit.

## Task 9: Verify + code-review + push
- [ ] `npm test` + `npm run build` green.
- [ ] Live check on SA-2026-00004 / SA-2026-00005: confirm statuses, run a transition.
- [ ] code-review skill on the diff; address findings.
- [ ] Commit + push main.

## Self-review
- Spec coverage: pipeline ✓, 5 to-do sections ✓, detail layout ✓, modal cleanup ✓, table actions (via nextAction) ✓, stats unchanged ✓, migration ✓.
- Open flag for user: shipped-Stripe / paid completion handled per status table (no to-do section); IDE→zefix-by-name; confirmation timeline date = created_at.
