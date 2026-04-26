import type { BajaMotivo, BajaStock, BajaTipo, Product } from "@/types/domain";

type LegacyBajaMotivo = BajaMotivo | "devolucion_proveedor";

export const BAJA_TIPO_LABELS: Record<BajaTipo, string> = {
  devolucion_proveedor: "Devolución a proveedor",
  baja_sucursal: "Baja de sucursal",
};

export const BAJA_MOTIVO_LABELS: Record<BajaMotivo, string> = {
  rotura: "Rotura",
  perdida: "Pérdida",
  muestra: "Muestra",
  ajuste: "Ajuste",
  otro: "Otro",
};

export const BAJA_MOTIVOS: BajaMotivo[] = [
  "rotura",
  "perdida",
  "muestra",
  "ajuste",
  "otro",
];

export const BAJA_TIPOS: BajaTipo[] = [
  "devolucion_proveedor",
  "baja_sucursal",
];

function legacyMotivo(baja: BajaStock): LegacyBajaMotivo | undefined {
  return baja.motivo as LegacyBajaMotivo | undefined;
}

export function bajaTipo(baja: BajaStock): BajaTipo {
  if (baja.tipo === "devolucion_proveedor" || baja.tipo === "baja_sucursal") {
    return baja.tipo;
  }

  return legacyMotivo(baja) === "devolucion_proveedor"
    ? "devolucion_proveedor"
    : "baja_sucursal";
}

export function bajaGeneraDeuda(baja: BajaStock): boolean {
  if (typeof baja.generaDeuda === "boolean") return baja.generaDeuda;
  return bajaTipo(baja) === "baja_sucursal";
}

export function bajaMotivoLabel(baja: BajaStock): string {
  const motivo = legacyMotivo(baja);
  if (!motivo) return "-";
  if (motivo === "devolucion_proveedor") return BAJA_TIPO_LABELS.devolucion_proveedor;
  return BAJA_MOTIVO_LABELS[motivo] ?? motivo;
}

export function bajaDebtUSD(
  baja: BajaStock,
  product: Product | undefined,
): number {
  if (!bajaGeneraDeuda(baja)) return 0;

  if (typeof baja.deudaUSD === "number" && Number.isFinite(baja.deudaUSD)) {
    return baja.deudaUSD;
  }

  if (
    typeof baja.costoUSDPorCaja === "number" &&
    Number.isFinite(baja.costoUSDPorCaja)
  ) {
    return baja.cajas * baja.costoUSDPorCaja;
  }

  const productCost = product?.costoUSD;
  if (typeof productCost === "number" && Number.isFinite(productCost)) {
    return baja.cajas * productCost;
  }

  return 0;
}
