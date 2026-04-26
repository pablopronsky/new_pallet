# np-stock

Next.js 14 (App Router) + TypeScript + Tailwind CSS, with Firebase Authentication and Firestore.

## Stack

- Next.js 14 (App Router)
- TypeScript (strict)
- Tailwind CSS
- Firebase (Auth + Firestore)

## Project structure

```text
/app
  /login         # login page
  /dashboard     # protected dashboard
  /api           # (empty, reserved for route handlers)
/components      # UI + AuthProvider + layout shell
/hooks           # auth + sales/data hooks
/lib             # firebase.ts, constants.ts, calculations.ts, firestore.ts, formatters.ts
/scripts         # seed.ts + create-users.ts
/types           # domain + auth types
/styles          # globals.css (Tailwind)
```

## Domain model

np-stock tracks consignment inventory from *All Covering* distributed to three NP branches.

- **Role** - `admin` | `controlador` | `vendedor` | `allcovering`. Controls permissions.
- **Branch** - `gonnet` | `laplata` | `quilmes`. Physical locations that hold stock.
- **Product** - SKU catalog metadata: name, category (`SPC` | `Laminado` | `SPC Budget`), `costoUSD`, `precioVentaUSD`, `esBudget`, `activo`. Does not store stock quantities.
- **ProductDistribution** (`distribucion/{productId}`) - current boxes allocated per branch in `cajasPorSucursal`.
- **Sale** - individual sale: product, branch, boxes, `montoUSD`, `tipoCambioUSD`, `montoARS`, date, seller.
- **IngresoStock** (`ingresos/{id}`) - incoming merchandise entry with branch, boxes, `costoUSDPorCaja`, and `costoTotalUSD`.
- **BajaStock** (`bajas/{id}`) - non-sale stock exit/correction with branch, boxes, reason, date, creator, and optional notes.
- **TrasladoStock** (`traslados/{id}`) - branch-to-branch movement with product, origin, destination, boxes, date, creator, and optional notes.
- **ProviderSnapshot** (`proveedorResumen/{productId}`) - supplier-safe aggregate for All Covering with sold boxes, remaining boxes, and debt only.
- **Audit** - audit record with per-product/per-branch counts and differences.
- **AppConfig** - singleton config doc with `tipoCambioUSD`.
- **UserProfile** - doc keyed by Firebase Auth uid with `role`, `activo`, and optional `sucursalAsignada`.

## Calculated values

These values are derived at read time and should not be persisted:

- `calculateSoldBoxesByProduct(sales)` - sum of `cajas` per product from sales.
- `calculateTotalAvailableBoxes(distribution)` - sum of boxes across branches from `distribucion`.
- `calculateRemainingBoxes(totalAvailableBoxes, soldBoxes)` - available minus sold, floored at 0.
- `calculateDebtUSD(product, soldBoxes)` - debt to All Covering = `soldBoxes * product.costoUSD`.
- `calculateRevenueUSD(sales)` - sum of `montoUSD`.
- `calculateRevenueByProduct(sales)` - per-product `montoUSD` totals.
- `calculateGrossProfitUSD(product, soldBoxes, revenueUSD)` - `revenue - debt`.
- `calculateSellThrough(soldBoxes, remainingBoxes)` - `soldBoxes / (soldBoxes + remainingBoxes)`.
- `validateStockAvailability(...)` - throws when a sale would exceed available stock.

Stock quantity always flows from `ProductDistribution.cajasPorSucursal`, never from `Product`.

## Stock model

The three core collections have distinct responsibilities:

- **`productos/{id}`** - product metadata only. No stock quantity.
- **`distribucion/{productId}.cajasPorSucursal`** - live remaining stock per branch.
- **`ventas/{id}`** - historical sale records used for sold totals, debt, and revenue calculations.
- **`ingresos/{id}`** - historical incoming stock records. These store cost in USD per box and total USD cost. ARS is not used for ingresos; ARS is only used for customer sales conversion.
- **`bajas/{id}`** - historical non-sale exits/corrections. Creating a baja decreases live stock in `distribucion` and creates baja history only; it does not create `ventas` or affect customer revenue.
- **`traslados/{id}`** - historical branch-to-branch movements. Creating a traslado subtracts boxes from the origin branch and adds the same boxes to the destination branch, so global stock does not change.

### Flow

1. `useSales.createSale` runs a Firestore transaction.
2. The assigned branch stock is decremented in `distribucion.cajasPorSucursal`.
3. A `ventas` document is written with the sale snapshot.

`distribucion` already reflects past sales. Do not subtract `ventas` from `distribucion` again on read.

## Seed the database

The seed script creates the initial products, matching distribution docs, and the `config/app` document. It is idempotent and uses the Firebase Admin SDK.

```bash
npm install
npm run seed
```

Requires `GOOGLE_APPLICATION_CREDENTIALS` pointing to a Firebase service account JSON file. Never commit the service account JSON file to the repository.

`.env.local` is still required to run the app locally, but it is not used by `npm run seed`.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env.local
```

3. Fill in all `NEXT_PUBLIC_FIREBASE_*` values from your Firebase project settings.
4. In Firebase Authentication, enable Email/Password sign-in.

## Setup users

Use the Firebase Admin seed script to create or update the current NP Stock users:

```bash
npm run setup:users
```

Required environment variables:

- `GOOGLE_APPLICATION_CREDENTIALS`
- `ADMIN_PASSWORD`
- `CONTROLADOR_PASSWORD`
- `QUILMES_PASSWORD`
- `GONNET_PASSWORD`
- `LAPLATA_PASSWORD`
- `ALLCOVERING_PASSWORD`

`GOOGLE_APPLICATION_CREDENTIALS` must point to a Firebase service account JSON file. Never commit the service account JSON file to the repository.

## Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Type-check:

```bash
npm run type-check
```

## Deploy to Netlify

1. Push this repo to GitHub/GitLab/Bitbucket.
2. In Netlify, import the existing project.
3. Netlify will auto-detect Next.js and use `npm run build`.
4. Add all `NEXT_PUBLIC_FIREBASE_*` variables in Netlify environment settings.
5. Trigger a deploy.

## Roles & access control

`AuthProvider` exposes `profile` and `role` alongside the Firebase user. `RoleGuard` is used to gate UI access.

### Current roles

- `admin`
- `controlador`
- `vendedor`
- `allcovering`

### Controlador

- Can access Dashboard, Auditorías, and Movimientos.
- Can read and create `auditorias`.
- Can access Movimientos and create `traslados`.
- Reads `productos` and `distribucion` only to perform audits and branch movements.
- Cannot sell, create ingresos/bajas, read sales history, or access configuration/provider/admin areas.

### Vendedor

- Has `sucursalAsignada` in `users/{uid}`.
- Can sell only from the assigned branch.
- Can see only assigned branch sales history.
- Cannot access stock/configuration management, audits, provider portal, or admin areas.

The current sales hook also forces a `vendedor` sale to use the assigned branch, even if another branch is submitted from the client.

### All Covering

- Read-only supplier portal role.
- Reads only `proveedorResumen` plus its own `users/{uid}` profile.
- Sees debt, sold boxes, and remaining boxes from supplier-safe aggregate docs.
- Does not see UI revenue, margin, or sale prices.

The provider portal does not read raw `ventas`, `productos`, `distribucion`, `config`, `auditorias`, or other users.

## Firestore rules summary

Rules live in [firestore.rules](./firestore.rules).

- `users/{uid}` - read: same user or admin. Write: admin only.
- `productos/{productId}` - read: `admin`, `controlador`, `vendedor`. Controlador reads this only for audits. Write: admin only.
- `distribucion/{productId}` - read: `admin`, `controlador`, `vendedor`. Controlador reads this only for audits/movements and may update it only when moving stock without changing total product stock. Write: admin, plus vendedor update only when decreasing assigned branch stock during sale creation.
- `ventas/{saleId}` - read/create: admin, plus vendedor only for their assigned branch. Update/delete: admin only.
- `ingresos/{ingresoId}` - read/create/delete: admin only. Update: denied.
- `bajas/{bajaId}` - read/create/delete: admin only. Update: denied.
- `traslados/{trasladoId}` - read/create: admin or controlador. Delete: admin only. Update: denied.
- `proveedorResumen/{productId}` - read: admin or allcovering. Write: admin only.
- `auditorias/{auditId}` - read/create: admin or controlador. Update/delete: admin only.
- `config/{docId}` - read: admin or vendedor. Write: admin only.
- Any other path - denied.

## Project status

Implemented:

- auth
- role profiles
- sales
- live stock
- ingresos
- bajas
- movimientos/traslados
- history
- configuration
- audits
- provider portal
- supplier-safe provider snapshot
- setup users script

## Notes

- Calculated values such as debt, revenue, profit, remaining stock, and sell-through are derived from current documents at read time.
- The provider portal intentionally hides UI revenue and margin and reads the supplier-safe `proveedorResumen` collection.
- The `/dashboard` route is protected client-side. Add server-side protection before treating it as a strong security boundary.
