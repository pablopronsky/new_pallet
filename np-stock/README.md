# np-stock

Next.js 14 (App Router) + TypeScript + Tailwind CSS, with Firebase Authentication and Firestore.

## Stack

- Next.js 14 (App Router)
- TypeScript (strict)
- Tailwind CSS
- Firebase (Auth + Firestore)

## Project structure

```
/app
  /login         # login page
  /dashboard     # protected dashboard
  /api           # (empty, reserved for route handlers)
/components      # UI + AuthProvider + layout shell
/hooks           # useAuth
/lib             # firebase.ts, constants.ts, calculations.ts, firestore.ts, formatters.ts
/scripts         # seed.ts (idempotent Firestore seed)
/types           # domain + auth types
/styles          # globals.css (Tailwind)
```

## Domain model

np-stock tracks consignment inventory from *All Covering* (supplier) distributed to three NP branches.

- **Role** — `admin` | `controlador` | `allcovering`. Controls permissions.
- **Branch** — `gonnet` | `laplata` | `quilmes`. Physical locations that hold stock.
- **Product** — SKU catalogue only: name, category (`SPC` | `Laminado` | `SPC Budget`), `costoUSD` (debt to All Covering per box), `precioVentaUSD`, `esBudget` flag. **Does not** hold stock quantities — this is a consignment model where stock is whatever the supplier has delivered.
- **ProductDistribution** (`distribucion/{productId}`) — current boxes allocated per branch (`cajasPorSucursal`). The total available is derived, never stored.
- **Sale** — individual sale: product, branch, boxes, `montoUSD`, `tipoCambioUSD` snapshot, `montoARS`, date, seller.
- **Audit** — full system audit (spans all branches). Each `AuditItem` carries its own `sucursal` + product and compares `cajasSistema` vs `cajasContadas`.
- **AppConfig** — singleton (`config/app`) with `tipoCambioUSD` (default exchange rate).
- **UserProfile** — profile doc keyed by Firebase Auth uid; stores role and optional assigned branch.

### Calculated values (derived, not stored)

These are computed on read via [`lib/calculations.ts`](lib/calculations.ts) — **never persisted** to Firestore, to avoid drift:

- `calculateSoldBoxesByProduct(sales)` — sum of `cajas` per product from sales.
- `calculateTotalAvailableBoxes(distribution)` — sum of boxes across all branches for a product (derived from `distribucion`, never stored).
- `calculateRemainingBoxes(totalAvailableBoxes, soldBoxes)` — available minus sold, floored at 0.
- `calculateDebtUSD(product, soldBoxes)` — **debt to All Covering** = `soldBoxes × product.costoUSD`.
- `calculateRevenueUSD(sales)` — sum of actual `montoUSD` on sales (global).
- `calculateRevenueByProduct(sales)` — per-product `montoUSD` totals; prefer this over the global when reporting per SKU.
- `calculateGrossProfitUSD(product, soldBoxes, revenueUSD)` — `revenue − debt`.
- `calculateSellThrough(soldBoxes, remainingBoxes)` — `soldBoxes / (soldBoxes + remainingBoxes)`, returns 0 when both are zero.
- `validateStockAvailability({ totalAvailable, currentSold, newSale })` — throws `StockAvailabilityError` if the proposed sale would exceed remaining stock.

Stock quantity always flows from `ProductDistribution.cajasPorSucursal`, never from `Product`. Products hold only pricing + metadata.

## Stock model

The three collections that describe inventory play distinct roles. Understanding which one is authoritative for what matters — mixing them up causes double-counting.

- **`productos/{id}`** — **product metadata only**. Name, category, unit cost (`costoUSD`), selling price, `activo` flag. Holds no stock quantity.
- **`distribucion/{productId}.cajasPorSucursal`** — the **live remaining stock** per branch. This is the single source of truth for "how many boxes are on the floor right now." Every sale subtracts from it inside a Firestore transaction; every deletion of a sale restores to it inside a transaction. Reading this value already reflects all past sales.
- **`ventas/{id}`** — historical **record of sales**. Immutable once created (admin may delete; controlador may only create). Used to reconstruct sold totals, revenue, and debt.

### Flow

1. A sale is created via `useSales.createSale`. In one transaction: the target branch in `distribucion.cajasPorSucursal` is decremented by `cajas`, and the `ventas` doc is written.
2. A sale is deleted via `useDeleteSale.deleteSale` (admin only). In one transaction: `cajas` is added back to the same branch in `distribucion.cajasPorSucursal`, and the `ventas` doc is removed.

### Derived values — NEVER persist

- **Remaining per branch** = `distribucion.cajasPorSucursal[branch]` (already live).
- **Remaining total** = `calculateTotalAvailableBoxes(distribution)` — sums `cajasPorSucursal`.
- **Sold per product** = `calculateSoldBoxesByProduct(sales)` — from `ventas`.
- **Reported "stock total"** = `remaining + sold`. Reconstructed for display; not stored.
- **Debt to All Covering** = `sold × product.costoUSD` (`calculateDebtUSD`).
- **Revenue** = sum of `sale.montoUSD` (`calculateRevenueUSD` or `calculateRevenueByProduct`).
- **Gross profit** = `revenue − debt`.
- **Sell-through** = `sold / (sold + remaining)`.

> **Do not subtract sales from `distribucion` on read.** `distribucion` already reflects sales; doing it again is a double-count bug. Calculated values must not be persisted unless explicitly designed later with reconciliation.

## Seed the database

The seed script creates the initial 7 products, matching distribution docs (all branches at 0), and the `config/app` doc with `tipoCambioUSD = 1000`. It is **idempotent** — safe to run multiple times. Products are matched by `nombre`, so re-running does not create duplicates or overwrite existing values.

```bash
npm install
npm run seed
```

Requires `.env.local` to be populated. The script uses the same Firebase client SDK config as the app.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment variables:

   ```bash
   cp .env.example .env.local
   ```

   Fill in all `NEXT_PUBLIC_FIREBASE_*` values from your Firebase project settings.

3. In the Firebase console:
   - Enable **Email/Password** sign-in under Authentication → Sign-in method.
   - Create at least one test user.

## Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to `/login` if unauthenticated, otherwise to `/dashboard`.

Type-check:

```bash
npm run type-check
```

## Deploy to Netlify

1. Push this repo to GitHub/GitLab/Bitbucket.
2. In Netlify, **Add new site → Import an existing project**, and select the repo.
3. Netlify will auto-detect Next.js; `netlify.toml` sets:
   - Build command: `npm run build`
   - Publish directory: `.next`
   - Plugin: `@netlify/plugin-nextjs`
4. Under **Site settings → Environment variables**, add all `NEXT_PUBLIC_FIREBASE_*` variables from `.env.example`.
5. Trigger a deploy.

## Roles & access control

`AuthProvider` exposes `profile` and `role` alongside the Firebase user. Use `RoleGuard` to gate UI:

```tsx
<RoleGuard allowedRoles={["admin"]}>{/* ... */}</RoleGuard>
```

Roles are read from `users/{uid}.role`. After creating a user in Firebase Auth, manually (or via an admin flow, TBD) create the matching `users/{uid}` doc with `{ uid, email, role, activo: true }`.

Firestore rules live in [firestore.rules](firestore.rules). Deploy via `firebase deploy --only firestore:rules` (requires the Firebase CLI and a configured `firebase.json`). Summary:

- `users/{uid}` — the user themselves or admin.
- `productos`, `config` — read: any signed-in; write: admin.
- `distribucion` — read: any signed-in; write: admin + controlador.
- `ventas`, `auditorias` — read: any signed-in; create: admin + controlador; update/delete: admin.
- All other paths: denied.

## Notes

- Domain model, auth + role system, and Firestore helpers are scaffolded; no business logic / UI workflows implemented yet.
- **Calculated values** (debt, revenue, profit, remaining stock, sell-through) are always derived from `sales` + `products` at read time — never persisted to Firestore.
- The `/dashboard` route is protected client-side via `ProtectedRoute`. Add server-side protection (middleware/session cookies) before relying on it for sensitive data.
