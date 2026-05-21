# Refonte système de statuts + dashboard admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the simplistic order-status model with a full processing pipeline (per payment method) and rebuild the admin dashboard around an action-first "À traiter" view, complete order-detail panel, and per-status confirmation modals.

**Architecture:** A single source of truth for the state machine lives in `src/lib/orders.ts` (status metadata, `nextAction()`, `applyAction()` patch builder, échéance + stats helpers). UI components (table, detail panel, modals, todo sections) are thin renderers driven by that module. Status transitions flow Dashboard → modal confirm → `applyAction()` → `useOrders().update()` → optimistic state + Supabase. "Automatic" transitions (Stripe `shipped→completed`, Facture `shipped→awaiting_payment`) are resolved at the moment the admin clicks "expédiée", not by any backend job (project has no cron — see memory).

**Tech Stack:** React 18 + Vite + TypeScript, Tailwind, Supabase JS (anon key + `authenticated`-role RLS), lucide-react icons, swissqrbill (CDN lazy-load) for invoice PDFs. Tests: **vitest** (added in Task 0) for pure logic; UI verified via `npm run build` + browser at 375px and desktop.

**Key decisions (confirmed with user):**
- Add vitest; TDD the pure logic in `src/lib/orders.ts`. UI = build + browser.
- Auto-transition at "expédiée" click: Facture → `awaiting_payment` directly; Stripe → `shipped` (then manual "Terminer"). `awaiting_payment` countdown uses `invoice_due_date` (= `invoiced_at` + 30j).

**Status vocabulary (new):**
`new | confirmed | invoiced | paid | configured | shipped | awaiting_payment | overdue | recovery | completed`

**Flows:**
- Stripe: `new → paid → configured → shipped → completed`
- Facture 30j: `new → confirmed → invoiced → configured → shipped(→awaiting_payment) → paid → completed`, with `awaiting_payment → overdue → recovery` as the dunning side-path.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| (Supabase migration) | Add columns + remap existing row | Apply via MCP |
| `src/lib/types.ts` | `OrderStatus` union, `Order`/`NewOrder`, label + badge maps | Modify |
| `src/lib/orders.ts` | State machine: `nextAction`, `applyAction`, predicates, échéance, stats | Rewrite |
| `src/lib/orders.test.ts` | Vitest unit tests for state machine | Create |
| `src/lib/format.ts` | Add `formatDateTimeFr`, `formatAddressOneLine` | Modify |
| `src/lib/clipboard.ts` | `copyText` helper | Create |
| `vitest.config.ts` | Vitest config | Create |
| `src/components/tunnel/types.ts` | Add `googleBusinessUrl` to `OrderForm` | Modify |
| `src/components/tunnel/validate.ts` | Validate Google Business URL | Modify |
| `src/components/tunnel/StepCoordinates.tsx` | New Google Business URL field | Modify |
| `src/pages/Commander.tsx` | Insert always `status:'new'` + `google_business_url` | Modify |
| `src/components/admin/PrimaryActionButton.tsx` | Renders the per-status primary action | Create |
| `src/components/admin/ActionModals.tsx` | All confirmation modals | Rewrite |
| `src/components/admin/RowActions.tsx` | "⋯" secondary menu | Rewrite |
| `src/components/admin/OrdersTable.tsx` | New columns + primary action + menu | Rewrite |
| `src/components/admin/TodoSections.tsx` | 6 prioritised sections | Create |
| `src/components/admin/OrderDetail.tsx` | Full tracking sheet | Rewrite |
| `src/components/admin/StatsRow.tsx` | New 4 metrics | Modify |
| `src/components/admin/FilterBar.tsx` | Dedupe status options | Modify |
| `src/pages/admin/Dashboard.tsx` | Wire todo sections + all transitions | Rewrite |
| `src/lib/csv.ts` | Add Google URL + relance columns | Modify |

`StatusBadge.tsx` and `Badge.tsx` need **no change** — they already render from `STATUS_LABELS`/`STATUS_BADGE` maps, so updating the maps in `types.ts` propagates automatically.

---

## Task 0: Project setup — branch + vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Create a feature branch**

```bash
git checkout -b feature/status-pipeline-refonte
git status
```
Expected: `On branch feature/status-pipeline-refonte`, clean.

- [ ] **Step 2: Install vitest**

```bash
npm install -D vitest@^2.1.0
```
Expected: vitest added to devDependencies, no peer-dep errors.

- [ ] **Step 3: Add the test script** to `package.json` `scripts` (after `"preview"`):

```json
    "preview": "vite preview",
    "test": "vitest run"
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 5: Verify the toolchain**

```bash
npm run build && npm test
```
Expected: `tsc` + `vite build` succeed; vitest reports "No test files found" (acceptable at this point — exits 0 only if a passing run; if it exits non-zero on "no tests", that's fine, the real tests arrive in Task 3).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for state-machine unit tests"
```

---

## Task 1: Database migration

**Files:**
- Apply via Supabase MCP (`apply_migration`), project ref `fqygbnqrlvzlzrumwhcl`.

Existing `orders` columns already include `invoice_pdf_url`, `invoice_due_date`, `invoice_paid_at`, `shipped_at`, `tracking_number`, `notes`. We only add the six new columns and remap the single existing test row to the new vocabulary.

- [ ] **Step 1: Apply the migration**

Use `mcp__supabase__apply_migration` with name `add_pipeline_columns` and this SQL:

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS google_business_url TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS relance_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_relance_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS configured_at TIMESTAMPTZ;

-- Remap the legacy status vocabulary on any existing rows.
UPDATE orders SET status = 'new'  WHERE status = 'pending';
UPDATE orders SET status = 'paid' WHERE status IN ('paid_stripe', 'paid_invoice');
-- 'invoiced', 'shipped', 'overdue', 'recovery' already match the new names.

-- New orders must default to 'new' going forward.
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'new';
```

- [ ] **Step 2: Verify columns + remap**

Use `mcp__supabase__execute_sql`:
```sql
SELECT id, status, google_business_url, relance_count FROM orders;
```
Expected: every row's `status` is one of the new values; `google_business_url` = `''`; `relance_count` = `0`.

- [ ] **Step 3: Commit** (no local file changes; record the migration intent)

```bash
git commit --allow-empty -m "feat(db): add pipeline columns (google_business_url, relances, stage timestamps)"
```

---

## Task 2: Types — new status vocabulary

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Replace the `OrderStatus` union and add new `Order` fields**

Replace lines 1–10 (the old union + `PaymentMethod`) with:

```ts
export type OrderStatus =
  | 'new'
  | 'confirmed'
  | 'invoiced'
  | 'paid'
  | 'configured'
  | 'shipped'
  | 'awaiting_payment'
  | 'overdue'
  | 'recovery'
  | 'completed'

export type PaymentMethod = 'stripe' | 'invoice_30d'
```

- [ ] **Step 2: Add the new columns to the `Order` interface**

In `interface Order`, add `google_business_url` near the address block and the new timestamp/counter fields near the invoice block:

```ts
  canton: string
  google_business_url: string

  product: string
```
and:
```ts
  invoice_pdf_url: string | null
  invoice_due_date: string | null
  invoice_paid_at: string | null

  relance_count: number
  last_relance_at: string | null
  confirmed_at: string | null
  invoiced_at: string | null
  configured_at: string | null

  shipped_at: string | null
```

- [ ] **Step 3: Update `NewOrder`** — funnel always inserts `status:'new'`, supplies `google_business_url`, and no longer sets `invoice_due_date` (set later at "Facture envoyée"). Replace the `NewOrder` interface body with:

```ts
export interface NewOrder {
  status: OrderStatus
  payment_method: PaymentMethod
  first_name: string
  last_name: string
  email: string
  phone: string
  company_name: string | null
  address: string
  postal_code: string
  city: string
  canton: string
  google_business_url: string
  amount_chf: number
}
```

- [ ] **Step 4: Replace `STATUS_LABELS` and `STATUS_BADGE`** (old maps) with:

```ts
export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Nouvelle',
  confirmed: 'Confirmée',
  invoiced: 'Facturée',
  paid: 'Payée',
  configured: 'Configurée',
  shipped: 'Expédiée',
  awaiting_payment: 'En attente paiement',
  overdue: 'En retard',
  recovery: 'Recouvrement',
  completed: 'Terminée',
}

export const STATUS_BADGE: Record<OrderStatus, string> = {
  new: 'bg-yellow-500/15 text-yellow-400',
  confirmed: 'bg-blue-500/15 text-blue-400',
  invoiced: 'bg-indigo-500/15 text-indigo-400',
  paid: 'bg-emerald-500/15 text-emerald-400',
  configured: 'bg-cyan-500/15 text-cyan-400',
  shipped: 'bg-violet-500/15 text-violet-400',
  awaiting_payment: 'bg-orange-500/15 text-orange-400',
  overdue: 'bg-red-500/15 text-red-400',
  recovery: 'bg-red-500/25 text-red-300',
  completed: 'bg-white/10 text-white/50',
}
```

Leave `PRODUCT_NAME`, `PRODUCT_PRICE`, `PRODUCT_PRICE_OLD`, `STRIPE_PAYMENT_LINK`, `PAYMENT_LABELS` unchanged.

- [ ] **Step 5: Verify it compiles in isolation is impossible yet** (orders.ts/csv.ts still reference old statuses). Defer build to Task 3. Commit after Task 3 builds green.

---

## Task 3: State machine logic + tests (TDD)

**Files:**
- Rewrite: `src/lib/orders.ts`
- Create: `src/lib/orders.test.ts`
- Modify: `src/lib/format.ts`

- [ ] **Step 1: Add `formatDateTimeFr` and `formatAddressOneLine` to `format.ts`**

Append to `src/lib/format.ts`:

```ts
/** "15 mai 2026 à 14:32" */
export function formatDateTimeFr(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()} à ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
```

Add (imports `Order` lazily via a structural param to avoid a cycle):

```ts
/** "Prénom Nom, Adresse, NPA Ville" — one-line copyable address. */
export function formatAddressOneLine(o: {
  first_name: string
  last_name: string
  address: string
  postal_code: string
  city: string
}): string {
  return `${o.first_name} ${o.last_name}, ${o.address}, ${o.postal_code} ${o.city}`
}
```

- [ ] **Step 2: Write the failing test file `src/lib/orders.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { nextAction, applyAction, needsAction, isPaid, statKpis } from './orders'
import type { Order } from './types'

function makeOrder(over: Partial<Order>): Order {
  return {
    id: 'id', order_ref: 'SA-2026-00001', status: 'new', payment_method: 'stripe',
    first_name: 'Jean', last_name: 'Dupont', email: 'j@d.ch', phone: '+41790000000',
    company_name: null, address: 'Rue 1', postal_code: '1000', city: 'Lausanne',
    canton: 'VD', google_business_url: 'https://g.page/x', product: 'plaque-nfc-v1',
    quantity: 1, amount_chf: 69, stripe_payment_link_used: true,
    invoice_pdf_url: null, invoice_due_date: null, invoice_paid_at: null,
    relance_count: 0, last_relance_at: null, confirmed_at: null, invoiced_at: null,
    configured_at: null, shipped_at: null, tracking_number: null, notes: null,
    created_at: '2026-05-21T12:00:00Z', updated_at: '2026-05-21T12:00:00Z',
    ...over,
  }
}

describe('nextAction', () => {
  it('new + stripe → pay', () => {
    expect(nextAction(makeOrder({ status: 'new', payment_method: 'stripe' }))?.type).toBe('pay')
  })
  it('new + invoice → confirm', () => {
    expect(nextAction(makeOrder({ status: 'new', payment_method: 'invoice_30d' }))?.type).toBe('confirm')
  })
  it('confirmed without PDF → generate_invoice', () => {
    expect(nextAction(makeOrder({ status: 'confirmed', payment_method: 'invoice_30d' }))?.type).toBe('generate_invoice')
  })
  it('confirmed with PDF → mark_invoiced', () => {
    expect(nextAction(makeOrder({ status: 'confirmed', payment_method: 'invoice_30d', invoice_pdf_url: 'x.pdf' }))?.type).toBe('mark_invoiced')
  })
  it('invoiced → configure', () => {
    expect(nextAction(makeOrder({ status: 'invoiced', payment_method: 'invoice_30d' }))?.type).toBe('configure')
  })
  it('paid + not shipped (stripe) → configure', () => {
    expect(nextAction(makeOrder({ status: 'paid', payment_method: 'stripe' }))?.type).toBe('configure')
  })
  it('paid + shipped (invoice) → complete', () => {
    expect(nextAction(makeOrder({ status: 'paid', payment_method: 'invoice_30d', shipped_at: '2026-05-22T00:00:00Z' }))?.type).toBe('complete')
  })
  it('configured → ship', () => {
    expect(nextAction(makeOrder({ status: 'configured' }))?.type).toBe('ship')
  })
  it('shipped (stripe) → complete', () => {
    expect(nextAction(makeOrder({ status: 'shipped', payment_method: 'stripe' }))?.type).toBe('complete')
  })
  it('awaiting_payment → pay', () => {
    expect(nextAction(makeOrder({ status: 'awaiting_payment', payment_method: 'invoice_30d' }))?.type).toBe('pay')
  })
  it('overdue → relance', () => {
    expect(nextAction(makeOrder({ status: 'overdue', payment_method: 'invoice_30d' }))?.type).toBe('relance')
  })
  it('completed → null', () => {
    expect(nextAction(makeOrder({ status: 'completed' }))).toBeNull()
  })
  it('recovery → null', () => {
    expect(nextAction(makeOrder({ status: 'recovery' }))).toBeNull()
  })
})

describe('applyAction', () => {
  const now = '2026-05-21T12:00:00.000Z'
  it('confirm sets confirmed_at + status', () => {
    expect(applyAction('confirm', makeOrder({}), { now })).toEqual({ status: 'confirmed', confirmed_at: now })
  })
  it('mark_invoiced sets invoiced_at + due date +30d', () => {
    const p = applyAction('mark_invoiced', makeOrder({}), { now })
    expect(p.status).toBe('invoiced')
    expect(p.invoiced_at).toBe(now)
    expect(new Date(p.invoice_due_date as string).getTime()).toBe(new Date(now).getTime() + 30 * 86400000)
  })
  it('pay sets invoice_paid_at + status paid', () => {
    expect(applyAction('pay', makeOrder({ status: 'awaiting_payment' }), { now })).toEqual({ status: 'paid', invoice_paid_at: now })
  })
  it('configure sets configured_at', () => {
    expect(applyAction('configure', makeOrder({}), { now })).toEqual({ status: 'configured', configured_at: now })
  })
  it('ship on invoice → awaiting_payment + shipped_at + tracking', () => {
    expect(applyAction('ship', makeOrder({ payment_method: 'invoice_30d' }), { now, tracking: 'T1' }))
      .toEqual({ status: 'awaiting_payment', shipped_at: now, tracking_number: 'T1' })
  })
  it('ship on stripe → shipped + shipped_at, null tracking when empty', () => {
    expect(applyAction('ship', makeOrder({ payment_method: 'stripe' }), { now, tracking: '' }))
      .toEqual({ status: 'shipped', shipped_at: now, tracking_number: null })
  })
  it('complete sets status only', () => {
    expect(applyAction('complete', makeOrder({ status: 'shipped' }), { now })).toEqual({ status: 'completed' })
  })
  it('relance increments count + sets last_relance_at, no status change', () => {
    expect(applyAction('relance', makeOrder({ relance_count: 1 }), { now })).toEqual({ relance_count: 2, last_relance_at: now })
  })
  it('escalate → recovery', () => {
    expect(applyAction('escalate', makeOrder({ status: 'overdue' }), { now })).toEqual({ status: 'recovery' })
  })
})

describe('predicates + stats', () => {
  it('needsAction is false for completed/recovery', () => {
    expect(needsAction(makeOrder({ status: 'completed' }))).toBe(false)
    expect(needsAction(makeOrder({ status: 'recovery' }))).toBe(false)
    expect(needsAction(makeOrder({ status: 'new' }))).toBe(true)
  })
  it('isPaid covers paid + completed', () => {
    expect(isPaid(makeOrder({ status: 'paid' }))).toBe(true)
    expect(isPaid(makeOrder({ status: 'completed' }))).toBe(true)
    expect(isPaid(makeOrder({ status: 'awaiting_payment' }))).toBe(false)
  })
  it('statKpis sums CA from paid+completed this month and unpaid from awaiting+overdue', () => {
    const ref = new Date('2026-05-21T12:00:00Z')
    const orders = [
      makeOrder({ status: 'completed', amount_chf: 69, created_at: '2026-05-02T00:00:00Z' }),
      makeOrder({ status: 'paid', amount_chf: 69, created_at: '2026-05-10T00:00:00Z' }),
      makeOrder({ status: 'awaiting_payment', amount_chf: 69, created_at: '2026-05-11T00:00:00Z' }),
      makeOrder({ status: 'overdue', amount_chf: 69, created_at: '2026-04-01T00:00:00Z' }),
      makeOrder({ status: 'new', amount_chf: 69, created_at: '2026-05-12T00:00:00Z' }),
    ]
    const k = statKpis(orders, ref)
    expect(k.ca).toBe(138)
    expect(k.monthCount).toBe(4)
    expect(k.todo).toBe(3) // new + awaiting_payment + overdue (paid/completed excluded? paid still needs action)
    expect(k.unpaid).toBe(138)
  })
})
```

> NOTE on the `todo` count: `needsAction` = status NOT in (`completed`, `recovery`). In the fixture the non-terminal statuses are: `paid` (needs config/complete), `awaiting_payment`, `new` → plus `overdue` = 4. Adjust the assertion to `expect(k.todo).toBe(4)` to match `needsAction`. (Set it to 4 when writing the test — the line above is the corrected value.)

- [ ] **Step 3: Run the test to confirm it fails**

```bash
npm test
```
Expected: FAIL — `nextAction`/`applyAction`/`statKpis` not exported yet.

- [ ] **Step 4: Rewrite `src/lib/orders.ts`**

```ts
import type { Order, OrderStatus } from './types'
import { daysUntil } from './format'

// ─── Predicates ──────────────────────────────────────────────────────────────
const TERMINAL: OrderStatus[] = ['completed', 'recovery']
export const isPaid = (o: Order) => o.status === 'paid' || o.status === 'completed'
export const needsAction = (o: Order) => !TERMINAL.includes(o.status)
export const canGenerateInvoice = (o: Order) =>
  o.payment_method === 'invoice_30d' && o.status !== 'new'
export const canEscalate = (o: Order) =>
  o.status === 'awaiting_payment' || o.status === 'overdue'

// ─── Action descriptors ──────────────────────────────────────────────────────
export type AdminActionType =
  | 'confirm'
  | 'generate_invoice'
  | 'mark_invoiced'
  | 'pay'
  | 'configure'
  | 'ship'
  | 'complete'
  | 'relance'
  | 'escalate'

export interface ActionDescriptor {
  type: AdminActionType
  label: string
  /** Tailwind classes for the pill-style primary button. */
  className: string
}

const STYLE: Record<string, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/25',
  blue: 'bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 border border-blue-500/25',
  indigo: 'bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 border border-indigo-500/25',
  cyan: 'bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/25',
  violet: 'bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 border border-violet-500/25',
  gray: 'bg-white/10 text-white/60 hover:bg-white/15 border border-white/15',
  red: 'bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/25',
}

/** The single primary "next action" for an order, or null when terminal. */
export function nextAction(o: Order): ActionDescriptor | null {
  switch (o.status) {
    case 'new':
      return o.payment_method === 'stripe'
        ? { type: 'pay', label: '✓ Payée', className: STYLE.emerald }
        : { type: 'confirm', label: '✉️ Confirmée', className: STYLE.blue }
    case 'confirmed':
      return o.invoice_pdf_url
        ? { type: 'mark_invoiced', label: '📤 Envoyée', className: STYLE.indigo }
        : { type: 'generate_invoice', label: '📄 Facture', className: STYLE.indigo }
    case 'invoiced':
      return { type: 'configure', label: '⚙️ Config', className: STYLE.cyan }
    case 'paid':
      return o.shipped_at
        ? { type: 'complete', label: '✅ Terminer', className: STYLE.gray }
        : { type: 'configure', label: '⚙️ Config', className: STYLE.cyan }
    case 'configured':
      return { type: 'ship', label: '📦 Expédier', className: STYLE.violet }
    case 'shipped':
      return { type: 'complete', label: '✅ Terminer', className: STYLE.gray }
    case 'awaiting_payment':
      return { type: 'pay', label: '✓ Payée', className: STYLE.emerald }
    case 'overdue':
      return { type: 'relance', label: 'Relancer', className: STYLE.red }
    default:
      return null
  }
}

// ─── Transition patch builder ────────────────────────────────────────────────
const DAY = 86400000

interface ApplyCtx {
  now?: string
  tracking?: string
}

/** Returns the Supabase patch for an action. Pure — caller persists it. */
export function applyAction(
  type: AdminActionType,
  order: Order,
  ctx: ApplyCtx = {},
): Partial<Order> {
  const now = ctx.now ?? new Date().toISOString()
  switch (type) {
    case 'confirm':
      return { status: 'confirmed', confirmed_at: now }
    case 'mark_invoiced':
      return {
        status: 'invoiced',
        invoiced_at: now,
        invoice_due_date: new Date(new Date(now).getTime() + 30 * DAY).toISOString(),
      }
    case 'pay':
      return { status: 'paid', invoice_paid_at: now }
    case 'configure':
      return { status: 'configured', configured_at: now }
    case 'ship':
      return {
        status: order.payment_method === 'invoice_30d' ? 'awaiting_payment' : 'shipped',
        shipped_at: now,
        tracking_number: ctx.tracking?.trim() || null,
      }
    case 'complete':
      return { status: 'completed' }
    case 'relance':
      return { relance_count: order.relance_count + 1, last_relance_at: now }
    case 'escalate':
      return { status: 'recovery' }
    case 'generate_invoice':
      return {} // handled out-of-band (PDF generation), no status change here
  }
}

// ─── Échéance display ────────────────────────────────────────────────────────
export interface EcheanceInfo {
  label: string
  className: string
  pulse?: boolean
}

const HAS_DUE: OrderStatus[] = ['invoiced', 'configured', 'shipped', 'awaiting_payment', 'overdue']

export function echeanceInfo(order: Order): EcheanceInfo {
  if (order.payment_method === 'stripe') return { label: '—', className: 'text-white/30' }
  if (order.status === 'paid' || order.status === 'completed')
    return { label: 'Réglé ✓', className: 'text-emerald-400/60' }
  if (!HAS_DUE.includes(order.status)) return { label: '—', className: 'text-white/30' }

  const d = daysUntil(order.invoice_due_date)
  if (d === null) return { label: '—', className: 'text-white/30' }
  if (d < 0) return { label: 'ÉCHU', className: 'text-red-400 bg-red-500/10 rounded-full px-2 py-0.5', pulse: true }
  if (d <= 2) return { label: `J-${d}`, className: 'text-red-400 font-medium', pulse: true }
  if (d <= 7) return { label: `J-${d}`, className: 'text-orange-400 font-medium' }
  if (d <= 15) return { label: `J-${d}`, className: 'text-orange-300/80' }
  return { label: `J-${d}`, className: 'text-emerald-400/70' }
}

// ─── Stats ───────────────────────────────────────────────────────────────────
export function isSameMonth(iso: string, ref: Date): boolean {
  const d = new Date(iso)
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
}

export interface StatKpis {
  ca: number
  monthCount: number
  todo: number
  unpaid: number
}

export function statKpis(orders: Order[], ref: Date): StatKpis {
  const ca = orders
    .filter((o) => isPaid(o) && isSameMonth(o.created_at, ref))
    .reduce((s, o) => s + Number(o.amount_chf), 0)
  const monthCount = orders.filter((o) => isSameMonth(o.created_at, ref)).length
  const todo = orders.filter(needsAction).length
  const unpaid = orders
    .filter((o) => o.status === 'awaiting_payment' || o.status === 'overdue')
    .reduce((s, o) => s + Number(o.amount_chf), 0)
  return { ca, monthCount, todo, unpaid }
}
```

- [ ] **Step 5: Fix the test's `todo` assertion to 4** (per the NOTE in Step 2) and run tests

```bash
npm test
```
Expected: PASS — all describe blocks green.

- [ ] **Step 6: Full build**

```bash
npm run build
```
Expected: may still FAIL in UI files referencing removed helpers (`canMarkPaid`, `canMarkShipped`, old statuses). That's fine — those are fixed in later tasks. If build fails ONLY in `src/components/admin/*` and `src/pages/*`, proceed. If it fails in `src/lib/*`, fix before committing.

- [ ] **Step 7: Commit logic + tests**

```bash
git add src/lib/orders.ts src/lib/orders.test.ts src/lib/format.ts src/lib/types.ts
git commit -m "feat(orders): new status machine, action descriptors, échéance + stats helpers"
```

---

## Task 4: Order funnel — Google Business URL + always-`new` insert

**Files:**
- Modify: `src/components/tunnel/types.ts`
- Modify: `src/components/tunnel/validate.ts`
- Modify: `src/components/tunnel/StepCoordinates.tsx`
- Modify: `src/pages/Commander.tsx`

- [ ] **Step 1: Add `googleBusinessUrl` to the form types** — in `src/components/tunnel/types.ts`, add the field to `OrderForm` (after `companyName`) and to `EMPTY_FORM`:

```ts
  companyName: string
  googleBusinessUrl: string
  address: string
```
```ts
  companyName: '',
  googleBusinessUrl: '',
  address: '',
```

- [ ] **Step 2: Validate the URL** — in `src/components/tunnel/validate.ts`, add after the address check:

```ts
  if (!form.googleBusinessUrl.trim()) e.googleBusinessUrl = 'Lien Google requis'
  else if (!/^https?:\/\//i.test(form.googleBusinessUrl.trim()))
    e.googleBusinessUrl = 'Le lien doit commencer par http:// ou https://'
```

- [ ] **Step 3: Add the field to `StepCoordinates.tsx`** — insert this block between the "Entreprise" block (ends line ~101) and the "Adresse" block:

```tsx
        <div className="mb-4">
          <Input
            label="Lien de votre fiche Google"
            name="googleBusinessUrl"
            type="url"
            inputMode="url"
            placeholder="https://g.page/votre-etablissement ou recherchez votre établissement sur Google Maps"
            value={form.googleBusinessUrl}
            error={errors.googleBusinessUrl}
            onChange={(e) => onChange('googleBusinessUrl', e.target.value)}
          />
          <span className="mt-1.5 block text-[12px] text-white/35 font-light">
            Trouvez votre fiche en cherchant votre établissement sur Google Maps, puis copiez le lien de partage
          </span>
        </div>
```

> The `Input` `label` prop has no asterisk convention in this codebase (required fields just omit "(optionnel)"). Leaving it without `optional` already marks it required visually. The `*` requirement from the brief is satisfied by it being a required field with validation; no literal asterisk needed (matches existing required fields like Email/Adresse).

- [ ] **Step 4: Update the insert in `Commander.tsx`** — replace the `handleConfirm` payload/insert block (lines ~49–93). Remove `addDays` import usage for due date. New body:

```tsx
  async function handleConfirm() {
    if (!payment) return
    setSubmitting(true)

    const isInvoice = payment === 'invoice_30d'
    const payload: NewOrder = {
      status: 'new',
      payment_method: payment,
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      company_name: form.companyName.trim() || null,
      address: form.address.trim(),
      postal_code: form.postalCode.trim(),
      city: form.city.trim(),
      canton: form.canton,
      google_business_url: form.googleBusinessUrl.trim(),
      amount_chf: PRODUCT_PRICE,
    }

    const insertData = isInvoice ? payload : { ...payload, stripe_payment_link_used: true }

    const { data, error } = await supabase
      .from('orders')
      .insert(insertData)
      .select('order_ref')
      .single()

    if (error || !data) {
      setSubmitting(false)
      toast('Une erreur est survenue. Réessayez.')
      return
    }

    const ref = data.order_ref as string

    if (isInvoice) {
      navigate(`/confirmation?ref=${encodeURIComponent(ref)}&method=invoice`)
    } else {
      const url = new URL(STRIPE_PAYMENT_LINK)
      url.searchParams.set('client_reference_id', ref)
      url.searchParams.set('prefilled_email', form.email.trim())
      window.location.href = url.toString()
    }
  }
```

- [ ] **Step 5: Remove the now-unused `addDays` import** from `Commander.tsx` line 14 (`import { addDays } from '../lib/format'`). Delete the line.

- [ ] **Step 6: Build**

```bash
npm run build
```
Expected: tunnel files compile. Admin files may still error — OK until Tasks 5–9.

- [ ] **Step 7: Commit**

```bash
git add src/components/tunnel/types.ts src/components/tunnel/validate.ts src/components/tunnel/StepCoordinates.tsx src/pages/Commander.tsx
git commit -m "feat(funnel): require Google Business URL, always insert orders as 'new'"
```

---

## Task 5: Clipboard helper + FilterBar dedupe

**Files:**
- Create: `src/lib/clipboard.ts`
- Modify: `src/components/admin/FilterBar.tsx`

- [ ] **Step 1: Create `src/lib/clipboard.ts`**

```ts
/** Copy text to clipboard; resolves true on success. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
```

- [ ] **Step 2: FilterBar status options** — the old dedupe comment referenced the duplicate "Payé" labels which no longer exist. Replace `STATUS_OPTIONS` (lines 8–13) with:

```ts
const STATUS_OPTIONS = [
  { value: 'all', label: 'Tous les statuts' },
  ...(Object.keys(STATUS_LABELS) as OrderStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] })),
]
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/clipboard.ts src/components/admin/FilterBar.tsx
git commit -m "feat(admin): clipboard helper, refresh status filter options"
```

---

## Task 6: PrimaryActionButton + ActionModals

**Files:**
- Create: `src/components/admin/PrimaryActionButton.tsx`
- Rewrite: `src/components/admin/ActionModals.tsx`

- [ ] **Step 1: Create `PrimaryActionButton.tsx`** — a compact pill used in the table row + detail panel.

```tsx
import { nextAction } from '../../lib/orders'
import type { Order } from '../../lib/types'

interface Props {
  order: Order
  busy?: boolean
  size?: 'sm' | 'lg'
  onAction: (order: Order, type: NonNullable<ReturnType<typeof nextAction>>['type']) => void
}

export default function PrimaryActionButton({ order, busy, size = 'sm', onAction }: Props) {
  const action = nextAction(order)
  if (!action) return <span className="text-[14px] text-white/40">✅</span>
  const pad = size === 'lg' ? 'py-3 px-5 text-[15px] w-full justify-center' : 'py-1.5 px-3 text-[12px]'
  return (
    <button
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation()
        onAction(order, action.type)
      }}
      className={`inline-flex items-center gap-1.5 rounded-full font-light transition-colors disabled:opacity-50 ${pad} ${action.className}`}
    >
      {action.label}
    </button>
  )
}
```

- [ ] **Step 2: Rewrite `ActionModals.tsx`** — one modal per status-changing action. `generate_invoice` is NOT a modal (handled directly). The `AdminAction` discriminated union carries the order; the modal type is derived from the action type.

```tsx
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
```

- [ ] **Step 3: Build** (PrimaryActionButton + ActionModals should compile; Dashboard/Table still pending)

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/PrimaryActionButton.tsx src/components/admin/ActionModals.tsx
git commit -m "feat(admin): primary-action button + per-status confirmation modals"
```

---

## Task 7: RowActions secondary menu

**Files:**
- Rewrite: `src/components/admin/RowActions.tsx`

The "⋯" menu offers: Voir détail, Copier email, Copier adresse, Télécharger facture (if exists), Changer statut (dropdown), Escalader (if awaiting_payment/overdue).

- [ ] **Step 1: Rewrite `RowActions.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal, Eye, Mail, MapPin, Download, AlertTriangle, RefreshCw } from 'lucide-react'
import { canEscalate } from '../../lib/orders'
import { copyText } from '../../lib/clipboard'
import { formatAddressOneLine } from '../../lib/format'
import { STATUS_LABELS, type Order, type OrderStatus } from '../../lib/types'
import { useToast } from '../ui/Toast'

interface Props {
  order: Order
  onOpenDetail: (order: Order) => void
  onDownloadInvoice: (order: Order) => void
  onEscalate: (order: Order) => void
  onChangeStatus: (order: Order, status: OrderStatus) => void
}

export default function RowActions({ order, onOpenDetail, onDownloadInvoice, onEscalate, onChangeStatus }: Props) {
  const [open, setOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setStatusOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  function close() { setOpen(false); setStatusOpen(false) }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        className="h-8 w-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/60 transition-colors"
        aria-label="Plus d'actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-10 z-30 w-60 rounded-2xl p-1.5 animate-modal-in"
          style={{
            background: 'linear-gradient(180deg, rgba(20,22,30,0.98), rgba(12,14,20,0.98))',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 20px 60px rgba(0,5,20,0.6)',
            backdropFilter: 'blur(20px)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <MenuItem icon={<Eye className="h-3.5 w-3.5" />} label="Voir détail" onClick={() => { close(); onOpenDetail(order) }} />
          <MenuItem icon={<Mail className="h-3.5 w-3.5" />} label="Copier email"
            onClick={async () => { close(); if (await copyText(order.email)) toast('Email copié ✓') }} />
          <MenuItem icon={<MapPin className="h-3.5 w-3.5" />} label="Copier adresse"
            onClick={async () => { close(); if (await copyText(formatAddressOneLine(order))) toast('Adresse copiée ✓') }} />
          {order.invoice_pdf_url && (
            <MenuItem icon={<Download className="h-3.5 w-3.5" />} label="Télécharger facture"
              onClick={() => { close(); onDownloadInvoice(order) }} />
          )}
          <MenuItem icon={<RefreshCw className="h-3.5 w-3.5" />} label="Changer statut"
            onClick={() => setStatusOpen((s) => !s)} />
          {statusOpen && (
            <div className="ml-2 my-1 max-h-56 overflow-y-auto border-l border-white/10 pl-1">
              {(Object.keys(STATUS_LABELS) as OrderStatus[]).map((s) => (
                <button key={s}
                  onClick={() => { close(); onChangeStatus(order, s) }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[12px] font-light transition-colors hover:bg-white/[0.06] ${s === order.status ? 'text-white' : 'text-white/60'}`}>
                  {STATUS_LABELS[s]}{s === order.status ? ' ·' : ''}
                </button>
              ))}
            </div>
          )}
          {canEscalate(order) && (
            <MenuItem icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Escalader recouvrement"
              danger onClick={() => { close(); onEscalate(order) }} />
          )}
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-light transition-colors text-left hover:bg-white/[0.06] ${danger ? 'text-red-300/80' : 'text-white/75'}`}>
      <span className={danger ? 'text-red-300/70' : 'text-white/50'}>{icon}</span>
      {label}
    </button>
  )
}
```

- [ ] **Step 2: Commit** (build deferred to Task 8/9 wiring)

```bash
git add src/components/admin/RowActions.tsx
git commit -m "feat(admin): secondary actions menu with manual status override"
```

---

## Task 8: OrdersTable rewrite

**Files:**
- Rewrite: `src/components/admin/OrdersTable.tsx`

New columns: Étape · Réf · Client · Méthode · Montant · Échéance · Date · Actions. Primary action button + "⋯" menu per row. Keep desktop table + mobile cards.

- [ ] **Step 1: Rewrite `OrdersTable.tsx`**

```tsx
import StatusBadge from './StatusBadge'
import RowActions from './RowActions'
import PrimaryActionButton from './PrimaryActionButton'
import Badge from '../ui/Badge'
import { echeanceInfo } from '../../lib/orders'
import { formatCHF, formatDateFr } from '../../lib/format'
import type { AdminActionType } from '../../lib/orders'
import type { Order, OrderStatus } from '../../lib/types'
import { useToast } from '../ui/Toast'

export interface TableHandlers {
  highlightId?: string | null
  busyId?: string | null
  onRowClick: (order: Order) => void
  onAction: (order: Order, type: AdminActionType) => void
  onDownloadInvoice: (order: Order) => void
  onEscalate: (order: Order) => void
  onChangeStatus: (order: Order, status: OrderStatus) => void
}

interface Props extends TableHandlers {
  orders: Order[]
}

function MethodPill({ order }: { order: Order }) {
  return order.payment_method === 'stripe' ? (
    <Badge className="bg-blue-500/10 text-blue-300">Stripe</Badge>
  ) : (
    <Badge className="bg-violet-500/10 text-violet-300">Facture</Badge>
  )
}

function Cluster({ order, h }: { order: Order; h: TableHandlers }) {
  return (
    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
      <PrimaryActionButton order={order} busy={h.busyId === order.id} onAction={h.onAction} />
      <RowActions
        order={order}
        onOpenDetail={h.onRowClick}
        onDownloadInvoice={h.onDownloadInvoice}
        onEscalate={h.onEscalate}
        onChangeStatus={h.onChangeStatus}
      />
    </div>
  )
}

export default function OrdersTable(props: Props) {
  const { orders, highlightId, onRowClick } = props
  const { toast } = useToast()

  function copyRef(e: React.MouseEvent, ref: string) {
    e.stopPropagation()
    navigator.clipboard.writeText(ref).then(() => toast('Référence copiée'))
  }

  if (orders.length === 0) {
    return <div className="text-center py-16 text-white/40 font-light">Aucune commande.</div>
  }

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-[10px] tracking-[0.2em] uppercase text-white/35">
              <th className="font-light pb-3 px-3">Étape</th>
              <th className="font-light pb-3 px-3">Réf</th>
              <th className="font-light pb-3 px-3">Client</th>
              <th className="font-light pb-3 px-3">Méthode</th>
              <th className="font-light pb-3 px-3">Montant</th>
              <th className="font-light pb-3 px-3">Échéance</th>
              <th className="font-light pb-3 px-3">Date</th>
              <th className="font-light pb-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const ech = echeanceInfo(o)
              return (
                <tr key={o.id} onClick={() => onRowClick(o)}
                  className={`border-t border-white/[0.06] hover:bg-white/[0.025] cursor-pointer transition-colors ${highlightId === o.id ? 'bg-glacier-50' : ''}`}>
                  <td className="py-4 px-3"><StatusBadge status={o.status} /></td>
                  <td className="py-4 px-3">
                    <button onClick={(e) => copyRef(e, o.order_ref)}
                      className="font-mono text-[13px] text-white/70 hover:text-white transition-colors">{o.order_ref}</button>
                  </td>
                  <td className="py-4 px-3">
                    <div className="text-[14px] text-white/85">{o.first_name} {o.last_name}</div>
                    <div className="text-[12px] text-white/40">{o.email}</div>
                  </td>
                  <td className="py-4 px-3"><MethodPill order={o} /></td>
                  <td className="py-4 px-3 text-[14px] font-medium text-white/90">{formatCHF(o.amount_chf)} CHF</td>
                  <td className="py-4 px-3">
                    <span className={`text-[13px] ${ech.className} ${ech.pulse ? 'animate-soft-pulse' : ''}`}>{ech.label}</span>
                  </td>
                  <td className="py-4 px-3 text-[13px] text-white/50">{formatDateFr(o.created_at)}</td>
                  <td className="py-4 px-3"><Cluster order={o} h={props} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-3">
        {orders.map((o) => {
          const ech = echeanceInfo(o)
          return (
            <div key={o.id} onClick={() => onRowClick(o)}
              className={`card-glass rounded-card p-4 cursor-pointer ${highlightId === o.id ? 'card-selected' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <StatusBadge status={o.status} />
                <button onClick={(e) => copyRef(e, o.order_ref)} className="font-mono text-[12px] text-white/60">{o.order_ref}</button>
              </div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[14px] text-white/85">{o.first_name} {o.last_name}</div>
                  <div className="text-[12px] text-white/40">{o.email}</div>
                </div>
                <div className="text-[15px] font-medium text-white/90">{formatCHF(o.amount_chf)} CHF</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MethodPill order={o} />
                  <span className={`text-[12px] ${ech.className}`}>{ech.label}</span>
                </div>
                <Cluster order={o} h={props} />
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Commit** (build green after Dashboard rewire in Task 11)

```bash
git add src/components/admin/OrdersTable.tsx
git commit -m "feat(admin): rebuild orders table with stage column + primary action"
```

---

## Task 9: TodoSections — 6 prioritised sections

**Files:**
- Create: `src/components/admin/TodoSections.tsx`

Sections in order: En retard (overdue), Nouvelles (new), Factures à générer (confirmed), À configurer (invoiced OR paid&!shipped), À expédier (configured), En attente paiement (awaiting_payment). Each renders mini-cards. Empty sections hidden. Reuses the same handler bag as the table.

- [ ] **Step 1: Create `TodoSections.tsx`**

```tsx
import { useMemo } from 'react'
import { AlertTriangle, Inbox, FileText, Settings, Package, Clock, ExternalLink } from 'lucide-react'
import GlassCard from '../ui/GlassCard'
import StatusBadge from './StatusBadge'
import PrimaryActionButton from './PrimaryActionButton'
import Badge from '../ui/Badge'
import { echeanceInfo } from '../../lib/orders'
import { copyText } from '../../lib/clipboard'
import { formatDateFr, formatAddressOneLine } from '../../lib/format'
import type { TableHandlers } from './OrdersTable'
import type { Order } from '../../lib/types'
import { useToast } from '../ui/Toast'

interface Props extends TableHandlers {
  orders: Order[]
}

interface Group {
  key: string
  icon: React.ReactNode
  title: string
  tint?: string
  orders: Order[]
  /** Optional per-card extra content (address, google link, countdown…). */
  extra?: (o: Order) => React.ReactNode
}

export default function TodoSections(props: Props) {
  const { orders } = props
  const { toast } = useToast()

  const groups = useMemo<Group[]>(() => {
    const by = (f: (o: Order) => boolean) =>
      orders.filter(f).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))

    const googleLink = (o: Order) => (
      <div className="flex items-center gap-2 mt-1">
        <a href={o.google_business_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-[12px] text-blue-300 underline underline-offset-2 break-all">
          <ExternalLink className="h-3 w-3 shrink-0" />{o.google_business_url || '—'}
        </a>
        <CopyBtn text={o.google_business_url} label="Lien copié ✓" toast={toast} />
      </div>
    )
    const address = (o: Order) => (
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[12px] text-white/55">{formatAddressOneLine(o)}</span>
        <CopyBtn text={formatAddressOneLine(o)} label="Adresse copiée ✓" toast={toast} />
      </div>
    )
    const countdown = (o: Order) => {
      const ech = echeanceInfo(o)
      return (
        <div className="flex items-center gap-3 mt-1">
          <span className={`text-[12px] ${ech.className} ${ech.pulse ? 'animate-soft-pulse' : ''}`}>{ech.label}</span>
          {o.relance_count > 0 && (
            <span className="text-[11px] text-white/45">Relancé {o.relance_count} fois</span>
          )}
        </div>
      )
    }
    const overdueExtra = (o: Order) => (
      <div className="flex items-center gap-3 mt-1 text-[12px]">
        <span className="text-red-400">{lateLabel(o)}</span>
        <span className="text-white/45">Relancé {o.relance_count} fois</span>
        {o.last_relance_at && <span className="text-white/35">dernière : {formatDateFr(o.last_relance_at)}</span>}
      </div>
    )

    return [
      { key: 'overdue', icon: <AlertTriangle className="h-4 w-4 text-red-400" />, title: 'En retard', tint: 'bg-red-500/[0.03]', orders: by((o) => o.status === 'overdue'), extra: overdueExtra },
      { key: 'new', icon: <Inbox className="h-4 w-4 text-yellow-400" />, title: 'Nouvelles commandes', orders: by((o) => o.status === 'new') },
      { key: 'confirmed', icon: <FileText className="h-4 w-4 text-indigo-400" />, title: 'Factures à générer', orders: by((o) => o.status === 'confirmed') },
      { key: 'configure', icon: <Settings className="h-4 w-4 text-cyan-400" />, title: 'À configurer', orders: by((o) => o.status === 'invoiced' || (o.status === 'paid' && !o.shipped_at)), extra: googleLink },
      { key: 'ship', icon: <Package className="h-4 w-4 text-violet-400" />, title: 'À expédier', orders: by((o) => o.status === 'configured'), extra: address },
      { key: 'await', icon: <Clock className="h-4 w-4 text-orange-400" />, title: 'En attente de paiement', orders: by((o) => o.status === 'awaiting_payment'), extra: countdown },
    ].filter((g) => g.orders.length > 0)
  }, [orders, toast])

  if (groups.length === 0) {
    return (
      <GlassCard className="p-12 text-center">
        <div className="text-[18px] font-extralight text-white/80">Tout est à jour ✓</div>
        <div className="text-[13px] text-white/40 mt-1">Aucune action requise</div>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.key}>
          <div className="flex items-center gap-2 mb-3">
            {g.icon}
            <h2 className="text-[15px] font-light text-white/85">{g.title}</h2>
            <span className="text-[11px] text-white/45 bg-white/[0.06] rounded-full px-2 py-0.5">{g.orders.length}</span>
          </div>
          <div className={`rounded-card ${g.tint ?? ''} space-y-2`}>
            {g.orders.map((o) => (
              <MiniCard key={o.id} order={o} h={props} extra={g.extra} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function MiniCard({ order, h, extra }: { order: Order; h: TableHandlers; extra?: (o: Order) => React.ReactNode }) {
  const { toast } = useToast()
  return (
    <div onClick={() => h.onRowClick(order)}
      className="card-glass rounded-card p-4 cursor-pointer flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(order.order_ref).then(() => toast('Référence copiée')) }}
            className="font-mono text-[12px] text-white/60 hover:text-white">{order.order_ref}</button>
          <Badge className={order.payment_method === 'stripe' ? 'bg-blue-500/10 text-blue-300' : 'bg-violet-500/10 text-violet-300'}>
            {order.payment_method === 'stripe' ? 'Stripe' : 'Facture'}
          </Badge>
          <StatusBadge status={order.status} />
        </div>
        <div className="text-[14px] text-white/85 mt-1">{order.first_name} {order.last_name}</div>
        <div className="text-[12px] text-white/40">{formatDateFr(order.created_at)}</div>
        {extra?.(order)}
      </div>
      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
        <PrimaryActionButton order={order} busy={h.busyId === order.id} onAction={h.onAction} />
      </div>
    </div>
  )
}

function CopyBtn({ text, label, toast }: { text: string; label: string; toast: (m: string) => void }) {
  return (
    <button onClick={async (e) => { e.stopPropagation(); if (await copyText(text)) toast(label) }}
      className="text-[11px] text-white/40 hover:text-white/80 underline underline-offset-2">copier</button>
  )
}

/** "J+5 de retard" from invoice_due_date. */
function lateLabel(o: Order): string {
  if (!o.invoice_due_date) return 'En retard'
  const days = Math.floor((Date.now() - new Date(o.invoice_due_date).getTime()) / 86400000)
  return days > 0 ? `J+${days} de retard` : 'Échéance dépassée'
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/TodoSections.tsx
git commit -m "feat(admin): 6 prioritised todo sections with contextual actions"
```

---

## Task 10: OrderDetail rewrite

**Files:**
- Rewrite: `src/components/admin/OrderDetail.tsx`

Full tracking sheet: Client (copy email/phone/address), Fiche Google (link + copy), Commande, Facture (invoice only: dates, countdown, PDF download, relances), Timeline (full chronology with future events dashed), Notes (debounced autosave), Actions (primary + secondary).

- [ ] **Step 1: Rewrite `OrderDetail.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { X, Copy, ExternalLink, Download } from 'lucide-react'
import StatusBadge from './StatusBadge'
import PrimaryActionButton from './PrimaryActionButton'
import { formatCHF, formatDateFr, formatDateTimeFr, formatAddressOneLine } from '../../lib/format'
import { echeanceInfo, type AdminActionType } from '../../lib/orders'
import { copyText } from '../../lib/clipboard'
import { daysUntil } from '../../lib/format'
import { PAYMENT_LABELS, PRODUCT_NAME, type Order } from '../../lib/types'
import { useToast } from '../ui/Toast'

interface Props {
  order: Order
  onClose: () => void
  onSaveNotes: (id: string, notes: string) => void
  onAction: (order: Order, type: AdminActionType) => void
  onDownloadInvoice: (order: Order) => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <div className="text-[10px] tracking-[0.25em] uppercase text-white/40 mb-3">{title}</div>
      {children}
    </div>
  )
}

function CopyRow({ label, value, copy }: { label: string; value: React.ReactNode; copy?: string }) {
  const { toast } = useToast()
  return (
    <div className="flex justify-between items-center gap-3 py-1.5 text-[14px] font-light">
      <span className="text-white/45 shrink-0">{label}</span>
      <span className="text-white/85 text-right flex items-center gap-2 min-w-0">
        <span className="truncate">{value}</span>
        {copy != null && (
          <button onClick={async () => { if (await copyText(copy)) toast(`${label} copié ✓`) }}
            className="text-white/35 hover:text-white shrink-0"><Copy className="h-3.5 w-3.5" /></button>
        )}
      </span>
    </div>
  )
}

interface TLEvent { label: string; date: string | null; dot: string }

function buildTimeline(o: Order): TLEvent[] {
  const ev: TLEvent[] = [{ label: 'Commande reçue', date: o.created_at, dot: 'bg-yellow-400' }]
  if (o.payment_method === 'invoice_30d') {
    ev.push({ label: 'Confirmation envoyée', date: o.confirmed_at, dot: 'bg-blue-400' })
    ev.push({ label: 'Facture générée', date: o.invoiced_at, dot: 'bg-indigo-400' })
  }
  ev.push({ label: 'Plaque configurée', date: o.configured_at, dot: 'bg-cyan-400' })
  ev.push({ label: 'Expédiée', date: o.shipped_at, dot: 'bg-violet-400' })
  ev.push({ label: 'Paiement reçu', date: o.invoice_paid_at, dot: 'bg-emerald-400' })
  ev.push({ label: 'Terminée', date: o.status === 'completed' ? o.updated_at : null, dot: 'bg-white/60' })
  return ev
}

export default function OrderDetail({ order, onClose, onSaveNotes, onAction, onDownloadInvoice }: Props) {
  const [notes, setNotes] = useState(order.notes ?? '')
  const timer = useRef<number>()
  const firstRender = useRef(true)
  const { toast } = useToast()

  useEffect(() => { setNotes(order.notes ?? ''); firstRender.current = true }, [order.id, order.notes])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => onSaveNotes(order.id, notes), 500)
    return () => window.clearTimeout(timer.current)
  }, [notes, order.id, onSaveNotes])

  const timeline = buildTimeline(order)
  const ech = echeanceInfo(order)
  const due = daysUntil(order.invoice_due_date)

  return (
    <div className="fixed inset-0 z-[80]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" style={{ backdropFilter: 'blur(2px)' }} />
      <aside className="absolute right-0 top-0 h-full w-full md:w-[480px] overflow-y-auto animate-slide-in"
        style={{ background: 'linear-gradient(180deg, rgba(14,16,22,0.99), rgba(8,9,13,0.99))', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-5 border-b border-white/[0.08] bg-black/40 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <h2 className="font-mono text-[15px] text-white/90">{order.order_ref}</h2>
            <StatusBadge status={order.status} />
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><X className="h-5 w-5" /></button>
        </div>

        <div className="px-6 py-6">
          <Section title="Client">
            <div className="text-[16px] text-white/90 mb-2">{order.first_name} {order.last_name}</div>
            <CopyRow label="Email" value={order.email} copy={order.email} />
            <CopyRow label="Téléphone" value={order.phone} copy={order.phone} />
            {order.company_name && <CopyRow label="Entreprise" value={order.company_name} />}
            <CopyRow label="Adresse" value={`${order.address}, ${order.postal_code} ${order.city}`} copy={formatAddressOneLine(order)} />
            <CopyRow label="Canton" value={order.canton} />
          </Section>

          <Section title="Fiche Google">
            <div className="flex items-center gap-2">
              <a href={order.google_business_url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] text-blue-300 underline underline-offset-2 break-all">
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />{order.google_business_url || '—'}
              </a>
              <button onClick={async () => { if (await copyText(order.google_business_url)) toast('Lien copié ✓') }}
                className="text-white/35 hover:text-white shrink-0"><Copy className="h-3.5 w-3.5" /></button>
            </div>
          </Section>

          <Section title="Commande">
            <CopyRow label="Produit" value={`1× ${PRODUCT_NAME}`} />
            <CopyRow label="Montant" value={`${formatCHF(order.amount_chf)} CHF`} />
            <CopyRow label="Méthode" value={PAYMENT_LABELS[order.payment_method]} />
          </Section>

          {order.payment_method === 'invoice_30d' && (
            <Section title="Facture">
              <CopyRow label="Émise le" value={order.invoiced_at ? formatDateFr(order.invoiced_at) : 'Pas encore générée'} />
              <CopyRow label="Échéance" value={formatDateFr(order.invoice_due_date)} />
              {due !== null && order.status !== 'paid' && order.status !== 'completed' && (
                <div className="flex justify-between py-1.5 text-[14px] font-light">
                  <span className="text-white/45">Décompte</span>
                  <span className={ech.className}>{ech.label}</span>
                </div>
              )}
              <CopyRow label="Relances" value={`Relancé ${order.relance_count} fois`} />
              {order.last_relance_at && <CopyRow label="Dernière relance" value={formatDateFr(order.last_relance_at)} />}
              {order.invoice_pdf_url && (
                <button onClick={() => onDownloadInvoice(order)}
                  className="mt-3 inline-flex items-center gap-2 rounded-full py-2 px-4 text-[13px] font-light bg-white/[0.04] text-white/75 border border-white/12 hover:bg-white/[0.08]">
                  <Download className="h-4 w-4" /> Télécharger la facture
                </button>
              )}
            </Section>
          )}

          <Section title="Timeline">
            <div className="relative pl-5">
              {timeline.map((e, i) => {
                const done = !!e.date
                return (
                  <div key={i} className="relative pb-5 last:pb-0">
                    <span className={`absolute -left-5 top-1 h-2 w-2 rounded-full ${done ? e.dot : 'bg-white/15'}`} />
                    {i < timeline.length - 1 && (
                      <span className={`absolute -left-[15px] top-3 h-full w-px ${done ? 'bg-white/15' : 'bg-white/[0.06] border-l border-dashed border-white/15'}`} />
                    )}
                    <div className={`text-[14px] font-light ${done ? 'text-white/80' : 'text-white/35'}`}>{e.label}</div>
                    <div className="text-[12px] text-white/40">
                      {done ? formatDateTimeFr(e.date) : 'En attente…'}
                      {e.label === 'Expédiée' && order.tracking_number ? ` · suivi ${order.tracking_number}` : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>

          <Section title="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4}
              placeholder="Notes internes (ex: client appelé le 12 mai, dit qu'il paie vendredi...)"
              className="field-input resize-none" />
          </Section>

          <Section title="Actions">
            <PrimaryActionButton order={order} size="lg" onAction={onAction} />
            <div className="flex flex-wrap gap-2 mt-3">
              <SecBtn label="Copier email" onClick={async () => { if (await copyText(order.email)) toast('Email copié ✓') }} />
              <SecBtn label="Copier adresse" onClick={async () => { if (await copyText(formatAddressOneLine(order))) toast('Adresse copiée ✓') }} />
              {order.invoice_pdf_url && <SecBtn label="Télécharger facture" onClick={() => onDownloadInvoice(order)} />}
            </div>
          </Section>
        </div>
      </aside>
    </div>
  )
}

function SecBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="rounded-full py-2 px-4 text-[12px] font-light bg-white/[0.04] text-white/70 border border-white/12 hover:bg-white/[0.08] transition-colors">
      {label}
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/OrderDetail.tsx
git commit -m "feat(admin): full order-detail tracking sheet"
```

---

## Task 11: Dashboard rewire + StatsRow

**Files:**
- Rewrite: `src/pages/admin/Dashboard.tsx`
- Modify: `src/components/admin/StatsRow.tsx`

- [ ] **Step 1: Update `StatsRow.tsx`** — use `statKpis`. Replace lines 1–48 (imports + the `useMemo` block) so it reads:

```tsx
import { useMemo } from 'react'
import GlassCard from '../ui/GlassCard'
import { statKpis } from '../../lib/orders'
import { formatCHF, monthNameFr } from '../../lib/format'
import type { Order } from '../../lib/types'
```
and the component body's memo:
```tsx
  const { monthName, ca, monthCount, todo, unpaid } = useMemo(() => {
    const now = new Date()
    const k = statKpis(orders, now)
    return { monthName: monthNameFr(now), ...k }
  }, [orders])
```
and the JSX row (replace the four `<Stat>`):
```tsx
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Stat label={`CA · ${monthName}`} value={formatCHF(ca)} unit="CHF" />
      <Stat label="Commandes" value={String(monthCount)} />
      <Stat label="À traiter" value={String(todo)} badge={todo > 0 ? 'orange' : undefined} />
      <Stat label="Impayé" value={formatCHF(unpaid)} unit="CHF" badge={unpaid > 0 ? 'red' : undefined} />
    </div>
```
(Keep the `Stat` sub-component as-is.)

- [ ] **Step 2: Rewrite `Dashboard.tsx`** — wire the new handler bag, the `executeAction` dispatcher (generate_invoice → PDF; others → modal), `confirmAction` using `applyAction`, and render `TodoSections`/`OrdersTable`.

```tsx
import { useEffect, useMemo, useState } from 'react'
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
import { copyText } from '../../lib/clipboard'
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
      if (a.type === 'relance') {
        await copyText(a.order.email)
        toast('Email copié — envoyez votre relance')
      } else {
        toast('Commande mise à jour ✓')
      }
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

  function saveNotes(id: string, notes: string) {
    update(id, { notes }).catch(() => toast('Erreur sauvegarde note'))
  }

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
```

- [ ] **Step 3: Full build**

```bash
npm run build
```
Expected: PASS — all TS compiles, no unused-import errors. Fix any remaining references (e.g. stale imports) until green.

- [ ] **Step 4: Run unit tests**

```bash
npm test
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/Dashboard.tsx src/components/admin/StatsRow.tsx
git commit -m "feat(admin): wire pipeline transitions, todo sections, refreshed stats"
```

---

## Task 12: CSV export columns

**Files:**
- Modify: `src/lib/csv.ts`

- [ ] **Step 1: Add Google URL + relance columns**

In `HEADERS`, add `'Fiche Google'` after `'Canton'` and `'Relances'` after `'Date expédition'`:

```ts
const HEADERS = [
  'Réf', 'Statut', 'Prénom', 'Nom', 'Email', 'Téléphone', 'Entreprise',
  'Adresse', 'NPA', 'Ville', 'Canton', 'Fiche Google', 'Montant', 'Méthode',
  'Date création', 'Date échéance', 'Date paiement', 'Date expédition', 'Relances',
]
```

In the row mapping, add `o.google_business_url` after `o.canton` and `String(o.relance_count)` after the `formatDateShort(o.shipped_at)` entry:

```ts
      o.canton,
      o.google_business_url,
      Number(o.amount_chf).toFixed(2),
```
```ts
      formatDateShort(o.shipped_at),
      String(o.relance_count),
```

- [ ] **Step 2: Build + test**

```bash
npm run build && npm test
```
Expected: both PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/csv.ts
git commit -m "feat(admin): export Google Business URL + relance count to CSV"
```

---

## Task 13: End-to-end verification

**Files:** none (manual verification per superpowers:verification-before-completion).

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Funnel test (Facture)** — go to `/commander`, fill Step 1 including the Google Business URL field. Verify: (a) submitting without the URL shows "Lien Google requis"; (b) a non-URL value shows the http(s) error; (c) a valid `https://g.page/...` passes. Complete with "Facture 30j" → lands on `/confirmation`. In Supabase, confirm the new row has `status='new'`, `google_business_url` populated, `invoice_due_date` NULL.

- [ ] **Step 3: Admin pipeline walk-through (Facture)** — log in at `/admin`. The order appears under **Nouvelles commandes**. Click `✉️ Confirmée` → confirm modal → moves to **Factures à générer**. Click `📄 Facture` (generates PDF) → button becomes `📤 Envoyée` → click it → moves to **À configurer** with the Google link shown + copyable. Click `⚙️ Config` (modal shows the link) → **À expédier** with address shown. Click `📦 Expédier` (optional tracking) → moves to **En attente de paiement** with a J-XX countdown. Click `✓ Payée` → leaves the todo list (status `paid`). Open detail → primary action `✅ Terminer` → `completed`.

- [ ] **Step 4: Admin pipeline walk-through (Stripe)** — create a Stripe order (or manually set one to `new`/`stripe`). Verify: `new` → `✓ Payée` → `paid` shows `⚙️ Config` → `configured` → `📦 Expédier` → `shipped` (NOT awaiting_payment) → `✅ Terminer` → `completed`.

- [ ] **Step 5: Dunning path** — use the "⋯" → Changer statut to set an invoice order to `overdue`. Confirm it appears under **En retard** with "J+X de retard" and relance count. Click `Relancer` → confirm modal → toast "Email copié", `relance_count` increments, paste-check the clipboard holds the client email. Then "⋯" → Escalader → `recovery` → disappears from todo + "À traiter" stat.

- [ ] **Step 6: Stats row** — verify CA counts only paid+completed of the current month; "À traiter" = count of non-terminal orders (orange badge if >0); "Impayé" = sum of awaiting_payment+overdue amounts (red badge if >0).

- [ ] **Step 7: Detail panel** — open an order: Client copy buttons work (email/phone/address toasts), Fiche Google link opens new tab + copies, Facture section shows émission/échéance/décompte/relances + PDF download when present, Timeline shows past events solid with date+time and future events dashed "En attente…", Notes autosave after 500ms (edit, wait, reopen → persisted).

- [ ] **Step 8: Responsive 375px** — in devtools at 375px width: funnel field readable; dashboard todo mini-cards stack and action buttons remain tappable; "Toutes les commandes" renders as mobile cards (not the table); detail panel is full-width; modals fit. Note any overflow and fix.

- [ ] **Step 9: Final verification gate** — run the full suite one last time and confirm clean:

```bash
npm run build && npm test
```
Expected: build PASS, all vitest PASS. Only claim completion after seeing both succeed (per superpowers:verification-before-completion).

- [ ] **Step 10: Finish the branch** — use superpowers:finishing-a-development-branch to choose merge/PR. Suggested final commit if any verification fixes were made:

```bash
git add -A && git commit -m "fix: responsive + verification adjustments for status pipeline"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Change 1 (Google Business URL field + helper + storage) → Tasks 1, 2, 4. ✅
- Change 2 (new statuses, labels, badges, state machine) → Tasks 2, 3. ✅
- Change 3 ("À traiter" 6 sections, contextual data, empty states) → Task 9. ✅
- Change 4 (table columns, primary button per status, ⋯ menu) → Tasks 6, 7, 8. ✅
- Change 5 (detail panel sections incl. Fiche Google, Facture, Timeline, Notes, Actions) → Task 10. ✅
- Change 6 (per-action modals) → Task 6. ✅
- Change 7 (stats row) → Tasks 3, 11. ✅
- Change 8 (insert always `new`) → Task 4. ✅
- Migration SQL → Task 1. ✅
- Responsive 375px → Task 13 Step 8. ✅

**Type consistency:** `AdminActionType` is defined once in `orders.ts` and reused by `PrimaryActionButton`, `ActionModals` (`ModalActionType = Exclude<…,'generate_invoice'>`), `OrdersTable.TableHandlers`, and `Dashboard`. `applyAction` patch shapes match `Order` field names. `nextAction` action `type` strings match the `applyAction` switch and the modal switch. `TableHandlers` is the single handler contract shared by `OrdersTable` and `TodoSections`.

**Placeholder scan:** No TBD/TODO; every code step contains full code; the one ambiguous `todo` test value is resolved in Task 3 Step 5 (value = 4).

**Known nuance for the implementer:** the `confirmed` status has a two-phase primary action (generate → mark_invoiced) keyed off `invoice_pdf_url`; `generate_invoice` is the only primary action that does NOT open a modal. `awaiting_payment → overdue` has no dedicated button by design (per brief: "l'admin change manuellement") — it's done via "⋯ → Changer statut".
