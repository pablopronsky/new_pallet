import type { Branch, Role, Product, ProductCategory } from "@/types/domain";

export const BRANCHES: Branch[] = ["gonnet", "laplata", "quilmes"];

export const BRANCH_LABELS: Record<Branch, string> = {
  gonnet: "Gonnet",
  laplata: "La Plata",
  quilmes: "Quilmes",
};

export const ROLES: Role[] = ["admin", "controlador", "vendedor", "allcovering"];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  controlador: "Controlador",
  vendedor: "Vendedor",
  allcovering: "All Covering",
};

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  SPC: "SPC",
  Laminado: "Laminado",
  "SPC Budget": "SPC Oferta",
};

export const BUDGET_PRODUCT_LABEL = "Oferta";

export type InitialProduct = Omit<Product, "id" | "createdAt" | "updatedAt">;

export const INITIAL_PRODUCTS: InitialProduct[] = [
  {
    nombre: "Chakra",
    categoria: "SPC",
    costoUSD: 0,
    precioVentaUSD: 0,
    esBudget: false,
    activo: true,
  },
  {
    nombre: "Roble Argentino",
    categoria: "SPC",
    costoUSD: 0,
    precioVentaUSD: 0,
    esBudget: false,
    activo: true,
  },
  {
    nombre: "Budgay",
    categoria: "Laminado",
    costoUSD: 0,
    precioVentaUSD: 0,
    esBudget: false,
    activo: true,
  },
  {
    nombre: "Karayael",
    categoria: "Laminado",
    costoUSD: 0,
    precioVentaUSD: 0,
    esBudget: false,
    activo: true,
  },
  {
    nombre: "Atlas",
    categoria: "Laminado",
    costoUSD: 0,
    precioVentaUSD: 0,
    esBudget: false,
    activo: true,
  },
  {
    nombre: "Dogal",
    categoria: "Laminado",
    costoUSD: 0,
    precioVentaUSD: 0,
    esBudget: false,
    activo: true,
  },
  {
    nombre: "Económico",
    categoria: "SPC Budget",
    costoUSD: 0,
    precioVentaUSD: 0,
    esBudget: true,
    activo: true,
  },
];

export const DEFAULT_TIPO_CAMBIO_USD = 1000;

export const CONFIG_DOC_ID = "app";
