import type { Timestamp } from "firebase/firestore";

export type Role = "admin" | "controlador" | "allcovering";

export type Branch = "gonnet" | "laplata" | "quilmes";

export type ProductCategory = "SPC" | "Laminado" | "SPC Budget";

export interface Product {
  id: string;
  nombre: string;
  categoria: ProductCategory;
  costoUSD: number;
  precioVentaUSD: number;
  esBudget: boolean;
  activo: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type BranchBoxes = Record<Branch, number>;

export interface ProductDistribution {
  id: string;
  productId: string;
  cajasPorSucursal: BranchBoxes;
  updatedAt?: Timestamp;
}

export interface Sale {
  id: string;
  productId: string;
  sucursal: Branch;
  cajas: number;
  montoUSD: number;
  tipoCambioUSD: number;
  montoARS: number;
  fecha: Timestamp;
  createdBy: string;
  notas?: string;
}

export interface AuditItem {
  productId: string;
  sucursal: Branch;
  cajasSistema: number;
  cajasContadas: number;
  diferencia: number;
  notas?: string;
}

export interface Audit {
  id: string;
  items: AuditItem[];
  fecha: Timestamp;
  createdBy: string;
  cerrada: boolean;
  notas?: string;
  resuelta?: boolean;
  resolvedAt?: Timestamp;
  resolvedBy?: string;
}

export interface AppConfig {
  id: string;
  tipoCambioUSD: number;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  nombre?: string;
  role: Role;
  sucursalAsignada?: Branch;
  activo: boolean;
  createdAt?: Timestamp;
}
