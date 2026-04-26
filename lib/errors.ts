import { StockAvailabilityError } from "@/lib/calculations";

const DEFAULT_ERROR_MESSAGE =
  "Ocurrió un error inesperado. Intentá nuevamente.";

function errorCode(error: unknown): string {
  if (typeof error !== "object" || error === null) return "";
  const value = "code" in error ? error.code : undefined;
  return typeof value === "string" ? value.toLowerCase() : "";
}

function errorName(error: unknown): string {
  if (typeof error !== "object" || error === null) return "";
  const value = "name" in error ? error.name : undefined;
  return typeof value === "string" ? value : "";
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "";
}

export function getErrorMessage(
  error: unknown,
  fallback = DEFAULT_ERROR_MESSAGE,
): string {
  if (error instanceof StockAvailabilityError) {
    return "No hay stock suficiente en la sucursal seleccionada.";
  }

  const code = errorCode(error);
  const name = errorName(error);
  const message = errorText(error);
  const normalized = `${code} ${message}`.toLowerCase();

  if (
    code.includes("permission-denied") ||
    normalized.includes("missing or insufficient permissions")
  ) {
    return "No tenés permisos para hacer esta acción.";
  }

  if (code.includes("unauthenticated")) {
    return "Tu sesión expiró o no estás autenticado. Volvé a iniciar sesión.";
  }

  if (
    code.includes("unavailable") ||
    code.includes("network-request-failed")
  ) {
    return "No se pudo conectar con el servidor. Revisá tu conexión e intentá nuevamente.";
  }

  if (
    code.includes("auth/invalid-credential") ||
    code.includes("auth/wrong-password") ||
    code.includes("auth/user-not-found") ||
    code.includes("auth/invalid-email")
  ) {
    return "Email o contraseña incorrectos.";
  }

  if (code.includes("not-found")) {
    return "No se encontró la información solicitada.";
  }

  if (code.includes("already-exists")) {
    return "Ese registro ya existe.";
  }

  if (code.includes("invalid-argument")) {
    return "Hay datos inválidos. Revisá los campos e intentá nuevamente.";
  }

  if (code.includes("deadline-exceeded")) {
    return "La operación tardó demasiado. Intentá nuevamente.";
  }

  if (name === "StockAvailabilityError") {
    return "No hay stock suficiente en la sucursal seleccionada.";
  }

  if (message === "Not authenticated") {
    return "Tenés que iniciar sesión para continuar.";
  }

  return fallback;
}

export function logError(context: string, error: unknown): void {
  console.error(`[${context}]`, error);
}
