import {
  BAJA_TIPO_LABELS,
  bajaDebtUSD,
  bajaGeneraDeuda,
  bajaMotivoLabel,
  bajaTipo,
} from "@/lib/bajas";
import { BRANCHES, BRANCH_LABELS } from "@/lib/constants";
import type {
  Audit,
  AuditItem,
  BajaStock,
  Branch,
  IngresoStock,
  Product,
  ProductDistribution,
  Sale,
  TrasladoStock,
} from "@/types/domain";
import type { Timestamp } from "firebase/firestore";

export type DashboardPeriod = "today" | "7d" | "30d" | "all";
export type StockAlertType = "sin_stock" | "stock_bajo" | "sin_movimiento";

export interface DashboardMetrics {
  stockDisponible: number;
  deudaAllCovering: number;
  revenueUSD: number;
  utilidadBruta: number;
  cajasVendidas: number;
  ventasCount: number;
  bajaSucursalCajas: number;
  bajasCount: number;
  bajasDebtUSD: number;
  pendingAuditDifferences: number;
}

export interface BranchSummary {
  branch: Branch;
  label: string;
  ventasCount: number;
  cajasVendidas: number;
  revenueUSD: number;
  stockDisponible: number;
  bajaSucursalCajas: number;
  movimientosIn: number;
  movimientosOut: number;
  pendingAuditDifferences: number;
}

export interface ProductStat {
  productId: string;
  producto: string;
  cajasVendidas: number;
  rotacion: number;
  stockActual: number;
  diasStock: number | null;
  revenueUSD: number;
  deudaUSD: number;
  utilidadBruta: number;
}

export interface StockAlert {
  productId: string;
  producto: string;
  totalStock: number;
  type: StockAlertType;
}

export interface AuditAlert {
  auditId: string;
  fecha: Timestamp;
  item: AuditItem;
}

export interface OperationalLossRow {
  id: string;
  producto: string;
  sucursal: Branch;
  cajas: number;
  usdPerdido: number;
  fecha: Timestamp;
}

export interface RecentActivityRow {
  id: string;
  tipo: "venta" | "ingreso" | "baja" | "movimiento" | "auditoria";
  fecha: Timestamp;
  detalle: string;
  sucursalDetalle: string;
  cajas?: number;
  importeUSD?: number;
  createdBy: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function finiteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function periodStart(period: DashboardPeriod, now: Date): number | null {
  if (period === "all") return null;

  const start = new Date(now);
  if (period === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "7d") {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  }

  return start.getTime();
}

function averageSalesDays(
  period: DashboardPeriod,
  sales: Sale[],
  now: Date,
): number {
  if (period === "today") return 1;
  if (period === "7d") return 7;
  if (period === "30d") return 30;
  if (sales.length === 0) return 0;

  const firstSaleMs = Math.min(...sales.map((sale) => sale.fecha.toMillis()));
  return Math.max(1, Math.ceil((now.getTime() - firstSaleMs) / MS_PER_DAY) + 1);
}

export function isInPeriod(
  timestamp: Timestamp,
  period: DashboardPeriod,
  now = new Date(),
): boolean {
  const startMs = periodStart(period, now);
  if (startMs === null) return true;
  return timestamp.toMillis() >= startMs && timestamp.toMillis() <= now.getTime();
}

export function buildProductMap(products: Product[]): Record<string, Product> {
  const byId: Record<string, Product> = {};
  for (const product of products) byId[product.id] = product;
  return byId;
}

export function totalDistributionStock(
  distribution: ProductDistribution,
  branch?: Branch,
): number {
  if (branch) return finiteNumber(distribution.cajasPorSucursal[branch]);
  return BRANCHES.reduce(
    (total, currentBranch) =>
      total + finiteNumber(distribution.cajasPorSucursal[currentBranch]),
    0,
  );
}

export function calculateAuditAlerts(
  audits: Audit[],
  options: {
    period?: DashboardPeriod;
    branch?: Branch;
    now?: Date;
  } = {},
): AuditAlert[] {
  const { period = "all", branch, now = new Date() } = options;

  return audits
    .filter((audit) => !audit.resuelta && isInPeriod(audit.fecha, period, now))
    .flatMap((audit) =>
      audit.items
        .filter(
          (item) =>
            item.diferencia !== 0 && (!branch || item.sucursal === branch),
        )
        .map((item) => ({
          auditId: audit.id,
          fecha: audit.fecha,
          item,
        })),
    )
    .sort((a, b) => b.fecha.toMillis() - a.fecha.toMillis());
}

export function calculateDashboardMetrics(params: {
  productsById: Record<string, Product>;
  distributions: ProductDistribution[];
  sales: Sale[];
  bajas: BajaStock[];
  audits: Audit[];
  period: DashboardPeriod;
  branch?: Branch;
  now?: Date;
}): DashboardMetrics {
  const {
    productsById,
    distributions,
    sales,
    bajas,
    audits,
    period,
    branch,
    now = new Date(),
  } = params;
  const periodSales = sales.filter(
    (sale) =>
      isInPeriod(sale.fecha, period, now) && (!branch || sale.sucursal === branch),
  );
  const periodBajas = bajas.filter(
    (baja) =>
      isInPeriod(baja.fecha, period, now) && (!branch || baja.sucursal === branch),
  );

  const stockDisponible = distributions.reduce(
    (total, distribution) => total + totalDistributionStock(distribution, branch),
    0,
  );
  const salesDebtUSD = periodSales.reduce((total, sale) => {
    const productCost = finiteNumber(productsById[sale.productId]?.costoUSD);
    return total + finiteNumber(sale.cajas) * productCost;
  }, 0);
  const revenueUSD = periodSales.reduce(
    (total, sale) => total + finiteNumber(sale.montoUSD),
    0,
  );
  const cajasVendidas = periodSales.reduce(
    (total, sale) => total + finiteNumber(sale.cajas),
    0,
  );
  const branchBajas = periodBajas.filter((baja) => bajaGeneraDeuda(baja));
  const bajaSucursalCajas = branchBajas.reduce(
    (total, baja) => total + finiteNumber(baja.cajas),
    0,
  );
  const bajasDebtUSD = branchBajas.reduce(
    (total, baja) => total + bajaDebtUSD(baja, productsById[baja.productId]),
    0,
  );
  const pendingAuditDifferences = calculateAuditAlerts(audits, {
    period,
    branch,
    now,
  }).length;
  const deudaAllCovering = salesDebtUSD + bajasDebtUSD;

  return {
    stockDisponible,
    deudaAllCovering,
    revenueUSD,
    utilidadBruta: revenueUSD - deudaAllCovering,
    cajasVendidas,
    ventasCount: periodSales.length,
    bajaSucursalCajas,
    bajasCount: periodBajas.length,
    bajasDebtUSD,
    pendingAuditDifferences,
  };
}

export function calculateBranchSummaries(params: {
  distributions: ProductDistribution[];
  sales: Sale[];
  bajas: BajaStock[];
  traslados: TrasladoStock[];
  audits: Audit[];
  period: DashboardPeriod;
  now?: Date;
}): BranchSummary[] {
  const {
    distributions,
    sales,
    bajas,
    traslados,
    audits,
    period,
    now = new Date(),
  } = params;
  const periodSales = sales.filter((sale) => isInPeriod(sale.fecha, period, now));
  const periodBajas = bajas.filter((baja) => isInPeriod(baja.fecha, period, now));
  const periodTraslados = traslados.filter((traslado) =>
    isInPeriod(traslado.fecha, period, now),
  );
  const auditAlerts = calculateAuditAlerts(audits, { period, now });

  return BRANCHES.map((branch) => {
    const branchSales = periodSales.filter((sale) => sale.sucursal === branch);
    const branchBajas = periodBajas.filter(
      (baja) => baja.sucursal === branch && bajaGeneraDeuda(baja),
    );
    const movimientosIn = periodTraslados
      .filter((traslado) => traslado.sucursalDestino === branch)
      .reduce((total, traslado) => total + finiteNumber(traslado.cajas), 0);
    const movimientosOut = periodTraslados
      .filter((traslado) => traslado.sucursalOrigen === branch)
      .reduce((total, traslado) => total + finiteNumber(traslado.cajas), 0);

    return {
      branch,
      label: BRANCH_LABELS[branch],
      ventasCount: branchSales.length,
      cajasVendidas: branchSales.reduce(
        (total, sale) => total + finiteNumber(sale.cajas),
        0,
      ),
      revenueUSD: branchSales.reduce(
        (total, sale) => total + finiteNumber(sale.montoUSD),
        0,
      ),
      stockDisponible: distributions.reduce(
        (total, distribution) =>
          total + totalDistributionStock(distribution, branch),
        0,
      ),
      bajaSucursalCajas: branchBajas.reduce(
        (total, baja) => total + finiteNumber(baja.cajas),
        0,
      ),
      movimientosIn,
      movimientosOut,
      pendingAuditDifferences: auditAlerts.filter(
        (alert) => alert.item.sucursal === branch,
      ).length,
    };
  });
}

export function calculateProductStats(params: {
  products: Product[];
  productsById: Record<string, Product>;
  distributions: ProductDistribution[];
  sales: Sale[];
  bajas: BajaStock[];
  period: DashboardPeriod;
  branch?: Branch;
  now?: Date;
}): ProductStat[] {
  const {
    products,
    productsById,
    distributions,
    sales,
    bajas,
    period,
    branch,
    now = new Date(),
  } = params;
  const periodSales = sales.filter(
    (sale) =>
      isInPeriod(sale.fecha, period, now) && (!branch || sale.sucursal === branch),
  );
  const periodBajas = bajas.filter(
    (baja) =>
      isInPeriod(baja.fecha, period, now) && (!branch || baja.sucursal === branch),
  );
  const days = averageSalesDays(period, periodSales, now);
  const stockByProduct = distributions.reduce<Record<string, number>>(
    (acc, distribution) => {
      acc[distribution.productId] = totalDistributionStock(distribution, branch);
      return acc;
    },
    {},
  );

  return products
    .map((product) => {
      const productSales = periodSales.filter(
        (sale) => sale.productId === product.id,
      );
      const productBajas = periodBajas.filter(
        (baja) => baja.productId === product.id && bajaGeneraDeuda(baja),
      );
      const cajasVendidas = productSales.reduce(
        (total, sale) => total + finiteNumber(sale.cajas),
        0,
      );
      const revenueUSD = productSales.reduce(
        (total, sale) => total + finiteNumber(sale.montoUSD),
        0,
      );
      const salesDebt = cajasVendidas * finiteNumber(product.costoUSD);
      const bajaDebt = productBajas.reduce(
        (total, baja) => total + bajaDebtUSD(baja, productsById[baja.productId]),
        0,
      );
      const deudaUSD = salesDebt + bajaDebt;
      const stockActual = stockByProduct[product.id] ?? 0;
      const denominator = cajasVendidas + stockActual;
      const averageDailySales = days > 0 ? cajasVendidas / days : 0;

      return {
        productId: product.id,
        producto: product.nombre,
        cajasVendidas,
        rotacion: denominator > 0 ? cajasVendidas / denominator : 0,
        stockActual,
        diasStock:
          averageDailySales > 0 ? stockActual / averageDailySales : null,
        revenueUSD,
        deudaUSD,
        utilidadBruta: revenueUSD - deudaUSD,
      };
    })
    .filter((stat) => stat.cajasVendidas > 0 || stat.stockActual > 0)
    .sort(
      (a, b) =>
        b.cajasVendidas - a.cajasVendidas ||
        b.revenueUSD - a.revenueUSD ||
        a.producto.localeCompare(b.producto),
    );
}

export function calculateStockAlerts(params: {
  productsById: Record<string, Product>;
  distributions: ProductDistribution[];
  sales?: Sale[];
  branch?: Branch;
  lowStockThreshold?: number;
  now?: Date;
}): StockAlert[] {
  const {
    productsById,
    distributions,
    sales = [],
    branch,
    lowStockThreshold = 5,
    now = new Date(),
  } = params;

  const alerts = distributions.flatMap((distribution) => {
    const totalStock = totalDistributionStock(distribution, branch);
    const producto =
      productsById[distribution.productId]?.nombre ?? distribution.productId;
    const productAlerts: StockAlert[] = [];

    if (totalStock === 0) {
      productAlerts.push({
        productId: distribution.productId,
        producto,
        totalStock,
        type: "sin_stock",
      });
    }

    if (totalStock > 0 && totalStock <= lowStockThreshold) {
      productAlerts.push({
        productId: distribution.productId,
        producto,
        totalStock,
        type: "stock_bajo",
      });
    }

    const hasRecentSales = sales.some(
      (sale) =>
        sale.productId === distribution.productId &&
        (!branch || sale.sucursal === branch) &&
        isInPeriod(sale.fecha, "30d", now),
    );
    if (totalStock > 0 && !hasRecentSales) {
      productAlerts.push({
        productId: distribution.productId,
        producto,
        totalStock,
        type: "sin_movimiento",
      });
    }

    return productAlerts;
  });

  const priority: Record<StockAlertType, number> = {
    sin_stock: 0,
    stock_bajo: 1,
    sin_movimiento: 2,
  };

  return alerts.sort(
    (a, b) =>
      priority[a.type] - priority[b.type] ||
      a.totalStock - b.totalStock ||
      a.producto.localeCompare(b.producto),
  );
}

export function calculateOperationalLosses(params: {
  productsById: Record<string, Product>;
  bajas: BajaStock[];
  period: DashboardPeriod;
  branch?: Branch;
  now?: Date;
}): OperationalLossRow[] {
  const { productsById, bajas, period, branch, now = new Date() } = params;

  return bajas
    .filter(
      (baja) =>
        bajaTipo(baja) === "baja_sucursal" &&
        isInPeriod(baja.fecha, period, now) &&
        (!branch || baja.sucursal === branch),
    )
    .map((baja) => ({
      id: baja.id,
      producto: productsById[baja.productId]?.nombre ?? baja.productId,
      sucursal: baja.sucursal,
      cajas: finiteNumber(baja.cajas),
      usdPerdido: bajaDebtUSD(baja, productsById[baja.productId]),
      fecha: baja.fecha,
    }))
    .sort((a, b) => b.fecha.toMillis() - a.fecha.toMillis());
}

export function calculateRecentActivity(params: {
  productsById: Record<string, Product>;
  sales?: Sale[];
  ingresos?: IngresoStock[];
  bajas?: BajaStock[];
  traslados?: TrasladoStock[];
  audits?: Audit[];
  period: DashboardPeriod;
  branch?: Branch;
  now?: Date;
  limit?: number;
}): RecentActivityRow[] {
  const {
    productsById,
    sales = [],
    ingresos = [],
    bajas = [],
    traslados = [],
    audits = [],
    period,
    branch,
    now = new Date(),
    limit = 10,
  } = params;

  const rows: RecentActivityRow[] = [
    ...sales
      .filter(
        (sale) =>
          isInPeriod(sale.fecha, period, now) &&
          (!branch || sale.sucursal === branch),
      )
      .map((sale) => ({
        id: sale.id,
        tipo: "venta" as const,
        fecha: sale.fecha,
        detalle: productsById[sale.productId]?.nombre ?? sale.productId,
        sucursalDetalle: BRANCH_LABELS[sale.sucursal],
        cajas: sale.cajas,
        importeUSD: finiteNumber(sale.montoUSD),
        createdBy: sale.createdBy,
      })),
    ...ingresos
      .filter(
        (ingreso) =>
          isInPeriod(ingreso.fecha, period, now) &&
          (!branch || ingreso.sucursal === branch),
      )
      .map((ingreso) => ({
        id: ingreso.id,
        tipo: "ingreso" as const,
        fecha: ingreso.fecha,
        detalle: productsById[ingreso.productId]?.nombre ?? ingreso.productId,
        sucursalDetalle: BRANCH_LABELS[ingreso.sucursal],
        cajas: ingreso.cajas,
        importeUSD: finiteNumber(ingreso.costoTotalUSD),
        createdBy: ingreso.createdBy,
      })),
    ...bajas
      .filter(
        (baja) =>
          isInPeriod(baja.fecha, period, now) &&
          (!branch || baja.sucursal === branch),
      )
      .map((baja) => {
        const tipo = bajaTipo(baja);
        const motivo = bajaMotivoLabel(baja);
        return {
          id: baja.id,
          tipo: "baja" as const,
          fecha: baja.fecha,
          detalle: `${productsById[baja.productId]?.nombre ?? baja.productId} - ${
            BAJA_TIPO_LABELS[tipo]
          }${motivo !== "-" ? ` (${motivo})` : ""}`,
          sucursalDetalle: BRANCH_LABELS[baja.sucursal],
          cajas: baja.cajas,
          importeUSD: bajaDebtUSD(baja, productsById[baja.productId]),
          createdBy: baja.createdBy,
        };
      }),
    ...traslados
      .filter(
        (traslado) =>
          isInPeriod(traslado.fecha, period, now) &&
          (!branch ||
            traslado.sucursalOrigen === branch ||
            traslado.sucursalDestino === branch),
      )
      .map((traslado) => ({
        id: traslado.id,
        tipo: "movimiento" as const,
        fecha: traslado.fecha,
        detalle: productsById[traslado.productId]?.nombre ?? traslado.productId,
        sucursalDetalle: `${BRANCH_LABELS[traslado.sucursalOrigen]} -> ${
          BRANCH_LABELS[traslado.sucursalDestino]
        }`,
        cajas: traslado.cajas,
        createdBy: traslado.createdBy,
      })),
    ...audits
      .filter(
        (audit) =>
          isInPeriod(audit.fecha, period, now) &&
          (!branch || audit.items.some((item) => item.sucursal === branch)),
      )
      .map((audit) => ({
        id: audit.id,
        tipo: "auditoria" as const,
        fecha: audit.fecha,
        detalle: `Auditoria: ${audit.items.length} items`,
        sucursalDetalle: `${
          audit.items.filter((item) => item.diferencia !== 0).length
        } diferencias`,
        createdBy: audit.createdBy,
      })),
  ];

  return rows
    .sort((a, b) => b.fecha.toMillis() - a.fecha.toMillis())
    .slice(0, limit);
}
