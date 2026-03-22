'use client';
import { useEffect, useState, useCallback } from 'react';

interface Candle {
  trading_date: string;
  open_price:   number;
  high_price:   number;
  low_price:    number;
  close_price:  number;
  volume:       number;
}

interface Summary {
  days: number; period_high: number; period_low: number;
  first_close: number; last_close: number; change_pct: number;
}

interface Props { symbol: string; token: string; }

const PERIODS = [
  { label: '10D', days: 10 },
  { label: '30D', days: 30 },
  { label: '60D', days: 60 },
  { label: '90D', days: 90 },
];

export default function CandlestickChart({ symbol, token }: Props) {
  const [candles,  setCandles]  = useState<Candle[]>([]);
  const [summary,  setSummary]  = useState<Summary | null>(null);
  const [period,   setPeriod]   = useState(30);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [tooltip,  setTooltip]  = useState<{ candle: Candle; x: number; y: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res  = await fetch(`/nepse/candles/${symbol}?days=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setError('No historical data available'); setLoading(false); return; }
      const json = await res.json();
      setCandles(json.candles ?? []);
      setSummary(json.summary ?? null);
    } catch {
      setError('Failed to load chart data');
    } finally {
      setLoading(false);
    }
  }, [symbol, period, token]);

  useEffect(() => { load(); }, [load]);

  const W = 560; const H = 220;
  const PAD = { top: 16, right: 16, bottom: 32, left: 56 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top  - PAD.bottom;

  const allPrices = candles.flatMap(c => [c.high_price, c.low_price]);
  const minP = allPrices.length ? Math.min(...allPrices) * 0.998 : 0;
  const maxP = allPrices.length ? Math.max(...allPrices) * 1.002 : 1;
  const priceRange = maxP - minP || 1;

  const toY  = (p: number) => PAD.top + chartH - ((p - minP) / priceRange) * chartH;
  const toX  = (i: number) => PAD.left + (i + 0.5) * (chartW / Math.max(candles.length, 1));
  const candleW = Math.max(2, Math.min(14, chartW / Math.max(candles.length, 1) - 2));

  const priceLabels = 5;
  const yTicks = Array.from({ length: priceLabels }, (_, i) => minP + (priceRange * i) / (priceLabels - 1));

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return `${dt.getDate()}/${dt.getMonth() + 1}`;
  };
  const dateInterval = Math.max(1, Math.floor(candles.length / 6));

  if (loading) return (
    <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontFamily: 'monospace', fontSize: 11 }}>
      Loading chart…
    </div>
  );

  if (error || candles.length < 2) return (
    <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontFamily: 'monospace', fontSize: 11 }}>
      {candles.length < 2 ? `Only ${candles.length} data point(s) — fetch more dates to see the chart` : error}
    </div>
  );

  const chg    = summary?.change_pct ?? 0;
  const chgCol = chg >= 0 ? '#00d4aa' : '#ff4d6d';

  return (
    <div style={{ userSelect: 'none' }}>
      
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 14 }}>
          {[
            { label: 'Period high', value: summary?.period_high?.toFixed(2) ?? '—', color: '#00d4aa' },
            { label: 'Period low',  value: summary?.period_low?.toFixed(2)  ?? '—', color: '#ff4d6d' },
            { label: `${summary?.days ?? 0}D change`, value: `${chg >= 0 ? '+' : ''}${chg}%`, color: chgCol },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
            </div>
          ))}
        </div>
      
        <div style={{ display: 'flex', gap: 4 }}>
          {PERIODS.map(p => (
            <button key={p.days} onClick={() => setPeriod(p.days)} style={{
              padding: '3px 9px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 10,
              fontFamily: 'monospace', fontWeight: 600,
              background: period === p.days ? '#00d4aa' : '#1e2d45',
              color:      period === p.days ? '#0a0e1a' : '#94a3b8',
            }}>{p.label}</button>
          ))}
        </div>
      </div>

   
      <div style={{ position: 'relative' }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>

          
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={PAD.left} y1={toY(tick)} x2={W - PAD.right} y2={toY(tick)}
                stroke="#1e2d45" strokeWidth="0.5" strokeDasharray="3 3"
              />
              <text x={PAD.left - 4} y={toY(tick)} textAnchor="end" dominantBaseline="central"
                fill="#94a3b8" fontSize="9" fontFamily="monospace">
                {tick >= 1000 ? `${(tick / 1000).toFixed(1)}k` : tick.toFixed(0)}
              </text>
            </g>
          ))}

        
          {candles.map((c, i) => {
            const x       = toX(i);
            const isGreen = c.close_price >= c.open_price;
            const col     = isGreen ? '#00d4aa' : '#ff4d6d';
            const bodyTop = toY(Math.max(c.open_price, c.close_price));
            const bodyBot = toY(Math.min(c.open_price, c.close_price));
            const bodyH   = Math.max(1, bodyBot - bodyTop);

            return (
              <g key={i}
                onMouseEnter={e => setTooltip({ candle: c, x: i > candles.length * 0.7 ? x - 110 : x + 10, y: toY(c.high_price) })}
                onMouseLeave={() => setTooltip(null)}
                style={{ cursor: 'crosshair' }}
              >
               
                <line x1={x} y1={toY(c.high_price)} x2={x} y2={toY(c.low_price)} stroke={col} strokeWidth="1"/>
             
                <rect
                  x={x - candleW / 2} y={bodyTop}
                  width={candleW} height={bodyH}
                  fill={isGreen ? col : col}
                  opacity={isGreen ? 0.9 : 0.85}
                  rx="1"
                />
              </g>
            );
          })}

        
          {candles.map((c, i) => {
            if (i % dateInterval !== 0) return null;
            return (
              <text key={i} x={toX(i)} y={H - PAD.bottom + 12}
                textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                {formatDate(c.trading_date)}
              </text>
            );
          })}

      
          <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom}
            stroke="#1e2d45" strokeWidth="1"/>
       
          <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom}
            stroke="#1e2d45" strokeWidth="1"/>
        </svg>

     
        {tooltip && (
          <div style={{
            position: 'absolute', top: tooltip.y, left: tooltip.x,
            background: '#0d1117', border: '1px solid #1e2d45', borderRadius: 8,
            padding: '8px 12px', fontSize: 10, fontFamily: 'monospace', zIndex: 10,
            pointerEvents: 'none', minWidth: 110,
          }}>
            <div style={{ color: '#94a3b8', marginBottom: 5 }}>{tooltip.candle.trading_date}</div>
            {[
              ['O', tooltip.candle.open_price,  '#e2e8f0'],
              ['H', tooltip.candle.high_price,  '#00d4aa'],
              ['L', tooltip.candle.low_price,   '#ff4d6d'],
              ['C', tooltip.candle.close_price, tooltip.candle.close_price >= tooltip.candle.open_price ? '#00d4aa' : '#ff4d6d'],
            ].map(([label, val, col]) => (
              <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ color: '#94a3b8' }}>{label}</span>
                <span style={{ color: String(col), fontWeight: 700 }}>{Number(val).toFixed(2)}</span>
              </div>
            ))}
            <div style={{ marginTop: 5, paddingTop: 5, borderTop: '1px solid #1e2d45', color: '#94a3b8' }}>
              Vol: {tooltip.candle.volume?.toLocaleString() ?? '—'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
