import { bajaDebtUSD } from "@/lib/bajas";
import type {
  BajaStock,
  LiquidacionProveedor,
  Product,
  ProviderSnapshot,
  Sale,
} from "@/types/domain";

export interface ProviderDebtSummary {
  deudaGeneradaUSD: number;
  liquidadoUSD: number;
  saldoPendienteUSD: number;
  porcentajeLiquidado: number | null;
  cajasVendidas: number;
  cajasRestantes?: number;
  cajasEquivalentesLiquidadas: number | null;
  ultimaLiquidacion?: LiquidacionProveedor;
}

export interface CalculateProviderDebtSummaryParams {
  products?: Product[];
  ventas?: Sale[];
  bajas?: BajaStock[];
  liquidaciones: LiquidacionProveedor[];
  proveedorResumen?: ProviderSnapshot[];
}

function finiteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function productMap(products: Product[] = []): Record<string, Product> {
  const map: Record<string, Product> = {};
  for (const product of products) map[product.id] = product;
  return map;
}

function latestLiquidacion(
  liquidaciones: LiquidacionProveedor[],
): LiquidacionProveedor | undefined {
  return [...liquidaciones].sort(
    (a, b) => b.fecha.toMillis() - a.fecha.toMillis(),
  )[0];
}

export function calculateProviderDebtSummary(
  params: CalculateProviderDebtSummaryParams,
): ProviderDebtSummary {
  const {
    products = [],
    ventas,
    bajas,
    liquidaciones,
    proveedorResumen = [],
  } = params;
  const productsById = productMap(products);
  const hasRawDebtSources = Array.isArray(ventas) && Array.isArray(bajas);

  const ventasDebtUSD = (ventas ?? []).reduce((total, venta) => {
    const productCost = finiteNumber(productsById[venta.productId]?.costoUSD);
    return total + finiteNumber(venta.cajas) * productCost;
  }, 0);
  const bajasDebtUSD = (bajas ?? []).reduce(
    (total, baja) => total + bajaDebtUSD(baja, productsById[baja.productId]),
    0,
  );
  const resumenDebtUSD = proveedorResumen.reduce(
    (total, row) => total + finiteNumber(row.deudaUSD),
    0,
  );
  const deudaGeneradaUSD = hasRawDebtSources
    ? ventasDebtUSD + bajasDebtUSD
    : resumenDebtUSD;

  const cajasVendidas = hasRawDebtSources
    ? (ventas ?? []).reduce((total, venta) => total + finiteNumber(venta.cajas), 0)
    : proveedorResumen.reduce(
        (total, row) => total + finiteNumber(row.cajasVendidas),
        0,
      );
  const cajasRestantes =
    proveedorResumen.length > 0
      ? proveedorResumen.reduce(
          (total, row) => total + finiteNumber(row.cajasRestantes),
          0,
        )
      : undefined;
  const liquidadoUSD = liquidaciones.reduce(
    (total, liquidacion) => total + finiteNumber(liquidacion.montoUSD),
    0,
  );
  const saldoPendienteUSD = deudaGeneradaUSD - liquidadoUSD;
  const porcentajeLiquidado =
    deudaGeneradaUSD > 0 ? liquidadoUSD / deudaGeneradaUSD : null;
  const cajasEquivalentesLiquidadas =
    porcentajeLiquidado !== null ? cajasVendidas * porcentajeLiquidado : null;

  return {
    deudaGeneradaUSD,
    liquidadoUSD,
    saldoPendienteUSD,
    porcentajeLiquidado,
    cajasVendidas,
    ...(cajasRestantes !== undefined ? { cajasRestantes } : {}),
    cajasEquivalentesLiquidadas,
    ultimaLiquidacion: latestLiquidacion(liquidaciones),
  };
}
