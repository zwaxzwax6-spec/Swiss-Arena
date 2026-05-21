# Swiss Arena E-commerce Implementation Plan

> **For agentic workers:** Executed inline in-session. Steps tracked via the harness task list (#1–#7).

**Goal:** Turn the existing Swiss Arena landing (`index.html`) repo into a functional e-commerce site: an order funnel (`/commander`), confirmation page (`/confirmation`), and an admin dashboard (`/admin`) backed by Supabase — without touching the existing landing served on `/`.

**Architecture:** Static landing (`index.html` in `public/`) served on `/`. A React 18 + Vite + TS SPA built to `app.html`, mounted via Vercel rewrites on `/commander`, `/confirmation`, `/admin/*`. Supabase (Postgres + Auth + Storage + Realtime) is the backend. The order funnel writes with the **anon** key (RLS: anon insert/select). The admin uses **Supabase Auth login** + the same anon key; RLS grants the `authenticated` role full access (service_role key is NOT shipped to the client — security).

**Tech Stack:** React 18, Vite, TypeScript, Tailwind v3 (custom tokens mirroring the landing's glass DA), React Router v6, @supabase/supabase-js v2, swissqrbill, lucide-react.

---

## Design System (extracted from `index.html`)

Reproduce exactly. Key tokens baked into Tailwind config + a small `src/index.css` porting the landing's custom classes:
- Fonts: Inter (200/300/400/500/600) + Instrument Serif (italic accents) → `.font-serif`.
- `cta-premium`: white bg, multi-layer glacier-blue glow, hover translateY(-2px), `cubic-bezier(0.22,1,0.36,1)` 0.5s.
- `card-glass`: gradient bg, blur(20px) saturate(140%), border white/8%, hover lift + glacier border.
- `offer-card`, `glass-pill`, `stat-glass`, `headline-glow`, label-line dividers.
- Inputs (new): bg-transparent, border white/10, rounded-[16px], focus glacier border + ring. Errors: text-red-400/80 text-[13px].
- Easing util `ease-premium`, radius `rounded-card` (28px) / `rounded-card-lg` (32px).

## File Structure

- `public/index.html`, `public/LogoSwiss.png` — moved existing landing (untouched content).
- `app.html` — React entry (root + main.tsx).
- `vite.config.ts` — multi-input (`app` → app.html). `vercel.json` — rewrites for SPA routes.
- `tailwind.config.js`, `postcss.config.js`, `tsconfig.json`, `package.json`.
- `src/main.tsx`, `src/App.tsx` (Router), `src/index.css`.
- `src/lib/`: `supabase.ts`, `types.ts`, `cantons.ts`, `postal-codes.ts`, `creditor.ts`, `format.ts`.
- `src/components/ui/`: `GlassCard`, `Button`, `Input`, `Select`, `Badge`, `Modal`, `Toast`, `ToastProvider`.
- `src/components/layout/`: `AppNavBar`, `AppFooter`.
- `src/components/tunnel/`: `Stepper`, `StepCoordinates`, `StepPayment`, `StepRecap`, `MiniCart`.
- `src/components/admin/`: `StatsRow`, `OrdersTable`, `OrderRow`, `OrderDetail`, `ActionModals`, `FilterBar`, `StatusBadge`.
- `src/pages/`: `Commander.tsx`, `Confirmation.tsx`, `NotFound.tsx`, `admin/Login.tsx`, `admin/Dashboard.tsx`.
- `src/hooks/`: `useAuth.ts`, `useOrders.ts`, `usePostalCode.ts`, `useToast.ts`.

## Order status state machine

`pending → paid_stripe → shipped` (Stripe path)
`invoiced → paid_invoice → shipped` (Facture path); `invoiced → overdue → recovery`.

## Phases (map to tasks #2–#7)

1. **#2 Scaffold** — tooling, move landing to `public/`, custom Tailwind, app.html, vercel.json. Verify `npm run build` emits `dist/index.html` (landing) + `dist/app.html`; landing intact on `/`.
2. **#3 lib + UI** — Supabase client (anon), types, 26 cantons, ~200 postal codes (from spec), creditor placeholders, reusable glass UI components + Toast system.
3. **#4 Tunnel** — navigable Stepper, sticky MiniCart (desktop sidebar / mobile banner), Step1 form + postal autofill + validation, Step2 payment choice cards, Step2.5 recap, insert order (anon) → Stripe redirect OR navigate `/confirmation`.
4. **#5 Confirmation** — animated check, copyable ref, Stripe vs Facture variants from `?method`.
5. **#6 Admin** — Login (signInWithPassword), layout + realtime new-order badge, stats row, "À traiter"/"Toutes" tabs, status-first table, direct actions (✓ pay / 📦 ship) + confirmation modals (incl. red recovery), secondary dropdown (QR-bill gen, download, escalate), slide-in detail panel (timeline + debounced notes), CSV export, swissqrbill PDF → Storage upload.
6. **#7 QA** — responsive 375/768/1440, e2e manual test, code-review skill, commit + push to GitHub main.

## Supabase (DONE — provisioned via MCP)

- `orders` table + `update_updated_at` + `generate_order_ref` triggers + indexes.
- RLS: anon INSERT + SELECT; authenticated ALL; service_role ALL.
- Private `invoices` storage bucket + authenticated-only policy (download via signed URL).
- Admin user `admin@swissarena.ch` (password reported separately).
- `orders` added to `supabase_realtime` publication.

## Security / scope notes

- Anon key only in client bundle (service_role never shipped). Admin gated by Auth + authenticated RLS.
- Stripe = static Payment Link `https://buy.stripe.com/bJefZjb5qbUf0YH8rO4Ni01` (manual reconciliation, no webhook — per scope).
- No auto emails, no CRIF, no pg_cron, single product. `creditor.ts` carries placeholders for client legal info.
