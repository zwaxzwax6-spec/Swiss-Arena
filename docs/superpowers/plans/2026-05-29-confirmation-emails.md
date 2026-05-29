# Automatic Confirmation Emails + Modal CTA Rework — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. Run unit tests with `npm test`. Live Supabase steps go through the Supabase MCP (`deploy_edge_function`, `apply_migration`, `execute_sql`) except secrets, which need `npx supabase` + a `SUPABASE_ACCESS_TOKEN`.

**Goal:** When a customer places an order on `/commander`, an order-confirmation email is sent automatically (Stripe variant vs. Facture-30j variant). All other emails stay manual via copyable templates in the admin dashboard, whose action modals get a clean 3-CTA structure.

**Architecture:** A Supabase Edge Function `send-confirmation-email` connects to IONOS SMTP (denomailer) and sends the right template based on `payment_method`. A Postgres `AFTER INSERT` trigger on `orders` (pg_net) calls the function. SMTP creds live in Edge Function secrets; the function writes back `confirmation_email_sent` / `confirmation_email_error`. The function is gated by a shared `WEBHOOK_SECRET` header (verify_jwt disabled) and is idempotent.

**Tech Stack:** Deno + denomailer (Edge Function), Postgres pg_net trigger, React + TypeScript + Vitest (frontend), Tailwind.

**Live project:** `Review Swiss Arena` ref `fqygbnqrlvzlzrumwhcl` (ACTIVE_HEALTHY).

---

## Key findings from codebase exploration

- `Order` type: `src/lib/types.ts` — has `payment_method` (`'stripe' | 'invoice_30d'`), `email`, `first_name`, `order_ref`, `amount_chf`, etc. **No** `confirmation_email_sent` / `confirmation_email_error` columns yet.
- **No** `src/lib/email-templates.ts` exists. The "templates copiables / manuels existants" referenced by the brief do **not** exist — they must be authored.
- Action modals: `src/components/admin/ActionModals.tsx` — currently have **no** copy CTAs at all (the "Copier adresse" button lives only in `OrderDetail.tsx:177`). The 3-CTA modal structure is a build, not a tweak.
- Order insert: `src/pages/Commander.tsx:71` (`status: 'new'`). No app-side email send — automation is purely DB-trigger driven.
- Dashboard wiring: `src/pages/admin/Dashboard.tsx` — `confirmAction` (l.82) persists patches; `ActionModals` + `OrderDetail` rendered at l.205-209.
- Test runner: Vitest (`npm test`), existing `src/lib/orders.test.ts`.

## Security decisions

- Edge Function deployed with `verify_jwt: false` (called by DB trigger). To prevent arbitrary callers from spamming emails, the function requires a secret header `x-webhook-secret` matching the `WEBHOOK_SECRET` env var. The trigger sends it.
- Trigger uses the **anon** key in the `Authorization` header (already public in the client) — the real service_role key is **never** written into committed SQL. The function uses the auto-injected `SUPABASE_SERVICE_ROLE_KEY` env var to write back status.
- Idempotency: function skips sending if `confirmation_email_sent` is already true.
- SMTP failure must never block the insert — the trigger is fire-and-forget (pg_net async); the function catches SMTP errors and records them in `confirmation_email_error`.

## File structure

- Create `supabase/functions/send-confirmation-email/index.ts` — Edge Function (Deno).
- Create `supabase/functions/send-confirmation-email/deno.json` — denomailer import.
- Create `supabase/migrations/<ts>_confirmation_email.sql` — columns + pg_net + trigger (sanitized: anon key only, no service_role key).
- Create `src/lib/email-templates.ts` — pure `{subject, body}` builders for each flow (frontend, copyable).
- Create `src/lib/email-templates.test.ts` — Vitest unit tests.
- Modify `src/lib/types.ts` — add the two new columns to `Order`.
- Modify `src/components/admin/ActionModals.tsx` — 3-CTA structure for email modals; postal copy only in ship modal.
- Modify `src/components/admin/OrderDetail.tsx` — relabel CTAs unambiguously; ⚠️ indicator when `confirmation_email_sent === false`.
- Modify `src/components/admin/OrdersTable.tsx` / `TodoSections.tsx` (if needed) — surface ⚠️ flag in list (optional, low priority).

---

## Task 1: Add tracking columns to `orders` (live + types)

**Files:** Migration via MCP `apply_migration`; `src/lib/types.ts`.

- [ ] Apply migration `add_confirmation_email_tracking`:
  ```sql
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmation_email_sent BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmation_email_error TEXT;
  ```
- [ ] Add to `Order` interface in `types.ts` after `notes`:
  ```ts
  confirmation_email_sent: boolean
  confirmation_email_error: string | null
  ```
- [ ] `npm run build` (tsc) passes.

## Task 2: Email template builders (TDD) — `src/lib/email-templates.ts`

Pure functions returning `{ subject: string; body: string }` (plain text for clipboard). One builder per flow; `payment_method` selects the confirmation variant. Tested first.

- [ ] **Write failing tests** `src/lib/email-templates.test.ts`: subject contains `order_ref`; body contains `first_name`; Stripe confirmation mentions "paiement"/"expédiée sous 24h"; invoice confirmation mentions "enregistrée"/"24h"; ship template includes tracking when present; relance references échéance.
- [ ] Run `npm test` → FAIL (module missing).
- [ ] Implement builders: `confirmationEmail(o)`, `invoiceEmail(o)`, `paymentReceivedEmail(o)`, `shippedEmail(o)`, `relanceEmail(o)`. Copy consistent with the two brief-specified confirmation templates. Export a `fullEmailText({subject, body})` helper = `Objet : ...\n\n...`.
- [ ] Run `npm test` → PASS.
- [ ] Commit.

## Task 3: Edge Function `send-confirmation-email`

**Files:** `supabase/functions/send-confirmation-email/index.ts`, `deno.json`.

- [ ] Implement: read `{record}` payload; verify `x-webhook-secret` header == `WEBHOOK_SECRET` (else 401); skip if `record.confirmation_email_sent` true; build HTML + text per `payment_method` (sober, white bg, max-width 480px, per brief); send via denomailer (port 465, `tls: true`); on success `UPDATE orders SET confirmation_email_sent = true`; on SMTP error `UPDATE ... confirmation_email_error = <msg>` and still return 200 (never throw to caller). Use auto-injected `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` for the write-back.
- [ ] `deno.json` imports denomailer 1.6.0 + supabase-js.

## Task 4: Migration — pg_net + trigger (sanitized)

**Files:** `supabase/migrations/<ts>_confirmation_email_trigger.sql` (committed, anon key only) + applied live via MCP.

- [ ] `CREATE EXTENSION IF NOT EXISTS pg_net;`
- [ ] `trigger_send_confirmation()` → `net.http_post(url, headers{Content-Type, Authorization: Bearer <ANON>, x-webhook-secret: <SECRET>}, body{record: row_to_json(NEW)})`.
- [ ] `CREATE TRIGGER on_order_created AFTER INSERT ON orders FOR EACH ROW EXECUTE FUNCTION trigger_send_confirmation();`
- [ ] Note: WEBHOOK_SECRET value injected at apply time; committed file uses a placeholder + comment.

## Task 5: Secrets + deploy (needs token)

- [ ] `npx supabase login` with `SUPABASE_ACCESS_TOKEN`; `npx supabase link --project-ref fqygbnqrlvzlzrumwhcl`.
- [ ] `npx supabase secrets set SMTP_HOST=... SMTP_PORT=465 SMTP_USER=... SMTP_PASSWORD='...' SMTP_FROM_NAME='Swiss Arena' SMTP_FROM_EMAIL=... WEBHOOK_SECRET=<generated>`.
- [ ] Deploy via MCP `deploy_edge_function` (verify_jwt=false) OR `npx supabase functions deploy send-confirmation-email --no-verify-jwt`.
- [ ] Apply Task 4 migration with the real WEBHOOK_SECRET + anon key.

## Task 6: Live end-to-end test (to zwaxzwax6@gmail.com)

- [ ] Invoke function directly with a Stripe-variant fake payload (email = zwaxzwax6@gmail.com, fake id) → expect inbox delivery + 200.
- [ ] Same with invoice_30d variant.
- [ ] Insert a real test order (payment_method invoice_30d, email = test address) → confirm trigger fires, email arrives, `confirmation_email_sent` flips true. Check `get_logs edge-function`.
- [ ] Delete test orders from `orders`.

## Task 7: Modal CTA rework — `ActionModals.tsx`

Email-related modals (`confirm` resend-only, `mark_invoiced`, `pay`, `ship`, `relance`) get: destinataire line, **[Copier l'adresse email]**, scrollable email preview (subject + body from Task 2), **[Copier le contenu de l'email]**, + the step-confirm CTA. Distinct toasts: "Adresse email copiée ✓" / "Contenu de l'email copié ✓". `ship` modal **also** gets **[Copier l'adresse postale]** (explicit label). `confirm` modal shows copy CTAs **only when** `confirmation_email_sent === false` (auto-send failed) — otherwise a note that the email was sent automatically.

- [ ] Build a shared `EmailActionBody` sub-component (recipient + copy email + preview + copy content) parameterized by the template.
- [ ] Wire each modal type to its template builder.
- [ ] `confirm` modal: conditional on `confirmation_email_sent`.
- [ ] Remove `relance`'s auto-copy-on-confirm side effect duplication (keep behavior consistent; the modal now copies explicitly). Verify `Dashboard.confirmAction` still copies email on relance OR rely on modal CTA — keep one path, avoid double toast.
- [ ] `npm run build` passes.

## Task 8: OrderDetail CTAs + ⚠️ indicator

**Files:** `src/components/admin/OrderDetail.tsx`.

- [ ] Relabel SecBtns: "Copier email" → "Copier l'adresse email"; "Copier adresse" → "Copier l'adresse postale" (postal stays here, per brief).
- [ ] Add ⚠️ banner when `order.payment_method` triggered an auto email and `confirmation_email_sent === false`: "Email de confirmation non envoyé" with a button to copy the confirmation template for manual send.
- [ ] `npm run build` passes.

## Task 9: Code review + commit + push

- [ ] Run code-review skill on the diff.
- [ ] Address findings.
- [ ] Commit + push to GitHub.

---

## Self-review notes
- Confirmation template text duplicated between `src/lib/email-templates.ts` (frontend resend) and the Edge Function (Deno) — unavoidable runtime boundary; keep wording identical, flag in comments.
- Manual template copy (facture/paiement/expédition/relance) is **authored** (not in brief) — surface to user for wording approval.
