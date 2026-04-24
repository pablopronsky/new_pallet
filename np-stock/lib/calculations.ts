import type { Product, ProductDistribution, Sale } from "@/types/domain";

export type SoldBoxesByProduct = Record<string, number>;
export type RevenueByProduct = Record<string, number>;

export function calculateSoldBoxesByProduct(sales: Sale[]): SoldBoxesByProduct {
  const totals: SoldBoxesByProduct = {};
  for (const sale of sales) {
    totals[sale.productId] = (totals[sale.productId] ?? 0) + sale.cajas;
  }
  return totals;
}

export function calculateRevenueByProduct(sales: Sale[]): RevenueByProduct {
  const totals: RevenueByProduct = {};
  for (const sale of sales) {
    totals[sale.productId] = (totals[sale.productId] ?? 0) + sale.montoUSD;
  }
  return totals;
}

export function calculateTotalAvailableBoxes(distribution: ProductDistribution): number {
  return Object.values(distribution.cajasPorSucursal).reduce(
    (acc, n) => acc + n,
    0,
  );
}

export function calculateRemainingBoxes(
  totalAvailableBoxes: number,
  soldBoxes: number,
): number {
  return Math.max(0, totalAvailableBoxes - soldBoxes);
}

export function calculateDebtUSD(product: Product, soldBoxes: number): number {
  return soldBoxes * product.costoUSD;
}

export function calculateRevenueUSD(sales: Sale[]): number {
  return sales.reduce((acc, s) => acc + s.montoUSD, 0);
}

export function calculateGrossProfitUSD(
  product: Product,
  soldBoxes: number,
  revenueUSD: number,
): number {
  return revenueUSD - calculateDebtUSD(product, soldBoxes);
}

export function calculateSellThrough(
  soldBoxes: number,
  remainingBoxes: number,
): number {
  const denominator = soldBoxes + remainingBoxes;
  if (denominator <= 0) return 0;
  return soldBoxes / denominator;
}

export class StockAvailabilityError extends Error {
  readonly totalAvailable: number;
  readonly currentSold: number;
  readonly newSale: number;

  constructor(params: {
    totalAvailable: number;
    currentSold: number;
    newSale: number;
  }) {
    const remaining = Math.max(0, params.totalAvailable - params.currentSold);
    super(
      `Sale of ${params.newSale} boxes exceeds available stock (remaining: ${remaining}).`,
    );
    this.name = "StockAvailabilityError";
    this.totalAvailable = params.totalAvailable;
    this.currentSold = params.currentSold;
    this.newSale = params.newSale;
  }
}

export function validateStockAvailability(params: {
  totalAvailable: number;
  currentSold: number;
  newSale: number;
}): void {
  const { totalAvailable, currentSold, newSale } = params;
  if (newSale <= 0) {
    throw new StockAvailabilityError(params);
  }
  if (currentSold + newSale > totalAvailable) {
    throw new StockAvailabilityError(params);
  }
}
