export function fmt(n: number | null | undefined, d = 2): string {
  if (n == null || isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
}
export function fmtCr(n: number | null | undefined): string {
  if (!n) return '—';
  if (n >= 1e7) return `₨ ${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₨ ${(n / 1e5).toFixed(2)} L`;
  return `₨ ${fmt(n, 0)}`;
}
export function changePct(open: number, close: number): number {
  if (!open) return 0;
  return ((close - open) / open) * 100;
}
export function changeColor(pct: number): string {
  return pct > 0 ? '#16a34a' : pct < 0 ? '#dc2626' : '#6b7280';
}
