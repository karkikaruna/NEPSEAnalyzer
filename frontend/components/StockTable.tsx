'use client';
import { useState, useEffect, useCallback } from 'react';
import { Search, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { fmt, fmtCr, changePct, changeColor } from '@/lib/api';

interface Stock {
  symbol: string;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  volume: number;
  turnover: number;
}

interface Props { tradingDate: string; }

type SortKey = 'symbol' | 'close_price' | 'volume' | 'turnover' | 'change_pct';

export default function StockTable({ tradingDate }: Props) {
  const [data, setData]       = useState<Stock[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [sortBy, setSortBy]   = useState<SortKey>('turnover');
  const [order, setOrder]     = useState<'asc'|'desc'>('desc');
  const [page, setPage]       = useState(0);
  const PAGE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sym = search ? `&symbol=${search}` : '';
      const sb  = sortBy === 'change_pct' ? 'turnover' : sortBy;
      const res = await fetch(`/api/stocks?trading_date=${tradingDate}&sort_by=${sb}&order=${order}&limit=${PAGE}&offset=${page * PAGE}${sym}`);
      const json = await res.json();
      setData(json.data ?? []);
      setTotal(json.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [tradingDate, search, sortBy, order, page]);

  useEffect(() => { load(); }, [load]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setOrder('desc'); }
    setPage(0);
  };

  const sorted = sortBy === 'change_pct'
    ? [...data].sort((a, b) => {
        const pa = changePct(a.open_price, a.close_price);
        const pb = changePct(b.open_price, b.close_price);
        return order === 'asc' ? pa - pb : pb - pa;
      })
    : data;

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortBy === col
      ? order === 'desc' ? <ChevronDown size={12}/> : <ChevronUp size={12}/>
      : <ArrowUpDown size={12} style={{ opacity: .4 }}/>;

  const Th = ({ col, label }: { col: SortKey; label: string }) => (
    <th
      className="px-4 py-3 text-left text-xs font-mono uppercase tracking-wider cursor-pointer select-none whitespace-nowrap"
      style={{ color: sortBy === col ? 'var(--accent)' : 'var(--dim)', borderBottom: '1px solid var(--border)' }}
      onClick={() => handleSort(col)}
    >
      <span className="flex items-center gap-1">{label}<SortIcon col={col}/></span>
    </th>
  );

  const totalPages = Math.ceil(total / PAGE);

  return (
    <div className="card animate-fadeUp" style={{ animationDelay: '300ms' }}>
      <div className="flex items-center justify-between p-4 gap-3 flex-wrap" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <h2 className="font-bold text-lg">All Stocks</h2>
          <p className="text-xs font-mono" style={{ color: 'var(--dim)' }}>{total} symbols</p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--dim)' }}/>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search symbol…"
            className="pl-8 pr-4 py-2 text-sm rounded-lg font-mono bg-transparent outline-none"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', width: 200 }}
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--surface)' }}>
              <Th col="symbol"     label="Symbol"/>
              <Th col="close_price" label="LTP"/>
              <Th col="change_pct" label="Change %"/>
              <th className="px-4 py-3 text-left text-xs font-mono uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--dim)', borderBottom: '1px solid var(--border)' }}>Open</th>
              <th className="px-4 py-3 text-left text-xs font-mono uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--dim)', borderBottom: '1px solid var(--border)' }}>High</th>
              <th className="px-4 py-3 text-left text-xs font-mono uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--dim)', borderBottom: '1px solid var(--border)' }}>Low</th>
              <Th col="volume"     label="Volume"/>
              <Th col="turnover"   label="Turnover"/>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 rounded animate-pulse" style={{ background: 'var(--border)', width: j === 0 ? 60 : 80 }}/>
                      </td>
                    ))}
                  </tr>
                ))
              : sorted.map((s, i) => {
                  const pct = changePct(s.open_price, s.close_price);
                  const col = changeColor(pct);
                  return (
                    <tr
                      key={s.symbol}
                      className="transition-colors"
                      style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <td className="px-4 py-3 font-bold font-mono text-xs tracking-wider" style={{ color: 'var(--accent)' }}>{s.symbol}</td>
                      <td className="px-4 py-3 font-mono font-bold">{fmt(s.close_price)}</td>
                      <td className="px-4 py-3 font-mono font-bold" style={{ color: col }}>
                        {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--dim)' }}>{fmt(s.open_price)}</td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--green)' }}>{fmt(s.high_price)}</td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--red)' }}>{fmt(s.low_price)}</td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--dim)' }}>{s.volume?.toLocaleString() ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{fmtCr(s.turnover)}</td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-xs font-mono" style={{ color: 'var(--dim)' }}>
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 text-xs font-mono rounded transition-opacity disabled:opacity-30"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >← Prev</button>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 text-xs font-mono rounded transition-opacity disabled:opacity-30"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}
            >Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}
