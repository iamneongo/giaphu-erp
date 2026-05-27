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
