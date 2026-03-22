'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import CandlestickChart from '@/components/CandlestickChart';
import { fmt, fmtCr, changePct, changeColor } from '@/lib/api';
import { Star, Trash2, RefreshCw, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';

interface WatchItem {
  symbol: string; added_at: string;
  open_price: number | null; high_price: number | null;
  low_price: number | null; close_price: number | null;
  volume: number | null; turnover: number | null; trading_date: string | null;
}

export default function WatchlistPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [items,     setItems]     = useState<WatchItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [removing,  setRemoving]  = useState<string | null>(null);
  const [date,      setDate]      = useState('');
  const [expanded,  setExpanded]  = useState<Record<string, boolean>>({});

  useEffect(() => { if (!authLoading && !user) router.push('/login'); }, [user, authLoading, router]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res  = await fetch('/nepse/watchlist', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      setItems(json.data ?? []);
      setDate(json.trading_date ?? '');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { if (user) load(); }, [user, load]);

  const remove = async (symbol: string) => {
    setRemoving(symbol);
    await fetch(`/nepse/watchlist/${symbol}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setItems(i => i.filter(x => x.symbol !== symbol));
    setRemoving(null);
  };

  const toggleChart = (sym: string) => setExpanded(prev => ({ ...prev, [sym]: !prev[sym] }));

  if (authLoading || !user) return null;

  const withData  = items.filter(i => i.close_price !== null);
  const gainCount = withData.filter(i => (i.close_price ?? 0) > (i.open_price ?? 0)).length;
  const lossCount = withData.filter(i => (i.close_price ?? 0) < (i.open_price ?? 0)).length;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0e1a' }}>
      <Sidebar/>
      <main style={{ marginLeft: 220, flex: 1, padding: '28px', overflowY: 'auto' }}>

      
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Star size={20} color="#f5c842"/> My Watchlist
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>
              {user.username} · {items.length} stocks · data for {date || '—'}
            </div>
          </div>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1px solid #1e2d45', background: '#161d2e', color: '#94a3b8', fontSize: 12, fontFamily: 'monospace', cursor: 'pointer' }}>
            <RefreshCw size={12}/> Refresh
          </button>
        </div>

      
        {items.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Stocks tracked', value: String(items.length),          color: '#00d4aa' },
              { label: 'Gainers / Losers', value: `${gainCount} / ${lossCount}`, color: gainCount >= lossCount ? '#00d4aa' : '#ff4d6d' },
              { label: 'No data yet',    value: String(items.length - withData.length), color: '#94a3b8' },
            ].map(c => (
              <div key={c.label} style={{ background: '#161d2e', border: '1px solid #1e2d45', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{c.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: c.color, fontFamily: 'monospace' }}>{c.value}</div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontFamily: 'monospace', fontSize: 12 }}>Loading…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', background: '#161d2e', border: '1px solid #1e2d45', borderRadius: 12 }}>
            <Star size={32} style={{ color: '#1e2d45', marginBottom: 12 }}/>
            <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>No stocks yet</div>
            <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>Go to Dashboard → add companies from the dropdown</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(item => {
              const pct    = changePct(item.open_price ?? 0, item.close_price ?? 0);
              const col    = changeColor(pct);
              const noData = item.close_price === null;
              const open   = expanded[item.symbol];

              return (
                <div key={item.symbol} style={{ background: '#161d2e', border: `1px solid ${open ? '#1e3a5f' : '#1e2d45'}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color .2s' }}>

              
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 90px 90px 110px 110px auto auto', alignItems: 'center', padding: '12px 16px', gap: 8 }}>

                  
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button onClick={() => toggleChart(item.symbol)} style={{
                        background: open ? 'rgba(0,212,170,.15)' : '#111827',
                        border: `1px solid ${open ? 'rgba(0,212,170,.3)' : '#1e2d45'}`,
                        borderRadius: 6, padding: '4px 7px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4,
                        color: open ? '#00d4aa' : '#94a3b8', fontSize: 10, fontFamily: 'monospace',
                      }}>
                        <BarChart2 size={11}/>
                        {open ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}
                      </button>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#00d4aa', fontFamily: 'monospace' }}>{item.symbol}</div>
                        <div style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace' }}>Added {item.added_at?.slice(0, 10)}</div>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace', marginBottom: 2 }}>LTP</div>
                      <div style={{ fontWeight: 700, fontSize: 12, fontFamily: 'monospace' }}>{noData ? <span style={{ color: '#94a3b8' }}>—</span> : fmt(item.close_price)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace', marginBottom: 2 }}>Change</div>
                      <div style={{ fontWeight: 700, fontSize: 12, fontFamily: 'monospace', color: noData ? '#94a3b8' : col }}>
                        {noData ? '—' : `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace', marginBottom: 2 }}>Open</div>
                      <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#94a3b8' }}>{fmt(item.open_price)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace', marginBottom: 2 }}>High / Low</div>
                      <div style={{ fontSize: 11, fontFamily: 'monospace' }}>
                        <span style={{ color: '#00d4aa' }}>{fmt(item.high_price)}</span>
                        <span style={{ color: '#94a3b8' }}> / </span>
                        <span style={{ color: '#ff4d6d' }}>{fmt(item.low_price)}</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace', marginBottom: 2 }}>Volume</div>
                      <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#94a3b8' }}>{item.volume?.toLocaleString() ?? '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace', marginBottom: 2 }}>Turnover</div>
                      <div style={{ fontSize: 11, fontFamily: 'monospace' }}>{fmtCr(item.turnover)}</div>
                    </div>

               
                    <button onClick={() => toggleChart(item.symbol)} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: open ? '#00d4aa' : '#94a3b8', padding: '4px 6px', fontSize: 10, fontFamily: 'monospace',
                    }}>
                      {open ? 'Hide chart' : 'Chart'}
                    </button>

                    <button onClick={() => remove(item.symbol)} disabled={removing === item.symbol} style={{
                      display: 'flex', alignItems: 'center', gap: 4, padding: '5px 9px',
                      borderRadius: 6, border: '1px solid #1e2d45', background: 'transparent',
                      cursor: 'pointer', color: '#ff4d6d', fontSize: 10, fontFamily: 'monospace',
                      opacity: removing === item.symbol ? .5 : 1,
                    }}>
                      <Trash2 size={10}/>
                    </button>
                  </div>

                 
                  {open && (
                    <div style={{ padding: '0 16px 16px', borderTop: '1px solid #1e2d45' }}>
                      <div style={{ paddingTop: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 10, fontFamily: 'monospace' }}>
                          {item.symbol} — Price history (candlestick)
                        </div>
                        <CandlestickChart symbol={item.symbol} token={token ?? ''}/>
                      </div>
                      <div style={{ marginTop: 10, fontSize: 9, color: '#94a3b8', fontFamily: 'monospace' }}>
                        SQL: SELECT trading_date, open_price, high_price, low_price, close_price, volume FROM stocks WHERE symbol = '{item.symbol}' ORDER BY trading_date ASC — hover candles for OHLCV tooltip
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      
        <div style={{ marginTop: 16, padding: '9px 14px', borderRadius: 9, fontSize: 10, fontFamily: 'monospace', background: 'rgba(0,212,170,.04)', border: '1px solid rgba(0,212,170,.1)', color: '#94a3b8' }}>
          <span style={{ color: '#00d4aa' }}>Candlestick:</span> each candle = 1 trading day stored in MySQL ·
          green = close &gt; open · red = close &lt; open ·
          wick = high/low range · body = open→close range
        </div>
      </main>
    </div>
  );
}
