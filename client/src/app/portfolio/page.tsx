'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import CandlestickChart from '@/components/CandlestickChart';
import { fmt, fmtCr } from '@/lib/api';
import { Briefcase, Plus, Trash2, RefreshCw, ChevronDown, TrendingUp, TrendingDown, BarChart2, ChevronUp } from 'lucide-react';

interface Holding {
  symbol: string; kitta: number; buy_price: number; added_at: string;
  current_price: number | null; open_price: number | null;
  high_price: number | null; low_price: number | null;
  volume: number | null; turnover: number | null;
  trading_date: string | null;
  invested_amount: number; current_value: number;
  profit_loss: number; profit_loss_pct: number;
}

interface Summary {
  total_invested: number; total_current: number;
  total_profit_loss: number; total_pl_pct: number; total_stocks: number;
}

export default function PortfolioPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [holdings,  setHoldings]  = useState<Holding[]>([]);
  const [summary,   setSummary]   = useState<Summary | null>(null);
  const [symbols,   setSymbols]   = useState<string[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [removing,  setRemoving]  = useState<string | null>(null);
  const [expanded,  setExpanded]  = useState<Record<string, boolean>>({});
  const [tradingDate, setTradingDate] = useState('');

  // Form state
  const [selSym,    setSelSym]    = useState('');
  const [kitta,     setKitta]     = useState('');
  const [buyPrice,  setBuyPrice]  = useState('');
  const [symSearch, setSymSearch] = useState('');
  const [dropOpen,  setDropOpen]  = useState(false);
  const [addMsg,    setAddMsg]    = useState('');
  const [addErr,    setAddErr]    = useState('');
  const [adding,    setAdding]    = useState(false);

  useEffect(() => { if (!authLoading && !user) router.push('/login'); }, [user, authLoading, router]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [portRes, symRes] = await Promise.all([
        fetch('/nepse/portfolio', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch('/nepse/symbols').then(r => r.json()),
      ]);
      setHoldings(portRes.holdings ?? []);
      setSummary(portRes.summary ?? null);
      setTradingDate(portRes.trading_date ?? '');
      setSymbols(symRes.symbols ?? []);
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { if (user) load(); }, [user, load]);

  const addHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selSym || !kitta || !buyPrice) return;
    setAdding(true); setAddMsg(''); setAddErr('');
    try {
      const res  = await fetch('/nepse/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ symbol: selSym, kitta: parseInt(kitta), buy_price: parseFloat(buyPrice) }),
      });
      const json = await res.json();
      if (!res.ok) { setAddErr(json.detail ?? 'Error'); return; }
      setAddMsg(`${selSym} added!`);
      setSelSym(''); setKitta(''); setBuyPrice(''); setSymSearch('');
      setTimeout(() => setAddMsg(''), 3000);
      load();
    } finally { setAdding(false); }
  };

  const remove = async (symbol: string) => {
    setRemoving(symbol);
    await fetch(`/nepse/portfolio/${symbol}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setHoldings(h => h.filter(x => x.symbol !== symbol));
    setRemoving(null);
  };

  const filteredSymbols = symbols.filter(s => s.includes(symSearch.toUpperCase())).slice(0, 40);
  const totalPL = summary?.total_profit_loss ?? 0;
  const totalPLPct = summary?.total_pl_pct ?? 0;
  const plColor = totalPL >= 0 ? '#00d4aa' : '#ff4d6d';

  const inp: React.CSSProperties = {
    padding: '9px 12px', borderRadius: 9, background: '#111827',
    border: '1px solid #1e2d45', color: '#e2e8f0',
    fontFamily: 'monospace', fontSize: 12, outline: 'none', width: '100%',
  };

  if (authLoading || !user) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0e1a' }}>
      <Sidebar/>
      <main style={{ marginLeft: 220, flex: 1, padding: '28px', overflowY: 'auto' }}>

     
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Briefcase size={20} color="#00d4aa"/> My Portfolio
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace', marginTop: 4 }}>
              {user.username} · {holdings.length} holdings · data for {tradingDate || '—'}
            </div>
          </div>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1px solid #1e2d45', background: '#161d2e', color: '#94a3b8', fontSize: 12, fontFamily: 'monospace', cursor: 'pointer' }}>
            <RefreshCw size={12}/> Refresh
          </button>
        </div>

     
        {summary && holdings.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 22 }}>
            {[
              { label: 'Total invested',    value: `₨ ${(summary.total_invested/1e5).toFixed(2)} L`,  color: '#94a3b8' },
              { label: 'Current value',     value: `₨ ${(summary.total_current/1e5).toFixed(2)} L`,   color: '#e2e8f0' },
              { label: 'Profit / Loss',     value: `${totalPL >= 0 ? '+' : ''}₨ ${Math.abs(totalPL/1e5).toFixed(2)} L`, color: plColor },
              { label: 'Return %',          value: `${totalPLPct >= 0 ? '+' : ''}${totalPLPct.toFixed(2)}%`, color: plColor },
            ].map(c => (
              <div key={c.label} style={{ background: '#161d2e', border: `1px solid ${c.color === plColor ? `${plColor}33` : '#1e2d45'}`, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{c.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: c.color, fontFamily: 'monospace' }}>{c.value}</div>
              </div>
            ))}
          </div>
        )}

       
        <div style={{ background: '#161d2e', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px', marginBottom: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 14 }}>Add holding</div>
          <form onSubmit={addHolding}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>

           
              <div style={{ flex: '0 0 200px' }}>
                <label style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Company</label>
                <div style={{ position: 'relative' }}>
                  <div onClick={() => setDropOpen(!dropOpen)} style={{ ...inp, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: selSym ? '#e2e8f0' : '#94a3b8' }}>
                    <span>{selSym || 'Select…'}</span>
                    <ChevronDown size={13} style={{ color: '#94a3b8', flexShrink: 0 }}/>
                  </div>
                  {dropOpen && (
                    <div style={{ position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 100, background: '#161d2e', border: '1px solid #1e2d45', borderRadius: 9, maxHeight: 220, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
                      <div style={{ padding: '8px 10px', borderBottom: '1px solid #1e2d45' }}>
                        <input autoFocus value={symSearch} onChange={e => setSymSearch(e.target.value.toUpperCase())} placeholder="Search symbol…" onClick={e => e.stopPropagation()}
                          style={{ width: '100%', padding: '6px 10px', borderRadius: 6, fontSize: 12, background: '#111827', border: '1px solid #1e2d45', color: '#e2e8f0', fontFamily: 'monospace', outline: 'none' }}/>
                      </div>
                      <div style={{ overflowY: 'auto', maxHeight: 160 }}>
                        {filteredSymbols.map(sym => (
                          <div key={sym} onClick={() => { setSelSym(sym); setDropOpen(false); setSymSearch(''); }}
                            style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'monospace', cursor: 'pointer', color: sym === selSym ? '#00d4aa' : '#e2e8f0' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.05)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            {sym}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

           
              <div style={{ flex: '0 0 120px' }}>
                <label style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Kitta (shares)</label>
                <input style={inp} type="number" min="1" value={kitta} onChange={e => setKitta(e.target.value)} placeholder="e.g. 100" required/>
              </div>

              <div style={{ flex: '0 0 150px' }}>
                <label style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Buy price (₨)</label>
                <input style={inp} type="number" step="0.01" min="0.01" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} placeholder="e.g. 1240.00" required/>
              </div>

              {kitta && buyPrice && (
                <div style={{ paddingBottom: 2 }}>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Total invested</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f5c842', fontFamily: 'monospace' }}>
                    ₨ {(parseInt(kitta || '0') * parseFloat(buyPrice || '0')).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>
                </div>
              )}

              <button type="submit" disabled={!selSym || !kitta || !buyPrice || adding} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9,
                border: 'none', cursor: 'pointer', background: '#00d4aa', color: '#0a0e1a',
                fontWeight: 700, fontSize: 13, fontFamily: 'inherit', height: 38,
                opacity: !selSym || !kitta || !buyPrice || adding ? .6 : 1,
              }}>
                <Plus size={14}/> {adding ? 'Adding…' : 'Add'}
              </button>
            </div>

            {addMsg && <div style={{ marginTop: 10, fontSize: 12, color: '#00d4aa', fontFamily: 'monospace' }}>✓ {addMsg}</div>}
            {addErr && <div style={{ marginTop: 10, fontSize: 12, color: '#ff4d6d', fontFamily: 'monospace' }}>✗ {addErr}</div>}
          </form>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontFamily: 'monospace', fontSize: 12 }}>Loading…</div>
        ) : holdings.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', background: '#161d2e', border: '1px solid #1e2d45', borderRadius: 12 }}>
            <Briefcase size={32} style={{ color: '#1e2d45', marginBottom: 12 }}/>
            <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>No holdings yet</div>
            <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>Add a company above to track your investment</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {holdings.map(h => {
              const pl    = h.profit_loss ?? 0;
              const plPct = h.profit_loss_pct ?? 0;
              const col   = pl >= 0 ? '#00d4aa' : '#ff4d6d';
              const open  = expanded[h.symbol];

              return (
                <div key={h.symbol} style={{ background: '#161d2e', border: `1px solid ${open ? '#1e3a5f' : '#1e2d45'}`, borderRadius: 12, overflow: 'hidden' }}>

                  <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 100px 100px 120px 120px 100px auto auto', gap: 10, alignItems: 'center' }}>


                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#00d4aa', fontFamily: 'monospace' }}>{h.symbol}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', marginTop: 2 }}>{h.kitta} kitta · bought @ ₨{Number(h.buy_price).toFixed(2)}</div>
                    </div>

                    <div>
                      <div style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace', marginBottom: 3 }}>Current LTP</div>
                      <div style={{ fontWeight: 700, fontSize: 12, fontFamily: 'monospace' }}>{h.current_price ? fmt(h.current_price) : '—'}</div>
                    </div>

                    <div>
                      <div style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace', marginBottom: 3 }}>Invested</div>
                      <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#94a3b8' }}>₨ {Number(h.invested_amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                    </div>

                    <div>
                      <div style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace', marginBottom: 3 }}>Current value</div>
                      <div style={{ fontWeight: 700, fontSize: 12, fontFamily: 'monospace' }}>₨ {Number(h.current_value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                    </div>

                    <div>
                      <div style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace', marginBottom: 3 }}>Profit / Loss</div>
                      <div style={{ fontWeight: 700, fontSize: 12, fontFamily: 'monospace', color: col }}>
                        {pl >= 0 ? '+' : ''}₨ {Math.abs(pl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace', marginBottom: 3 }}>Return</div>
                      <div style={{ fontWeight: 700, fontSize: 13, fontFamily: 'monospace', color: col, display: 'flex', alignItems: 'center', gap: 3 }}>
                        {pl >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                        {plPct >= 0 ? '+' : ''}{Number(plPct).toFixed(2)}%
                      </div>
                    </div>

                    <button onClick={() => setExpanded(p => ({ ...p, [h.symbol]: !p[h.symbol] }))} style={{
                      display: 'flex', alignItems: 'center', gap: 4, padding: '5px 9px', borderRadius: 6,
                      border: `1px solid ${open ? 'rgba(0,212,170,.3)' : '#1e2d45'}`,
                      background: open ? 'rgba(0,212,170,.1)' : 'transparent',
                      cursor: 'pointer', color: open ? '#00d4aa' : '#94a3b8', fontSize: 10, fontFamily: 'monospace',
                    }}>
                      <BarChart2 size={11}/>
                      {open ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}
                    </button>

                  
                    <button onClick={() => remove(h.symbol)} disabled={removing === h.symbol} style={{
                      display: 'flex', alignItems: 'center', gap: 4, padding: '5px 9px', borderRadius: 6,
                      border: '1px solid #1e2d45', background: 'transparent',
                      cursor: 'pointer', color: '#ff4d6d', fontSize: 10, fontFamily: 'monospace',
                      opacity: removing === h.symbol ? .5 : 1,
                    }}>
                      <Trash2 size={10}/>
                    </button>
                  </div>

                 
                  {open && (
                    <div style={{ padding: '0 16px 16px', borderTop: '1px solid #1e2d45' }}>
                      <div style={{ paddingTop: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 10, fontFamily: 'monospace' }}>
                          {h.symbol} — Price history
                        </div>
                        <CandlestickChart symbol={h.symbol} token={token ?? ''}/>
                      </div>
                      <div style={{ marginTop: 8, padding: '7px 10px', borderRadius: 7, background: 'rgba(0,212,170,.04)', border: '1px solid rgba(0,212,170,.1)', fontSize: 9, color: '#94a3b8', fontFamily: 'monospace' }}>
                        SQL: SELECT trading_date, open, high, low, close FROM stocks WHERE symbol='{h.symbol}' ORDER BY trading_date ASC
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 16, padding: '9px 14px', borderRadius: 9, fontSize: 10, fontFamily: 'monospace', background: 'rgba(0,212,170,.04)', border: '1px solid rgba(0,212,170,.1)', color: '#94a3b8' }}>
          <span style={{ color: '#00d4aa' }}>DBMS:</span>
          {' '}portfolio table stores kitta + buy_price ·
          JOIN with stocks on symbol + trading_date computes current_value = kitta × current_price ·
          profit_loss = current_value − invested_amount
        </div>
      </main>
    </div>
  );
}
