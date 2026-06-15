const vndFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatMoney(value: number) {
  return vndFormatter.format(Number(value || 0));
}

export function formatCount(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(Number(value || 0));
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";

  const rawValue = typeof value === "string" ? value.trim() : value;
  if (!rawValue) return "-";

  const date =
    typeof rawValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawValue)
      ? new Date(`${rawValue}T00:00:00`)
      : new Date(rawValue);

  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatMeasurement(value: number, unit?: string, maximumFractionDigits = 2) {
  const formattedValue = formatCount(value, maximumFractionDigits);
  return unit ? `${formattedValue} ${unit}` : formattedValue;
}
