'use client';
import { changePct, changeColor, fmt } from '@/lib/api';

interface Stock {
  symbol: string;
  close_price: number;
  open_price: number;
}

interface Props { stocks: Stock[]; }

export default function TickerTape({ stocks }: Props) {
  if (!stocks.length) return null;

  const items = [...stocks, ...stocks];

  return (
    <div
      className="overflow-hidden py-2"
      style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="flex animate-ticker whitespace-nowrap" style={{ width: 'max-content' }}>
        {items.map((s, i) => {
          const pct = changePct(s.open_price, s.close_price);
          const col = changeColor(pct);
          return (
            <span key={i} className="inline-flex items-center gap-2 mx-6 text-xs font-mono">
              <span style={{ color: 'var(--accent)' }}>{s.symbol}</span>
              <span style={{ color: 'var(--text)' }}>{fmt(s.close_price)}</span>
              <span style={{ color: col }}>{pct >= 0 ? '▲' : '▼'}{Math.abs(pct).toFixed(2)}%</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
