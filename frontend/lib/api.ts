const BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

export async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

export function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null || isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtCr(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return '—';
  const v = Number(n);
  if (v >= 1e7) return `₨ ${(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `₨ ${(v / 1e5).toFixed(2)} L`;
  return `₨ ${fmt(v, 0)}`;
}

export function changePct(open: number, close: number): number {
  if (!open) return 0;
  return ((close - open) / open) * 100;
}

export function changeColor(pct: number): string {
  if (pct > 0) return '#00d4aa';
  if (pct < 0) return '#ff4d6d';
  return '#94a3b8';
}
