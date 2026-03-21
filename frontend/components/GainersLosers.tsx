'use client';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { fmt } from '@/lib/api';

interface Item {
  symbol: string;
  close_price: number;
  change_pct: number;
  volume: number;
}

interface Props {
  gainers: Item[];
  losers: Item[];
}

function List({ items, type }: { items: Item[]; type: 'gain'|'loss' }) {
  const isGain = type === 'gain';
  const col    = isGain ? 'var(--green)' : 'var(--red)';

  return (
    <div className="card p-4 flex flex-col gap-3 animate-fadeUp" style={{ animationDelay: isGain ? '100ms' : '200ms' }}>
      <div className="flex items-center gap-2 mb-1">
        {isGain
          ? <TrendingUp size={18} style={{ color: col }}/>
          : <TrendingDown size={18} style={{ color: col }}/>}
        <h3 className="font-bold text-sm tracking-wide" style={{ color: col }}>
          {isGain ? 'Top Gainers' : 'Top Losers'}
        </h3>
      </div>
      {items.length === 0 && (
        <p className="text-xs font-mono" style={{ color: 'var(--dim)' }}>No data</p>
      )}
      {items.map((s, i) => (
        <div
          key={s.symbol}
          className="flex items-center justify-between py-2 text-sm"
          style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}
        >
          <div>
            <div className="font-bold font-mono text-xs" style={{ color: 'var(--accent)' }}>{s.symbol}</div>
            <div className="text-xs font-mono" style={{ color: 'var(--dim)' }}>LTP: {fmt(s.close_price)}</div>
          </div>
          <div
            className="font-bold font-mono text-sm px-3 py-1 rounded-full"
            style={{ color: col, background: `${col}18` }}
          >
            {isGain ? '+' : ''}{Number(s.change_pct).toFixed(2)}%
          </div>
        </div>
      ))}
    </div>
  );
}

export default function GainersLosers({ gainers, losers }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <List items={gainers} type="gain"/>
      <List items={losers}  type="loss"/>
    </div>
  );
}
