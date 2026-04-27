# NP Stock

Next.js 14 (App Router) + TypeScript + Tailwind CSS, con Firebase Authentication y Firestore.

## Stack

- Next.js 14 (App Router)
- TypeScript (strict)
- Tailwind CSS
- Firebase (Auth + Firestore)

## Estructura del proyecto

```text
./app
  /login         # página de login
  /dashboard     # dashboard protegido
  /api           # (vacío, reservado para route handlers)
./components      # UI + AuthProvider + layout shell
./hooks           # hooks de auth + ventas/datos
./lib             # firebase.ts, constants.ts, calculations.ts, firestore.ts, formatters.ts
./scripts         # seed.ts + create-users.ts
./types           # tipos de dominio + auth
./styles          # globals.css (Tailwind)
./package.json    # scripts npm y dependencias
```

## Modelo de dominio

NP Stock registra inventario en consignación de *All Covering* distribuido en tres sucursales de NP.

- **Role** - `admin` | `controlador` | `vendedor` | `allcovering`. Controla los permisos.
- **Branch** - `gonnet` | `laplata` | `quilmes`. Ubicaciones físicas que tienen stock.
- **Product** - metadatos del catálogo SKU: nombre, categoría (`SPC` | `Laminado` | `SPC Budget`, mostrado como `SPC Oferta`), `costoUSD`, `precioVentaUSD`, `esBudget` (mostrado como `Oferta`), `activo`. No guarda cantidades de stock.
- **ProductDistribution** (`distribucion/{productId}`) - cajas actuales asignadas por sucursal en `cajasPorSucursal`.
- **Sale** - venta individual: producto, sucursal, cajas, `montoUSD`, `tipoCambioUSD`, `montoARS`, fecha y vendedor.
- **IngresoStock** (`ingresos/{id}`) - ingreso de mercadería con sucursal, cajas, `costoUSDPorCaja` y `costoTotalUSD`.
- **BajaStock** (`bajas/{id}`) - salida/corrección de stock no vinculada a venta con sucursal, cajas, tipo, motivo opcional, indicador de deuda, fecha, creador y notas opcionales.
- **TrasladoStock** (`traslados/{id}`) - movimiento entre sucursales con producto, origen, destino, cajas, fecha, creador y notas opcionales.
- **ProviderSnapshot** (`proveedorResumen/{productId}`) - agregado seguro para el proveedor All Covering con cajas vendidas, cajas restantes y deuda únicamente.
- **LiquidacionProveedor** (`liquidacionesProveedor/{id}`) - pago/liquidación global a All Covering con proveedor, fecha, monto USD, creador y notas opcionales.
- **Audit** - registro de auditoría por una sucursal auditada, con conteos y diferencias por producto.
- **AppConfig** - documento único de configuración con `tipoCambioUSD`.
- **UserProfile** - documento identificado por el uid de Firebase Auth con `role`, `activo` y `sucursalAsignada` opcional.

## Valores calculados

Estos valores se derivan en tiempo de lectura y no deben persistirse:

- `calculateSoldBoxesByProduct(sales)` - suma de `cajas` por producto a partir de las ventas.
- `calculateTotalAvailableBoxes(distribution)` - suma de cajas entre sucursales a partir de `distribucion`.
- `calculateRemainingBoxes(totalAvailableBoxes, soldBoxes)` - disponible menos vendido, con mínimo 0.
- `calculateDebtUSD(product, soldBoxes)` - deuda con All Covering = `soldBoxes * product.costoUSD`.
- `calculateRevenueUSD(sales)` - suma de `montoUSD`.
- `calculateRevenueByProduct(sales)` - totales de `montoUSD` por producto.
- `calculateGrossProfitUSD(product, soldBoxes, revenueUSD)` - `revenue - debt`.
- `calculateSellThrough(soldBoxes, remainingBoxes)` - `soldBoxes / (soldBoxes + remainingBoxes)`.
- `validateStockAvailability(...)` - lanza error cuando una venta supera el stock disponible.

La cantidad de stock siempre sale de `ProductDistribution.cajasPorSucursal`, nunca de `Product`.

## Modelo de stock

Las colecciones principales tienen responsabilidades distintas:

- **`productos/{id}`** - solo metadatos del producto. No contiene cantidades de stock.
- **`distribucion/{productId}.cajasPorSucursal`** - stock vivo restante por sucursal.
- **`ventas/{id}`** - registros históricos de venta usados para calcular vendidos, deuda y revenue.
- **`ingresos/{id}`** - registros históricos de ingreso de stock. Crear un ingreso aumenta el stock vivo en `distribucion`. Guardan costo en USD por caja y costo total en USD. ARS no se usa en ingresos; ARS se usa solo para la conversión en ventas a clientes.
- **`bajas/{id}`** - registros históricos de salidas/correcciones no vinculadas a ventas. Crear una baja disminuye el stock vivo en `distribucion` y genera historial de baja únicamente; no crea `ventas` ni afecta revenue de clientes. `devolucion_proveedor` se usa para mercadería no vendible devuelta a All Covering y no genera deuda. `baja_sucursal` se usa para producto dañado, abierto como muestra, perdido, roto o consumido por la sucursal y sí genera deuda con All Covering.
- **`traslados/{id}`** - registros históricos de movimientos entre sucursales. Crear un traslado descuenta cajas del origen y suma la misma cantidad en el destino, por lo que el stock global no cambia.
- **`auditorias/{id}`** - controles físicos de stock realizados por una sucursal a la vez. Las auditorías no modifican stock; las diferencias se corrigen luego con ingreso, baja o movimiento.
- **`liquidacionesProveedor/{id}`** - pagos/liquidaciones globales a All Covering. Reducen el saldo pendiente con el proveedor, pero no modifican stock, ventas ni bajas.

### Flujo

1. `useSales.createSale` ejecuta una transacción de Firestore.
2. Se descuenta el stock de la sucursal asignada en `distribucion.cajasPorSucursal`.
3. Se escribe un documento en `ventas` con la foto de la venta.

`distribucion` ya refleja las ventas pasadas. No hay que restar `ventas` de `distribucion` nuevamente al leer.

## Seed de la base de datos

El script de seed crea los productos iniciales, los documentos de distribución correspondientes y el documento `config/app`. Es idempotente y usa Firebase Admin SDK.

```bash
npm install
npm run seed
```

Requiere `GOOGLE_APPLICATION_CREDENTIALS` apuntando a un archivo JSON de service account de Firebase. Nunca subas ese archivo JSON al repositorio.

`.env.local` sigue siendo necesario para ejecutar la app localmente, pero no se usa en `npm run seed`.

## Configuración

1. Instalar dependencias:

```bash
npm install
```

2. Copiar variables de entorno:

```bash
cp .env.example .env.local
```

3. Completar todos los valores `NEXT_PUBLIC_FIREBASE_*` con los datos de tu proyecto Firebase.
4. En Firebase Authentication, habilitar Email/Password sign-in.

## Configuración de usuarios

Usar el script de seed con Firebase Admin para crear o actualizar los usuarios actuales de NP Stock:

```bash
npm run setup:users
```

Variables de entorno requeridas:

- `GOOGLE_APPLICATION_CREDENTIALS`
- `ADMIN_PASSWORD`
- `CONTROLADOR_PASSWORD`
- `QUILMES_PASSWORD`
- `GONNET_PASSWORD`
- `LAPLATA_PASSWORD`
- `ALLCOVERING_PASSWORD`

`GOOGLE_APPLICATION_CREDENTIALS` debe apuntar a un archivo JSON de service account de Firebase. Nunca subas ese archivo JSON al repositorio.

## Ejecutar localmente

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

Type-check:

```bash
npm run type-check
```

## Deploy en Netlify

1. Subir este repo a GitHub/GitLab/Bitbucket.
2. En Netlify, importar el proyecto existente.
3. Netlify detectará Next.js automáticamente y usará `npm run build`.
4. Agregar todas las variables `NEXT_PUBLIC_FIREBASE_*` en la configuración de entorno de Netlify.
5. Disparar un deploy.

## Deploy de reglas Firestore

Instalar Firebase CLI si hace falta:

```bash
npm install -g firebase-tools
```

Iniciar sesión en Firebase:

```bash
firebase login
```

Deploy solo de reglas Firestore:

```bash
firebase deploy --only firestore:rules
```

## Exportar

Exportar es solo admin y descarga archivos CSV. Exportaciones disponibles:

- ventas
- ingresos
- bajas
- movimientos
- auditorías resumen
- auditorías detalle
- stock actual
- proveedor / All Covering
- liquidaciones proveedor

## Roles y control de acceso

`AuthProvider` expone `profile` y `role` junto con el usuario de Firebase. `RoleGuard` se usa para restringir el acceso en la UI.

Usuarios es solo admin y edita perfiles de Firestore en `users/{uid}`. No crea usuarios de Firebase Authentication, no elimina usuarios de Firebase Authentication y no cambia email/password de Auth. Los usuarios nuevos se siguen creando con `npm run setup:users` o desde Firebase Authentication.

### Current roles

- `admin`
- `controlador`
- `vendedor`
- `allcovering`

### Controlador

- Puede acceder a Dashboard, Auditorías y Movimientos.
- Puede leer y crear `auditorias`.
- Puede acceder a Movimientos y crear `traslados`.
- Lee `productos` y `distribucion` solo para realizar auditorías y movimientos entre sucursales.
- No puede vender, crear ingresos/bajas, leer historial de ventas ni acceder a áreas de configuración/proveedor/admin.

### Vendedor

- Tiene `sucursalAsignada` en `users/{uid}`.
- Puede vender solo desde la sucursal asignada.
- Puede ver solo el historial de ventas de su sucursal asignada.
- No puede acceder a gestión de stock/configuración, auditorías, portal de proveedor ni áreas admin.

El hook actual de ventas también fuerza que una venta de `vendedor` use la sucursal asignada, incluso si el cliente envía otra sucursal.

### All Covering

- Rol de portal de proveedor en solo lectura.
- Lee únicamente `proveedorResumen` más su propio perfil `users/{uid}`.
- Ve deuda, cajas vendidas y cajas restantes desde documentos agregados seguros para proveedor.
- Ve resumen e historial seguro de liquidaciones registradas.
- No ve revenue, margen ni precios de venta en la UI.

El portal de proveedor no lee `ventas`, `productos`, `distribucion`, `config`, `auditorias` ni otros usuarios en crudo.

## Resumen de reglas Firestore

Las reglas viven en [firestore.rules](./firestore.rules).

- `users/{uid}` - lectura: mismo usuario o admin. Escritura: solo admin.
- `productos/{productId}` - lectura: `admin`, `controlador`, `vendedor`. `controlador` lee esto solo para auditorías. Escritura: solo admin.
- `distribucion/{productId}` - lectura: `admin`, `controlador`, `vendedor`. `controlador` lee esto solo para auditorías/movimientos y puede actualizarlo solo cuando mueve stock sin cambiar el total del producto. Escritura: admin, más actualización de vendedor solo al disminuir stock de su sucursal asignada durante la creación de una venta.
- `ventas/{saleId}` - lectura/creación: admin, más vendedor solo para su sucursal asignada. Update/delete: solo admin.
- `ingresos/{ingresoId}` - lectura/creación/delete: solo admin. Update: denegado.
- `bajas/{bajaId}` - lectura/creación/delete: solo admin. Update: denegado.
- `traslados/{trasladoId}` - lectura/creación: admin o controlador. Delete: solo admin. Update: denegado.
- `proveedorResumen/{productId}` - lectura: admin o allcovering. Escritura: solo admin.
- `liquidacionesProveedor/{liquidacionId}` - lectura: admin o allcovering. Creación/delete: solo admin. Update: denegado.
- `auditorias/{auditId}` - lectura/creación: admin o controlador. Update/delete: solo admin.
- `config/{docId}` - lectura: admin o vendedor. Escritura: solo admin.
- Cualquier otra ruta - denegada.

## Estado del proyecto

Implementado:

- auth
- role profiles
- dashboard con estadísticas avanzadas solo para admin
- admin users profile management
- sales
- live stock
- ingresos
- bajas
- movimientos/traslados
- unified operational history for ventas, ingresos, bajas, movimientos, and auditorías where role allows
- CSV exports for admin
- configuration
- audits
- provider portal
- supplier-safe provider snapshot
- supplier payment/liquidation tracking
- setup users script

## Notas

- Los valores calculados como deuda, revenue, profit, stock restante y sell-through se derivan de los documentos actuales en tiempo de lectura.
- El dashboard incluye estadísticas avanzadas solo para admin. Usa un filtro de período para métricas operativas/financieras y mantiene el stock vivo como estado actual. Los demás roles conservan dashboards simples según sus permisos.
- El dashboard incluye estadísticas de negocio avanzadas solo para admin: rotación, días de stock, stock muerto, pérdidas operativas y alertas de inventario.
- Los errores visibles para usuarios se traducen al español mediante `/lib/errors.ts`; los detalles técnicos se registran en consola para depuración.
- La app está preparada para uso desde navegadores móviles. El filtro global de sucursal solo es editable por admin en pantallas donde afecta lecturas; vendedor ve solo su `sucursalAsignada`, controlador usa selectores propios de auditorías/movimientos y All Covering no ve selector de sucursal.
- El portal de proveedor oculta intencionalmente revenue y margen en la UI y lee la colección segura `proveedorResumen`.
- Las liquidaciones a All Covering son pagos globales en USD. Reducen el saldo pendiente, no se asignan todavía a productos/cajas específicas y no modifican stock, ventas ni bajas.
- La ruta `/dashboard` está protegida del lado cliente. Agregar protección del lado servidor antes de tratarla como un límite de seguridad fuerte.
