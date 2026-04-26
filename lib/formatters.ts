const LOCALE = "es-AR";

const moneyFormatter = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentNumberFormatter = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const numberFormatter = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 2,
});

export function formatDateAR(date: Date): string {
  return dateFormatter.format(date);
}

export function formatUSD(value: number): string {
  return `USD ${moneyFormatter.format(value)}`;
}

export function formatARS(value: number): string {
  return `$ ${moneyFormatter.format(value)}`;
}

// `value` is a ratio (0..1). formatPercent(0.8123) -> "81,2%"
export function formatPercent(value: number): string {
  return `${percentNumberFormatter.format(value * 100)}%`;
}

export function formatNumberAR(value: number): string {
  return numberFormatter.format(value);
}
