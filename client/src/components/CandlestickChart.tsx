'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

interface Candle {
  trading_date: string;
  open_price:   number;
  high_price:   number;
  low_price:    number;
  close_price:  number;
  volume:       number;
}

interface Props { symbol: string; token: string; }

const PERIODS = [
  { label:'1M', days:30 },
  { label:'3M', days:90 },
  { label:'6M', days:180 },
  { label:'1Y', days:365 },
];

export default function CandlestickChart({ symbol, token }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const [candles,   setCandles]   = useState<Candle[]>([]);
  const [summary,   setSummary]   = useState<any>(null);
  const [period,    setPeriod]    = useState(90);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [tooltip,   setTooltip]   = useState<{candle:Candle;x:number;y:number}|null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res  = await fetch(`/nepse/candles/${symbol}?days=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) { setError(json.detail ?? 'No data'); setLoading(false); return; }
      setCandles(json.candles ?? []); setSummary(json.summary ?? null);
    } catch { setError('Failed to load chart'); }
    finally   { setLoading(false); }
  }, [symbol, period, token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!candles.length || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.offsetWidth;
    const H   = canvas.offsetHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const PAD = { top:16, right:60, bottom:48, left:8 };
    const cW  = W - PAD.left - PAD.right;
    const cH  = H - PAD.top  - PAD.bottom;

    const prices = candles.flatMap(c => [c.high_price, c.low_price]);
    const minP   = Math.min(...prices) * 0.997;
    const maxP   = Math.max(...prices) * 1.003;
    const range  = maxP - minP || 1;

    const toY = (p: number) => PAD.top + cH - ((p - minP) / range) * cH;
    const toX = (i: number) => PAD.left + (i + 0.5) * (cW / candles.length);
    const cw  = Math.max(1.5, Math.min(12, cW / candles.length - 2));

   
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);

  
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth   = 1;
    const YTICKS = 5;
    for (let i = 0; i <= YTICKS; i++) {
      const v = minP + (range * i) / YTICKS;
      const y = toY(v);
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
      ctx.fillStyle   = '#9ca3af';
      ctx.font        = '10px Inter,system-ui,sans-serif';
      ctx.textAlign   = 'right';
      ctx.fillText(v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(0), W - PAD.right + 54, y + 3.5);
    }

    candles.forEach((c, i) => {
      const x       = toX(i);
      const isGreen = c.close_price >= c.open_price;
      const GREEN   = '#16a34a'; const RED = '#dc2626';
      const color   = isGreen ? GREEN : RED;
      const bodyTop = toY(Math.max(c.open_price, c.close_price));
      const bodyBot = toY(Math.min(c.open_price, c.close_price));
      const bodyH   = Math.max(1, bodyBot - bodyTop);

      
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, toY(c.high_price));
      ctx.lineTo(x, toY(c.low_price));
      ctx.stroke();

      ctx.fillStyle = isGreen ? '#dcfce7' : '#fee2e2';
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.fillRect(x - cw/2, bodyTop, cw, bodyH);
      ctx.strokeRect(x - cw/2, bodyTop, cw, bodyH);
    });

    const interval = Math.max(1, Math.floor(candles.length / 8));
    ctx.fillStyle = '#9ca3af'; ctx.font = '10px Inter,system-ui,sans-serif'; ctx.textAlign = 'center';
    candles.forEach((c, i) => {
      if (i % interval === 0) {
        const dt = new Date(c.trading_date);
        ctx.fillText(`${dt.getDate()}/${dt.getMonth()+1}`, toX(i), H - PAD.bottom + 14);
      }
    });

    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, H-PAD.bottom); ctx.lineTo(W-PAD.right, H-PAD.bottom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W-PAD.right, PAD.top); ctx.lineTo(W-PAD.right, H-PAD.bottom); ctx.stroke();

  }, [candles]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!candles.length || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const W    = rect.width;
    const cW   = W - 8 - 60;
    const idx  = Math.round(mx / (cW / candles.length) - 0.5);
    if (idx >= 0 && idx < candles.length) {
      setTooltip({ candle: candles[idx], x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  const chg    = summary?.change_pct ?? 0;
  const chgCol = chg >= 0 ? '#16a34a' : '#dc2626';
  const bgChg  = chg >= 0 ? '#dcfce7' : '#fee2e2';

  if (loading) return (
    <div style={{ height:260, display:'flex', alignItems:'center', justifyContent:'center', color:'#6b7280', fontSize:13 }}>
      Loading chart data…
    </div>
  );

  if (error || candles.length < 3) return (
    <div style={{ height:100, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6 }}>
      <div style={{ fontSize:13, color:'#6b7280', textAlign:'center' }}>
        {candles.length < 3
          ? `Only ${candles.length} data point(s). Run: python load_history.py --symbol ${symbol} --days ${period}`
          : error}
      </div>
      <div style={{ fontSize:11, color:'#9ca3af' }}>Run load_history.py to populate historical data</div>
    </div>
  );

  return (
    <div style={{ fontFamily:"'Inter',system-ui,sans-serif" }}>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', gap:16 }}>
          {[
            { label:'Period high', value:summary?.period_high?.toFixed(2), color:'#16a34a', bg:'#dcfce7' },
            { label:'Period low',  value:summary?.period_low?.toFixed(2),  color:'#dc2626', bg:'#fee2e2' },
            { label:`${summary?.days ?? 0}D change`, value:`${chg >= 0 ? '+' : ''}${chg}%`, color:chgCol, bg:bgChg },
            { label:'Last close',  value:summary?.last_close?.toFixed(2),  color:'#111928', bg:'#f9fafb' },
          ].map(s => (
            <div key={s.label} style={{ padding:'5px 10px', borderRadius:8, background:s.bg }}>
              <div style={{ fontSize:10, color:'#6b7280', marginBottom:2 }}>{s.label}</div>
              <div style={{ fontSize:13, fontWeight:700, color:s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display:'flex', gap:3 }}>
          {PERIODS.map(p => (
            <button key={p.days} onClick={()=>setPeriod(p.days)}
              style={{ padding:'4px 10px', borderRadius:6, border:'1px solid', fontSize:11, fontWeight:500, cursor:'pointer', transition:'all .12s',
                borderColor: period===p.days ? '#1a56db' : '#e5e7eb',
                background:  period===p.days ? '#1a56db' : '#fff',
                color:       period===p.days ? '#fff'    : '#374151' }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ position:'relative', background:'#fff', borderRadius:8, border:'1px solid #f3f4f6', overflow:'hidden' }}>
        <canvas
          ref={canvasRef}
          style={{ width:'100%', height:260, display:'block', cursor:'crosshair' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={()=>setTooltip(null)}
        />

        {tooltip && (
          <div style={{ position:'absolute', top: Math.min(tooltip.y, 170), left: tooltip.x > 300 ? tooltip.x - 130 : tooltip.x + 10,
            background:'#fff', border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px',
            boxShadow:'0 4px 12px rgba(0,0,0,.12)', fontSize:11, zIndex:10, pointerEvents:'none', minWidth:115 }}>
            <div style={{ fontWeight:600, color:'#374151', marginBottom:5 }}>{tooltip.candle.trading_date}</div>
            {[
              ['Open',  tooltip.candle.open_price,  '#374151'],
              ['High',  tooltip.candle.high_price,  '#16a34a'],
              ['Low',   tooltip.candle.low_price,   '#dc2626'],
              ['Close', tooltip.candle.close_price, tooltip.candle.close_price >= tooltip.candle.open_price ? '#16a34a' : '#dc2626'],
            ].map(([l,v,c])=>(
              <div key={String(l)} style={{ display:'flex', justifyContent:'space-between', gap:10, marginBottom:2 }}>
                <span style={{ color:'#9ca3af' }}>{l}</span>
                <span style={{ color:String(c), fontWeight:600 }}>{Number(v).toFixed(2)}</span>
              </div>
            ))}
            <div style={{ marginTop:5, paddingTop:5, borderTop:'1px solid #f3f4f6', color:'#6b7280' }}>
              Vol: {tooltip.candle.volume?.toLocaleString() ?? '—'}
            </div>
          </div>
        )}
      </div>
      <div style={{ fontSize:10, color:'#9ca3af', marginTop:6 }}>
        Green candle = close &gt; open · Red candle = close &lt; open · Hover for OHLCV details
      </div>
    </div>
  );
}
