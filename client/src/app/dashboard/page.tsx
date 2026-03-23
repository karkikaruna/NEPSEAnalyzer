'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { fmt, fmtCr } from '@/lib/api';
import { TrendingUp, TrendingDown, Plus, ChevronDown, RefreshCw, BarChart2, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function DashboardPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data,       setData]       = useState<any>(null);
  const [symbols,    setSymbols]    = useState<string[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selSymbol,  setSelSymbol]  = useState('');
  const [symSearch,  setSymSearch]  = useState('');
  const [dropOpen,   setDropOpen]   = useState(false);
  const [addMsg,     setAddMsg]     = useState('');
  const [addErr,     setAddErr]     = useState('');
  const [adding,     setAdding]     = useState(false);

  useEffect(() => { if (!authLoading && !user) router.push('/login'); }, [user, authLoading, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // ONE request instead of 5 — much faster
      const [dashRes, symRes] = await Promise.all([
        fetch('/nepse/dashboard').then(r => r.json()),
        fetch('/nepse/symbols').then(r => r.json()),
      ]);
      setData(dashRes);
      setSymbols(symRes.symbols ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

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
      const j = await res.json();
      if (!res.ok) { setAddErr(j.detail ?? 'Error'); return; }
      setAddMsg(`${selSymbol} added to watchlist!`);
      setSelSymbol(''); setSymSearch('');
      setTimeout(() => setAddMsg(''), 3000);
    } finally { setAdding(false); }
  };

  const renderTrend = () => {
    const trend = data?.trend ?? [];
    if (trend.length < 2) return (
      <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#6b7280' }}>
        Run load_history.py to see trend chart
      </div>
    );
    const W = 560, H = 100, PL = 10, PR = 55, PT = 8, PB = 24;
    const vals = trend.map((d: any) => Number(d.avg_close));
    const minV = Math.min(...vals) * 0.997, maxV = Math.max(...vals) * 1.003, range = maxV - minV || 1;
    const cW = W - PL - PR, cH = H - PT - PB;
    const xs  = trend.map((_: any, i: number) => PL + i / (trend.length - 1) * cW);
    const ys  = vals.map((v: number) => PT + cH - (v - minV) / range * cH);
    const pts = xs.map((x: number, i: number) => `${x},${ys[i]}`).join(' ');
    const first = vals[0], last = vals[vals.length - 1];
    const lc  = last >= first ? '#16a34a' : '#dc2626';
    const chg = ((last - first) / first * 100).toFixed(2);
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#111928' }}>{last.toFixed(2)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: last >= first ? '#dcfce7' : '#fee2e2', color: lc, fontSize: 12, fontWeight: 600 }}>
            {last >= first ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Number(chg) >= 0 ? '+' : ''}{chg}%
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{trend.length}-day avg close</div>
        </div>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
          {[0, 0.25, 0.5, 0.75, 1].map((_, i) => {
            const v = minV + range * i / 4;
            const y = PT + cH - (v - minV) / range * cH;
            return <g key={i}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#f3f4f6" strokeWidth="1" />
              <text x={W - PR + 4} y={y + 3.5} fontSize="9" fill="#9ca3af" fontFamily="Inter,system-ui">{v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}</text>
            </g>;
          })}
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lc} stopOpacity="0.15" />
              <stop offset="100%" stopColor={lc} stopOpacity="0.01" />
            </linearGradient>
          </defs>
          <polygon points={`${PL},${PT + cH} ${pts} ${W - PR},${PT + cH}`} fill="url(#grad)" />
          <polyline points={pts} fill="none" stroke={lc} strokeWidth="2" />
          <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="3" fill={lc} />
          {trend.filter((_: any, i: number) => i % 10 === 0 || i === trend.length - 1).map((d: any) => {
            const i = trend.indexOf(d);
            const dt = new Date(d.trading_date);
            return <text key={i} x={xs[i]} y={H - PB + 13} textAnchor="middle" fontSize="9" fill="#9ca3af" fontFamily="Inter,system-ui">{`${dt.getDate()}/${dt.getMonth() + 1}`}</text>;
          })}
        </svg>
      </div>
    );
  };

  const filteredSyms = symbols.filter(s => s.includes(symSearch.toUpperCase())).slice(0, 50);
  if (authLoading || !user) return null;

  const s       = data?.summary;
  const gainers = data?.gainers ?? [];
  const losers  = data?.losers  ?? [];
  const date    = data?.trading_date ?? '';

  const statCard = (label: string, value: string, sub: string, color: string, bgColor: string) => (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '16px 18px' }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#111928', marginBottom: 3 }}>{loading ? '—' : value}</div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, background: bgColor, color, fontSize: 11, fontWeight: 500 }}>{sub}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb', fontFamily: "'Inter',system-ui,sans-serif" }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, padding: '24px 28px', overflowY: 'auto' }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111928', marginBottom: 4, letterSpacing: '-0.3px' }}>
              Good morning, {user.username} 👋
            </h1>
            <div style={{ fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', boxShadow: '0 0 0 2px #dcfce7' }} />
              Live NEPSE data · {date || 'Loading…'}
            </div>
          </div>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {statCard('Total Symbols',   String(s?.total_symbols ?? '—'), `${s?.gainers ?? 0} up · ${s?.losers ?? 0} down`, '#16a34a', '#dcfce7')}
          {statCard('Total Turnover',  fmtCr(s?.total_turnover),        "Today's value",                                   '#1a56db', '#eff6ff')}
          {statCard('Market High',     fmt(s?.market_high),             `Low: ${fmt(s?.market_low)}`,                      '#7c3aed', '#ede9fe')}
          {statCard('Avg Close Price', fmt(s?.avg_close),               'Across all symbols',                              '#0891b2', '#ecfeff')}
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '18px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <BarChart2 size={16} color="#1a56db" />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111928' }}>NEPSE Market Trend</span>
            <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>Average close · last 60 days</span>
          </div>
          {loading ? <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: 13 }}>Loading…</div> : renderTrend()}
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '18px 20px', marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111928', marginBottom: 14 }}>Add to Watchlist</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', minWidth: 220 }}>
              <div onClick={() => setDropOpen(!dropOpen)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: 8, cursor: 'pointer', background: '#f9fafb', border: '1.5px solid #e5e7eb', color: selSymbol ? '#111928' : '#9ca3af', fontSize: 13, userSelect: 'none' }}>
                <span>{selSymbol || 'Select company…'}</span>
                <ChevronDown size={14} style={{ color: '#9ca3af', transform: dropOpen ? 'rotate(180deg)' : 'none', transition: '.15s' }} />
              </div>
              {dropOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, maxHeight: 220, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,.1)' }}>
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>
                    <input autoFocus value={symSearch} onChange={e => setSymSearch(e.target.value.toUpperCase())} placeholder="Search symbol…" onClick={e => e.stopPropagation()}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, fontSize: 12, background: '#f9fafb', border: '1px solid #e5e7eb', color: '#111928', outline: 'none', boxSizing: 'border-box' as any }} />
                  </div>
                  <div style={{ overflowY: 'auto', maxHeight: 170 }}>
                    {filteredSyms.map(sym => (
                      <div key={sym} onClick={() => { setSelSymbol(sym); setDropOpen(false); setSymSearch(''); }}
                        style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: sym === selSymbol ? '#1a56db' : '#374151', background: sym === selSymbol ? '#eff6ff' : 'transparent', fontWeight: sym === selSymbol ? 600 : 400 }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                        onMouseLeave={e => (e.currentTarget.style.background = sym === selSymbol ? '#eff6ff' : 'transparent')}>
                        {sym}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button onClick={addToWatchlist} disabled={!selSymbol || adding}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, border: 'none', cursor: !selSymbol || adding ? 'not-allowed' : 'pointer', background: '#1a56db', color: '#fff', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', opacity: !selSymbol || adding ? .6 : 1 }}>
              <Plus size={14} /> {adding ? 'Adding…' : 'Add'}
            </button>
            {addMsg && <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 500 }}>✓ {addMsg}</span>}
            {addErr && <span style={{ fontSize: 12, color: '#dc2626' }}>{addErr}</span>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { title: 'Top Gainers', data: gainers, color: '#16a34a', bg: '#f0fdf4', Icon: TrendingUp,   sign: '+' },
            { title: 'Top Losers',  data: losers,  color: '#dc2626', bg: '#fef2f2', Icon: TrendingDown, sign: '' },
          ].map(({ title, data, color, bg, Icon, sign }) => (
            <div key={title} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8, background: bg }}>
                <Icon size={15} color={color} /><span style={{ fontWeight: 600, fontSize: 13, color }}>{title}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: '#f9fafb' }}>
                  {['Symbol', 'LTP', 'Change'].map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {loading ? Array(5).fill(0).map((_, i) => (
                    <tr key={i}><td colSpan={3} style={{ padding: '10px 12px' }}>
                      <div style={{ height: 10, background: '#f3f4f6', borderRadius: 4, width: '80%' }} />
                    </td></tr>
                  )) : data.map((g: any, i: number) => (
                    <tr key={g.symbol} style={{ borderTop: i > 0 ? '1px solid #f9fafb' : undefined }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <td style={{ padding: '9px 12px', fontWeight: 600, fontSize: 13, color: '#111928' }}>{g.symbol}</td>
                      <td style={{ padding: '9px 12px', fontSize: 13, color: '#374151' }}>{fmt(g.close_price)}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 20, background: color === '#16a34a' ? '#dcfce7' : '#fee2e2', color, fontSize: 11, fontWeight: 600 }}>
                          {sign}{Number(g.change_pct).toFixed(2)}%
                        </span>
                      </td>
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
