'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { fmt, fmtCr } from '@/lib/api';
import { TrendingUp, TrendingDown, Plus, RefreshCw, ChevronDown } from 'lucide-react';

interface IndexPoint { trading_date: string; avg_close: number; total_turnover_cr: number; gainers: number; losers: number; }

export default function DashboardPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [summary,    setSummary]    = useState<any>(null);
  const [gainers,    setGainers]    = useState<any[]>([]);
  const [losers,     setLosers]     = useState<any[]>([]);
  const [symbols,    setSymbols]    = useState<string[]>([]);
  const [indexData,  setIndexData]  = useState<IndexPoint[]>([]);
  const [tradingDate, setTradingDate] = useState('');
  const [loading,    setLoading]    = useState(true);
  const [selSymbol,  setSelSymbol]  = useState('');
  const [symSearch,  setSymSearch]  = useState('');
  const [dropOpen,   setDropOpen]   = useState(false);
  const [addMsg,     setAddMsg]     = useState('');
  const [addErr,     setAddErr]     = useState('');
  const [adding,     setAdding]     = useState(false);
  const [indexPeriod, setIndexPeriod] = useState(30);

  useEffect(() => { if (!authLoading && !user) router.push('/login'); }, [user, authLoading, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, gainRes, lossRes, symRes, idxRes] = await Promise.all([
        fetch('/nepse/market-summary').then(r => r.json()),
        fetch('/nepse/top-gainers?limit=8').then(r => r.json()),
        fetch('/nepse/top-losers?limit=8').then(r => r.json()),
        fetch('/nepse/symbols').then(r => r.json()),
        fetch(`/nepse/index?days=${indexPeriod}`).then(r => r.json()),
      ]);
      setSummary(sumRes.summary ?? null);
      setTradingDate(sumRes.trading_date ?? '');
      setGainers(gainRes.data ?? []);
      setLosers(lossRes.data ?? []);
      setSymbols(symRes.symbols ?? []);
      setIndexData(idxRes.data ?? []);
    } finally { setLoading(false); }
  }, [indexPeriod]);

  useEffect(() => { if (user) load(); }, [user, load]);

  const addToWatchlist = async () => {
    if (!selSymbol) return;
    setAdding(true); setAddMsg(''); setAddErr('');
    try {
      const res  = await fetch('/nepse/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ symbol: selSymbol }),
      });
      const json = await res.json();
      if (!res.ok) { setAddErr(json.detail ?? 'Error'); return; }
      setAddMsg(`${selSymbol} added to watchlist!`);
      setSelSymbol(''); setSymSearch('');
      setTimeout(() => setAddMsg(''), 3000);
    } finally { setAdding(false); }
  };

  const W = 560; const H = 160;
  const PL = 48; const PR = 12; const PT = 10; const PB = 28;
  const cW = W - PL - PR; const cH = H - PT - PB;
  const vals   = indexData.map(d => d.avg_close);
  const minV   = vals.length ? Math.min(...vals) * 0.995 : 0;
  const maxV   = vals.length ? Math.max(...vals) * 1.005 : 1;
  const range  = maxV - minV || 1;
  const toX    = (i: number) => PL + (i / Math.max(indexData.length - 1, 1)) * cW;
  const toY    = (v: number) => PT + cH - ((v - minV) / range) * cH;

  const polyline = indexData.map((d, i) => `${toX(i)},${toY(d.avg_close)}`).join(' ');
  const fillPath = indexData.length
    ? `M${toX(0)},${PT + cH} ` + indexData.map((d, i) => `L${toX(i)},${toY(d.avg_close)}`).join(' ') + ` L${toX(indexData.length - 1)},${PT + cH} Z`
    : '';

  const first = vals[0] ?? 0; const last = vals[vals.length - 1] ?? 0;
  const chg   = first ? ((last - first) / first * 100) : 0;
  const lineCol = chg >= 0 ? '#00d4aa' : '#ff4d6d';

  const filteredSymbols = symbols.filter(s => s.includes(symSearch.toUpperCase())).slice(0, 40);

  if (authLoading || !user) return null;
  const s = summary;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0e1a' }}>
      <Sidebar/>
      <main style={{ marginLeft: 220, flex: 1, padding: '28px', overflowY: 'auto' }}>

       
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
            Hi, {user.username} 👋
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', fontFamily: 'monospace' }}>
            Trading date: <span style={{ color: '#00d4aa' }}>{tradingDate}</span>
          </div>
        </div>

      
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 22 }}>
          {[
            { label: 'Total symbols', value: String(s?.total_symbols ?? '—'), color: '#00d4aa' },
            { label: 'Total turnover', value: fmtCr(s?.total_turnover), color: '#f5c842' },
            { label: 'Gainers / Losers', value: `${s?.gainers ?? '—'} / ${s?.losers ?? '—'}`, color: '#00d4aa', sub: `${s?.unchanged ?? '—'} unchanged` },
          ].map(c => (
            <div key={c.label} style={{ background: '#161d2e', border: '1px solid #1e2d45', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: c.color, fontFamily: 'monospace' }}>{loading ? '…' : c.value}</div>
              {c.sub && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>{c.sub}</div>}
            </div>
          ))}
        </div>

        <div style={{ background: '#161d2e', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px', marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>NEPSE Market Index</div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', marginTop: 2 }}>
                Avg close price across all stocks ·{' '}
                <span style={{ color: lineCol }}>{chg >= 0 ? '+' : ''}{chg.toFixed(2)}% over {indexPeriod}D</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[10, 30, 60, 90].map(p => (
                <button key={p} onClick={() => setIndexPeriod(p)} style={{
                  padding: '3px 9px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 10,
                  fontFamily: 'monospace', fontWeight: 600,
                  background: indexPeriod === p ? '#00d4aa' : '#1e2d45',
                  color:      indexPeriod === p ? '#0a0e1a' : '#94a3b8',
                }}>{p}D</button>
              ))}
            </div>
          </div>

          {loading || indexData.length < 2 ? (
            <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontFamily: 'monospace', fontSize: 11 }}>
              {loading ? 'Loading…' : 'Not enough data — run: python historical_scraper.py --days 90'}
            </div>
          ) : (
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
             
              {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
                const y = PT + cH * (1 - t);
                const v = minV + range * t;
                return (
                  <g key={i}>
                    <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#1e2d45" strokeWidth="0.5" strokeDasharray="3 3"/>
                    <text x={PL - 4} y={y} textAnchor="end" dominantBaseline="central" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                      {v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(0)}
                    </text>
                  </g>
                );
              })}
            
              <path d={fillPath} fill={lineCol} opacity="0.06"/>
            
              <polyline points={polyline} fill="none" stroke={lineCol} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
            
              {indexData.filter((_, i) => i % Math.max(1, Math.floor(indexData.length / 6)) === 0).map((d, i) => (
                <text key={i} x={toX(indexData.indexOf(d))} y={H - PB + 12}
                  textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                  {new Date(d.trading_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                </text>
              ))}
           
              <line x1={PL} y1={PT} x2={PL} y2={PT + cH} stroke="#1e2d45" strokeWidth="1"/>
              <line x1={PL} y1={PT + cH} x2={W - PR} y2={PT + cH} stroke="#1e2d45" strokeWidth="1"/>
            </svg>
          )}
        </div>

     
        <div style={{ background: '#161d2e', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px', marginBottom: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>Add company to watchlist</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', minWidth: 240 }}>
              <div onClick={() => setDropOpen(!dropOpen)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 12px', borderRadius: 9, cursor: 'pointer',
                background: '#111827', border: '1px solid #1e2d45',
                color: selSymbol ? '#e2e8f0' : '#94a3b8', fontSize: 13, fontFamily: 'monospace', userSelect: 'none',
              }}>
                <span>{selSymbol || 'Select company…'}</span>
                <ChevronDown size={14} style={{ color: '#94a3b8', transform: dropOpen ? 'rotate(180deg)' : 'none', transition: '.15s' }}/>
              </div>
              {dropOpen && (
                <div style={{ position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 100, background: '#161d2e', border: '1px solid #1e2d45', borderRadius: 9, maxHeight: 240, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid #1e2d45' }}>
                    <input autoFocus value={symSearch} onChange={e => setSymSearch(e.target.value.toUpperCase())} placeholder="Search…" onClick={e => e.stopPropagation()}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, fontSize: 12, background: '#111827', border: '1px solid #1e2d45', color: '#e2e8f0', fontFamily: 'monospace', outline: 'none' }}/>
                  </div>
                  <div style={{ overflowY: 'auto', maxHeight: 180 }}>
                    {filteredSymbols.map(sym => (
                      <div key={sym} onClick={() => { setSelSymbol(sym); setDropOpen(false); setSymSearch(''); }}
                        style={{ padding: '8px 14px', fontSize: 12, fontFamily: 'monospace', cursor: 'pointer', color: sym === selSymbol ? '#00d4aa' : '#e2e8f0', background: sym === selSymbol ? 'rgba(0,212,170,.08)' : 'transparent' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.05)')}
                        onMouseLeave={e => (e.currentTarget.style.background = sym === selSymbol ? 'rgba(0,212,170,.08)' : 'transparent')}>
                        {sym}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button onClick={addToWatchlist} disabled={!selSymbol || adding} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9,
              border: 'none', cursor: !selSymbol || adding ? 'not-allowed' : 'pointer',
              background: '#00d4aa', color: '#0a0e1a', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', opacity: !selSymbol || adding ? .6 : 1,
            }}>
              <Plus size={14}/> {adding ? 'Adding…' : 'Add to Watchlist'}
            </button>
            {addMsg && <div style={{ fontSize: 12, color: '#00d4aa', fontFamily: 'monospace', paddingTop: 10 }}>✓ {addMsg}</div>}
            {addErr && <div style={{ fontSize: 12, color: '#ff4d6d', fontFamily: 'monospace', paddingTop: 10 }}>✗ {addErr}</div>}
          </div>
        </div>

    
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { title: 'Top Gainers', data: gainers, color: '#00d4aa', icon: TrendingUp },
            { title: 'Top Losers',  data: losers,  color: '#ff4d6d', icon: TrendingDown },
          ].map(({ title, data, color, icon: Icon }) => (
            <div key={title} style={{ background: '#161d2e', border: '1px solid #1e2d45', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e2d45', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon size={15} color={color}/>
                <span style={{ fontWeight: 700, fontSize: 13, color }}>{title}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: '#111827' }}>
                  {['Symbol','LTP','Change %'].map(h => (
                    <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', color: '#94a3b8', borderBottom: '1px solid #1e2d45' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {loading ? Array(5).fill(0).map((_, i) => (
                    <tr key={i}><td colSpan={3} style={{ padding: '8px 12px' }}><div style={{ height: 10, background: '#1e2d45', borderRadius: 4 }}/></td></tr>
                  )) : data.map((g: any, i: number) => (
                    <tr key={g.symbol} style={{ borderTop: i > 0 ? '1px solid rgba(30,45,69,.5)' : undefined }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#111827')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#00d4aa', fontSize: 11 }}>{g.symbol}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11 }}>{fmt(g.close_price)}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color, fontSize: 11 }}>{Number(g.change_pct) >= 0 ? '+' : ''}{Number(g.change_pct).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
