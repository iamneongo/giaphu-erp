export function formatMoney(value: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}

export function formatCount(value: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}
